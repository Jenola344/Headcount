/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Allow long-running API routes for token analysis
  serverExternalPackages: ['viem'],
};

export default nextConfig;
