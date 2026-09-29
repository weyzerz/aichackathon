import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /api/reset reads the seed file at runtime.
  outputFileTracingIncludes: { "/api/reset": ["./db/seed.sql"] },
};

export default nextConfig;
