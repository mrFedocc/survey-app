import path from 'path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(__dirname, '../..');

const nextConfig: NextConfig = {
  // Если нужны Next API Routes (например, /api/export), НЕ ставь output: 'export'
  // output: 'export',
  outputFileTracingRoot: monorepoRoot,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
