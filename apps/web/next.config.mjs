// apps/web/next.config.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages = чистый статик
  output: 'export',

  // чтобы Next не пытался оптимизировать картинки на сервере
  images: { unoptimized: true },

  // гасим предупреждение про "inferred workspace root"
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // (опционально) отключить телеметрию
  telemetry: false,
};

export default nextConfig;
