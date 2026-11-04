import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SplitCheck",
  description: "Snap a receipt. Split it fairly. Done.",
  manifest: "/manifest.json",
  // Home-screen install on iOS uses these instead of the manifest icons
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SplitCheck",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  // Next only emits mobile-web-app-capable; iOS before 16.4 needs the apple- prefixed tag
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Next sets width=device-width, initial-scale=1 by default; declared here alongside the theme color
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
