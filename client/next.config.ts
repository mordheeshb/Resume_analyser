import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Fixes "Unable to acquire lock" by explicitly targeting this directory
  turbopack: {
    root: ".",
  },
};

export default nextConfig;