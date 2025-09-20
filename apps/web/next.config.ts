// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // главная настройка — статический экспорт в папку out
  output: 'export',
  // чтобы картинки работали на GitHub Pages
  images: { unoptimized: true },
};

export default nextConfig;
