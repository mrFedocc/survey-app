import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Статический экспорт: результат будет в apps/web/out
  output: 'export',

  // чтобы Next правильно трейсил файлы в монорепе
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // не валим билд из-за eslint в CI
  eslint: { ignoreDuringBuilds: true }
}

export default nextConfig
