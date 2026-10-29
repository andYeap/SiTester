import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route depends on the session cookie and the database, so there is
  // nothing useful to prerender. Keep rendering dynamic instead of opting every
  // page into Suspense boundaries.
  cacheComponents: false,
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
