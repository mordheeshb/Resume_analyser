import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Fixes "Unable to acquire lock" by explicitly targeting this directory
  turbopack: {
    root: path.resolve(__dirname, "."),
  },
};

export default nextConfig;