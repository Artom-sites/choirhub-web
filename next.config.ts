import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Rewrites are not supported in static export
  // async rewrites() {
  //   return [
  //     {
  //       source: '/__/auth/:path*',
  //       destination: 'https://choirhub-8bfa2.firebaseapp.com/__/auth/:path*',
  //     },
  //   ];
  // },
};

export default nextConfig;
