import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import packageJson from "./package.json";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_IS_CAPACITOR: isCapacitor ? "true" : "false",
  },
  // Global CORS headers so Capacitor Android WebView can reach API routes
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
  }),
} as any;

export default withPWA(nextConfig);
