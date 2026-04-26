import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "Hangout Map",
  description: "Post, discover, and join nearby tasks and meetups on a live map.",
  manifest: "/manifest.webmanifest",
  applicationName: "Hangout Map",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hangout Map",
  },
  icons: {
    icon: "/icon-512.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
