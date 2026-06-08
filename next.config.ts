import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // warp.test:3000 など localhost 以外のオリジンから開発サーバーへのアクセスを許可
  allowedDevOrigins: ["warp.test"],
};

export default nextConfig;
