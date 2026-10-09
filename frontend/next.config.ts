import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  devIndicators: false,
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "lokijs", "encoding"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "@x402/evm": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@metamask\/sdk/ },
    ];
    return config;
  },
};

export default nextConfig;
