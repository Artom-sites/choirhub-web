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
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer-when-downgrade' // Relaxed for dev
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
          // Basic CSP - Adjust as needed for specific Firebase/External scripts
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' blob: https://firestore.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://*.firebaseapp.com https://fcm.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://apis.google.com https://*.googleusercontent.com https://accounts.google.com https://*.r2.dev https://unpkg.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com; worker-src 'self' blob: https://unpkg.com;"
          }
        ],
      },
    ];
  },
};

export default nextConfig;
