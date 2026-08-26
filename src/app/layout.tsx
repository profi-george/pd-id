import type { Metadata } from "next";
import { Manrope, Golos_Text } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

// Заголовочная гарнитура редизайна — геометричная, с полноценной поддержкой
// кириллицы (не Hanken Grotesk/Public Sans из витрины дизайн-системы: у них
// нет базового кириллического подмножества, только латиница).
const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-golos",
});

export const metadata: Metadata = {
  title: "ПД-ИД — План дня, Итог дня",
  description: "Личный инструмент ежедневного планирования и рефлексии",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`h-full antialiased ${manrope.variable} ${golos.variable}`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
