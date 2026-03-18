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
  },
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
  }),
} as any;

export default withPWA(nextConfig);
