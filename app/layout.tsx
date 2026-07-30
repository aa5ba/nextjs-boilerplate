import type { Metadata } from "next";
import { Almarai, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";

const almarai = Almarai({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-almarai",
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-naskh-arabic",
});

export const metadata: Metadata = {
  title: {
    default: "احتساب - محطة العمل",
    template: "%s | احتساب - محطة العمل",
  },
  description: "نظام إدارة العملاء والعقود والسداد وسير العمل",
  icons: {
    icon: [
      {
        url: "/images/ehtisab-tab-icon-v2.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: [
      {
        url: "/images/ehtisab-tab-icon-v2.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: [
      {
        url: "/images/ehtisab-tab-icon-v2.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${almarai.variable} ${notoNaskhArabic.variable}`}
    >
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
