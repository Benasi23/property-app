import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail production builds on ESLint errors in legacy/leftover files.
  // (We typecheck separately with `tsc --noEmit`.)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
