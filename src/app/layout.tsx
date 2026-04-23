import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { Providers } from "@/components/Providers";

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
  title: {
    default: "NPC Notice Board — Official Campus Notices, Routine & Materials",
    template: "%s | NPC Notice Board",
  },
  description: "Download the NPC Notice APK. The official digital Notice Board for National Polytechnic College (NPC) students. Get NPC notices, class routine, and study materials.",
  manifest: "/manifest.json",
  keywords: [
    "NPC Notice Board",
    "npc notice board",
    "NPC notice",
    "NPC notice apk",
    "Notice Board",
    "NPC",
    "National Polytechnic College",
    "NPC app",
    "campus notices",
    "polytechnic notice board",
  ],
  verification: {
    google: "KfvIjTAgMUOFBdbXUUO8NEH1f-JGqMM7sGHUU-GLww0",
  },
  metadataBase: new URL("https://npcnoticeboard.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NPC Notice Board — Official Campus Updates",
    description: "Download the NPC Notice APK. The official digital Notice Board for National Polytechnic College (NPC). Get all NPC notices in one place.",
    url: "https://npcnoticeboard.vercel.app",
    siteName: "NPC Notice Board",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "NPC Notice Board",
    description: "Download the NPC Notice APK. The official Notice Board for National Polytechnic College students.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NPC Notice Board",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/icon-192.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "NPC Notice Board",
      "url": "https://npcnoticeboard.vercel.app",
    },
    {
      "@type": "WebApplication",
      "name": "NPC Notice Board",
      "url": "https://npcnoticeboard.vercel.app",
      "description": "Download the NPC Notice APK. Official digital Notice Board for National Polytechnic College (NPC) students. Get NPC notices, class routine, study materials, attendance tracking and social features.",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Android, Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "BDT",
      },
      "author": {
        "@type": "Organization",
        "name": "NPC Notice Board",
        "url": "https://npcnoticeboard.vercel.app",
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "ratingCount": "10",
        "bestRating": "5",
      },
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for faster image loading */}
        <link rel="preconnect" href="https://i.ibb.co" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://i.ibb.co" />
        {/* JSON-LD Structured Data for Google Rich Results */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
