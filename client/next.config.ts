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
};

export default nextConfig;
