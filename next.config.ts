import type { NextConfig } from "next";
import { ALLOWED_HOSTNAMES } from "./lib/config";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {},
  allowedDevOrigins: ALLOWED_HOSTNAMES,

  experimental: {
    optimizePackageImports: [
      "@monaco-editor/react",
      "lucide-react",
      "zustand",
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.globalObject = "self";
    }

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        fs: false,
        path: false,
      },
    };

    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /monaco-editor/, message: /Critical dependency/ },
    ];

    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

export default nextConfig;
