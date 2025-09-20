/** @type {import('next').NextConfig} */
const nextConfig = {
  // Статическая сборка под GitHub Pages
  output: 'export',
  // Для статики нужны не-оптимизированные картинки
  images: { unoptimized: true },
  // trailingSlash полезен для статики (директории вместо файлов)
  trailingSlash: true,
};

export default nextConfig;
