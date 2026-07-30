import type { Metadata } from "next";
import { inter, outfit, jetbrainsMono } from "@/app/fonts";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Meridian Corp — Leave Management System",
  description: "Meridian Corp Leave Management System v1.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
