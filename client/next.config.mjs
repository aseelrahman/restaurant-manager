/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:4000";

const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  serverExternalPackages: ["mongodb", "better-auth", "@better-auth/mongo-adapter"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/:path((?!auth(?:/|$)).*)",
          destination: `${API_ORIGIN}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
