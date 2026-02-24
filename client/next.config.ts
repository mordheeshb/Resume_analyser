import type { NextConfig } from "next";

/**
 * No proxy rewrites needed — the Lambda / API Gateway has been removed.
 * Resume analysis is now handled entirely by the Next.js API route
 * at /api/resume (src/app/api/resume/route.ts).
 *
 * That route calls S3 (pre-signed URLs) and DynamoDB (job roles scan)
 * directly via the AWS SDK v3, using credentials from .env.local.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,

  // Explicitly expose server-side env vars so they are always available
  // in API routes regardless of deployment target.
  env: {
    AWS_REGION: process.env.AWS_REGION ?? "ap-southeast-2",
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "",
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ?? "resume-analyzer-mordheesh-2026",
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME ?? "JobRoles",
  },
};

export default nextConfig;
