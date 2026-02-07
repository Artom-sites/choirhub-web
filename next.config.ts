import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://choirhub-8bfa2.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
