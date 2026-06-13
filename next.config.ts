import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 dropped the `eslint` config key and no longer runs ESLint during
  // `next build`. Type-checking still runs; we keep the tree clean with `tsc --noEmit`.
};

export default nextConfig;
