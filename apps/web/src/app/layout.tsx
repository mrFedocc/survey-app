import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  weight: ["300","400","500","600","700","800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Petly — опрос",
  description: "Опрос Petly в фирменном стиле",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
