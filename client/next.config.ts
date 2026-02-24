import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Enable standalone output for Amplify SSR
  output: "standalone",

  env: {
    AWS_REGION: process.env.AWS_REGION ?? "ap-southeast-2",
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "",
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    S3_BUCKET_NAME:
      process.env.S3_BUCKET_NAME ?? "resume-analyzer-mordheesh-2026",
    DYNAMODB_TABLE_NAME:
      process.env.DYNAMODB_TABLE_NAME ?? "JobRoles",
  },
};

export default nextConfig;