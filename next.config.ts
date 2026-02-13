import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: isProd ? 'export' : undefined,
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
