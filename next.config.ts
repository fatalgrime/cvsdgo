import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    devtoolSegmentExplorer: true
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid unstable filesystem cache corruption on some Windows setups.
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
