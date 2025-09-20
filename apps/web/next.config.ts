// apps/web/next.config.ts
import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // если делаешь статический экспорт через `next export`, можно оставить так же
  // output: 'export',

  // это чтобы убрать предупреждение про "inferred workspace root"
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // чтобы Next не требовал установленный eslint во время билда
  eslint: { ignoreDuringBuilds: true },

  // оставь пустым, если ничего из experimental не используешь
  experimental: {}
}

export default nextConfig
