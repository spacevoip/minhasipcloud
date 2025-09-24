import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Proxy all frontend /api/* calls to our backend server (Express) to avoid CORS and 404s
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

// Configuração do Sentry para PABX
const sentryWebpackPluginOptions = {
  // Configurações específicas para o sistema PABX
  org: "minhasip",
  project: "javascript-nextjs",
  
  // Apenas upload de source maps em produção
  silent: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
