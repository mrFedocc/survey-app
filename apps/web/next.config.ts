/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // включаем статический экспорт
  images: { unoptimized: true }, // т.к. используется next/image
};
module.exports = nextConfig;
