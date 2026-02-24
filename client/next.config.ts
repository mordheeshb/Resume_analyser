import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // output: "standalone" is NOT needed for Amplify — it has its own SSR adapter.
  // Env vars set in Amplify Console → Environment variables are automatically
  // available via process.env in API routes at runtime. No env block needed here.
};

export default nextConfig;