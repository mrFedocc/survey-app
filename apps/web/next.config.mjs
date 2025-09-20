import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // если нужен статический экспорт:
  output: "export",
  // чтобы убрать ворнинг про «multiple lockfiles» в монорепо
  outputFileTracingRoot: path.join(process.cwd(), "../..")
};

export default nextConfig;
