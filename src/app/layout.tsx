import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#9333ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "NPC Notice Board",
  description: "Official Campus Updates — NPC Notice Board",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NPC Notice Board",
  },
  icons: {
    icon: "/favicon.png?v=2",
    apple: "/icons/icon-192.png?v=2",
  },
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for faster image loading (matching HTML) */}
        <link rel="preconnect" href="https://i.ibb.co" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://i.ibb.co" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-white dark:bg-black`}
        style={{ fontFamily: "'Inter', sans-serif" }}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
