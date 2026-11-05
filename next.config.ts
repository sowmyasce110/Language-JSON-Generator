import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT list cheerio in serverExternalPackages on Windows —
  // Netlify's plugin tries to symlink it and fails with EPERM.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
