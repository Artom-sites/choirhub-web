import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Static HTML export for GitHub Pages
  basePath: '/choirhub-web', // Repository name for GitHub Pages
  images: {
    unoptimized: true,
  },
  turbopack: {},
  trailingSlash: true, // Better compatibility with static hosting
};

export default nextConfig;
