import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const targetUrl = "https://8zse71llo4.execute-api.ap-southeast-2.amazonaws.com/default/resume-analyzer-function";

        console.log("[Proxy] Forwarding to AWS:", targetUrl, "Payload:", body);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await response.text();
        console.log("[Proxy] AWS Response:", response.status, data);

        return new NextResponse(data, {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error: any) {
        console.error("[Proxy] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
