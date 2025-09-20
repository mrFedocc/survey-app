// apps/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Для статического экспорта:
  output: 'export',
  images: {
    unoptimized: true
  },
  // если нужен basePath — добавь здесь
  // basePath: '',
  // trailingSlash: true, // если нравится со слэшем на конце
};

export default nextConfig;
