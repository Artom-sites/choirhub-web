import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  scope: "/",
  sw: "sw.js",
  // cacheOnFrontEndNav: true,
  // aggressiveFrontEndNavCaching: true,
  // reloadOnOnline: true,
  // workboxOptions: {
  //   disableDevLogs: true,
  // },
});

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

export default withPWA(nextConfig);
