import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["shiki", "@shikijs/rehype", "@shikijs/transformers"],
};

export default nextConfig;
