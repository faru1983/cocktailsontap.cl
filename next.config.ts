import os from "node:os";
import type { NextConfig } from "next";

function getLocalDevOrigins(): string[] {
  const origins = new Set<string>(['127.0.0.1', '192.168.1.95']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        origins.add(iface.address);
      }
    }
  }
  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalDevOrigins(),
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'prhauxtawacvwuxjngjx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
