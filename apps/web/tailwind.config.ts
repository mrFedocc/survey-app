// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      colors: {
        background: "#0b0f1a",
        foreground: "#ffffff",
        brand: {
          50:"#fef2f8",100:"#fde6f2",200:"#fcc6e2",300:"#faa0cd",400:"#f472b6",
          500:"#ec4899",600:"#db2777",700:"#be185d",800:"#9d174d",900:"#831843"
        },
        accent: { blue: "#38bdf8", violet: "#a78bfa" }
      },
      boxShadow: { glow: "0 0 40px rgba(236,72,153,0.25)" },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(800px 400px at 20% 10%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(800px 400px at 80% 10%, rgba(167,139,250,0.22), transparent 60%)"
      },
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
      borderRadius: { "2xl": "1rem" },
    },
  },
  plugins: [],
};
export default config;
