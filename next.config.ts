import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Phase 21 (§31): do not advertise the framework version.
  poweredByHeader: false,
};

export default nextConfig;
