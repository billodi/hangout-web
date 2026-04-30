import type { Metadata, Viewport } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import AppNav from "@/components/nav/AppNav";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "BilliXa",
  description: "A bold social map to publish local plans, join squads, and grow community reputation.",
  manifest: "/manifest.webmanifest",
  applicationName: "BilliXa",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BilliXa",
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
    { media: "(prefers-color-scheme: light)", color: "#10243f" },
    { media: "(prefers-color-scheme: dark)", color: "#071120" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />
        <AppNav active={null} />
        <div className="flex-1 anim-page">{children}</div>
      </body>
    </html>
  );
}
