/** @type {import('next').NextConfig} */
const nextConfig = {
  // Собираем статический сайт (под GitHub Pages)
  output: 'export',

  // Куда класть готовый статики
  distDir: 'out',

  // Если используешь внешние картинки — добавь нужные домены.
  images: {
    unoptimized: true
  }
};

export default nextConfig;
