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
};

export default withPWA(nextConfig);
