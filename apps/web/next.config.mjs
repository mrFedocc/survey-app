/** @type {import('next').NextConfig} */
const nextConfig = {
  // Гоним полностью статический экспорт, чтобы класть в /docs
  output: 'export',
  distDir: '.next',       // стандартный билд-каталог; экспорт пойдёт в out
  images: { unoptimized: true }
};

export default nextConfig;
