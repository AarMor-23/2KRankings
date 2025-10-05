import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // ⬇️ let the build succeed even if ESLint has errors
    ignoreDuringBuilds: true,
  },
};

// next.config.ts





export default nextConfig;
