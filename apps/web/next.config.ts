import type { NextConfig } from 'next'
import path from 'path'

const monorepoRoot = path.resolve(__dirname, '../..');

const nextConfig: NextConfig = {
  // оставляй output: 'export', если не нужны Next API Routes
  output: 'export',
  outputFileTracingRoot: monorepoRoot,
  experimental: { turbopack: { root: monorepoRoot } },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
