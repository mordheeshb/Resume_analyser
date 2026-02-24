/**
 * /api/resume  — replaces the AWS Lambda function entirely.
 *
 * POST { action: "generateUploadUrl", fileName, contentType }
 *   → { uploadUrl, fileKey }
 *
 * POST { action: "analyzeResume", fileKey }
 *   → { topMatch, allSuggestions }
 *
 * All AWS calls happen server-side — credentials never reach the browser.
 * Uses `unpdf` for PDF text extraction (Node.js/Edge-compatible, no DOM APIs).
 */

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// ── AWS config ────────────────────────────────────────────────────────────────
// Amplify blocks "AWS_" prefix, so we use "APP_AWS_" on Amplify.
// Local dev (.env.local) still uses AWS_ names — both are checked.
const REGION = process.env.APP_AWS_REGION || process.env.AWS_REGION || "ap-southeast-2";
const BUCKET = process.env.S3_BUCKET_NAME || "resume-analyzer-mordheesh-2026";
const TABLE = process.env.DYNAMODB_TABLE_NAME || "JobRoles";
const ACCESS_KEY = process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";

// Log on cold start so you can check Amplify CloudWatch logs
if (!ACCESS_KEY || !SECRET_KEY) {
    console.error(
        "[/api/resume] ⚠️  AWS credentials are MISSING.\n" +
        "  In Amplify Console → Hosting → Environment variables, add:\n" +
        "  APP_AWS_ACCESS_KEY_ID, APP_AWS_SECRET_ACCESS_KEY, APP_AWS_REGION, S3_BUCKET_NAME, DYNAMODB_TABLE_NAME"
    );
}

const awsCredentials = ACCESS_KEY && SECRET_KEY
    ? { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
    : undefined;  // fall back to IAM role / instance profile if on AWS infra

const s3 = new S3Client({
    region: REGION,
    ...(awsCredentials && { credentials: awsCredentials }),
});

const dynamo = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: REGION,
        ...(awsCredentials && { credentials: awsCredentials }),
    })
);

// ── Global Cache ──────────────────────────────────────────────────────────────
// This stays in memory across requests in Next.js dev and production.
// It eliminates the ~1-2s delay of scanning DynamoDB on every analysis.
let cachedRoles: Record<string, any>[] | null = null;

// Pre-load unpdf to avoid dynamic import latency in the request path.
const unpdfPromise = import("unpdf");

// ── helpers ───────────────────────────────────────────────────────────────────

/** Convert a Node.js Readable (AWS SDK v3) into a Buffer */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

/** Extract plain text from a PDF buffer using unpdf (no DOM required) */
async function extractPdfText(buffer: Buffer): Promise<string> {
    const { extractText } = await unpdfPromise;
    const uint8 = new Uint8Array(buffer);
    const { text } = await extractText(uint8, { mergePages: true });
    return typeof text === "string" ? text : (text as string[]).join(" ");
}

/** Scan all pages of a DynamoDB table with basic memory caching */
async function scanAllRoles(): Promise<Record<string, any>[]> {
    if (cachedRoles) {
        console.log(`[resume] Using ${cachedRoles.length} roles from memory cache`);
        return cachedRoles;
    }

    const items: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;
    console.log("[resume] Cache empty, scanning DynamoDB...");
    do {
        const resp = await dynamo.send(
            new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey })
        );
        items.push(...(resp.Items ?? []));
        lastKey = resp.LastEvaluatedKey as Record<string, any> | undefined;
    } while (lastKey);

    cachedRoles = items;
    return items;
}

/** Simple keyword matcher — mirrors the original Lambda logic */
function extractSkills(text: string, skills: string[]): string[] {
    const lower = text.toLowerCase();
    return skills.filter((s) => lower.includes(s.toLowerCase()));
}

function ok(data: unknown) {
    return NextResponse.json(data, { status: 200 });
}
function err(msg: string, status = 400) {
    return NextResponse.json({ error: msg }, { status });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return err("Invalid JSON body");
        }

        const action: string = body?.action ?? "";

        // ── ACTION: generateUploadUrl ─────────────────────────────────────────
        if (action === "generateUploadUrl") {
            const fileName = body.fileName ?? "resume.pdf";
            const contentType = body.contentType ?? "application/pdf";
            const fileKey = `resumes/${crypto.randomUUID()}-${fileName}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET,
                Key: fileKey,
                ContentType: contentType,
            });

            const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
            return ok({ uploadUrl, fileKey });
        }

        // ── ACTION: analyzeResume ─────────────────────────────────────────────
        if (action === "analyzeResume") {
            const fileKey: string = body.fileKey ?? "";
            if (!fileKey) return err("fileKey is required");

            // 1. Download PDF from S3
            const s3Resp = await s3.send(
                new GetObjectCommand({ Bucket: BUCKET, Key: fileKey })
            );
            if (!s3Resp.Body) return err("Empty file body from S3", 500);

            const pdfBuffer = await streamToBuffer(s3Resp.Body as unknown as Readable);

            // 2. Extract text via unpdf (no DOM, no browser APIs needed)
            const resumeText = await extractPdfText(pdfBuffer);
            console.log(`[resume] PDF extracted — ${resumeText.length} chars`);

            // 3. Score each role in DynamoDB
            const roles = await scanAllRoles();
            console.log(`[resume] DynamoDB returned ${roles.length} roles`);

            const suggestions: any[] = [];

            for (const item of roles) {
                const roleName: string = item.roleName ?? item.role ?? "Unknown";
                const roleSkills: string[] = Array.isArray(item.skills) ? item.skills : [];
                if (!roleSkills.length) continue;

                const matchedSkills = extractSkills(resumeText, roleSkills);
                const matchPct = (matchedSkills.length / roleSkills.length) * 100;
                const missingSkills = roleSkills.filter((s: string) => !matchedSkills.includes(s));

                suggestions.push({
                    role: roleName,
                    matchPercentage: Math.round(matchPct * 100) / 100,
                    matchedSkills,
                    missingSkills,
                });
            }

            suggestions.sort((a, b) => b.matchPercentage - a.matchPercentage);
            const topMatch = suggestions[0] ?? null;

            return ok({ topMatch, allSuggestions: suggestions });
        }

        return err(`Unknown action: "${action}". Use generateUploadUrl or analyzeResume.`);

    } catch (e: any) {
        console.error("[/api/resume] Unhandled error:", e);
        return NextResponse.json(
            { error: e?.message ?? "Internal server error" },
            { status: 500 }
        );
    }
}

// OPTIONS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}
