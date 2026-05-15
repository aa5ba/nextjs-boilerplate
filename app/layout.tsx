import type { Metadata } from "next";
import { Almarai } from "next/font/google";
import "./globals.css";

const almarai = Almarai({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-almarai",
});

export const metadata: Metadata = {
  title: "احتساب",
  description: "منصة احتساب",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={almarai.variable}>
      <body
        className="min-h-full flex flex-col"
        style={{
          fontFamily: "var(--font-almarai), sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
