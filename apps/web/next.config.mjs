/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // нужен для next export
  images: { unoptimized: true }, // статик экспорт + картинки
  // другие нужные тебе опции — добавляй здесь
};

export default nextConfig;
