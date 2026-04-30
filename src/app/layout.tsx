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
  metadataBase: new URL("https://hangout-web-green.vercel.app"),
  title: {
    default: "BilliXa",
    template: "%s | BilliXa",
  },
  description: "A bold social map to publish local plans, join squads, and grow community reputation.",
  keywords: ["social map", "community events", "local activities", "meetups", "hangouts"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://hangout-web-green.vercel.app",
    siteName: "BilliXa",
    title: "BilliXa",
    description: "Publish local plans, join activities, and build community reputation.",
    images: [{ url: "/icon-512.svg", width: 512, height: 512, alt: "BilliXa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BilliXa",
    description: "Publish local plans, join activities, and build community reputation.",
    images: ["/icon-512.svg"],
  },
  manifest: "/manifest.webmanifest",
  applicationName: "BilliXa",
  category: "social",
  robots: {
    index: true,
    follow: true,
  },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-[var(--surface)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>
        <PwaRegister />
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />
        <AppNav active={null} />
        <div id="main-content" className="flex-1 anim-page">
          {children}
        </div>
      </body>
    </html>
  );
}
