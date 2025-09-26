import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Proxy all frontend /api/* calls to our backend server (Express) to avoid CORS and 404s
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const isUsingEnv = !!process.env.NEXT_PUBLIC_API_URL;
    
    console.log('🔧 [next.config.ts] Backend URL:', {
      url: backend,
      source: isUsingEnv ? 'NEXT_PUBLIC_API_URL env var' : 'fallback (localhost:3001)',
      env_value: process.env.NEXT_PUBLIC_API_URL || 'undefined'
    });
    
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  
  // Temporarily disable ESLint during build for Railway deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build (temporary)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
