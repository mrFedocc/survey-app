import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // статическая сборка для GitHub Pages
  output: 'export',
  images: { unoptimized: true },

  // чтобы не было ворнинга про "inferred workspace root"
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../..'),
  },
};

export default nextConfig;
