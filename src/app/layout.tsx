import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "ПД-ИД — План дня, Итог дня",
  description: "Личный инструмент ежедневного планирования и рефлексии",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`h-full antialiased ${manrope.variable}`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
