import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "better-sqlite3"],
  experimental: {
    middlewarePrefetch: "strict",
  },
};

export default nextConfig;
