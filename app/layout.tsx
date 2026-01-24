import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyChoir — Хоровий репертуар",
  description: "Застосунок для управління хоровим репертуаром та нотами",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MyChoir",
    description: "Хоровий репертуар та ноти у вашій кишені",
    siteName: "MyChoir",
    locale: "uk_UA",
    type: "website",
  },
  appleWebApp: {
    title: "MyChoir",
    statusBarStyle: "black-translucent",
    capable: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Fix input zoom on iOS
  userScalable: false, // Prevent zooming for app-like feel
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <head>
        {/* Manual meta tags are replaced by metadata object */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-text-primary`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
