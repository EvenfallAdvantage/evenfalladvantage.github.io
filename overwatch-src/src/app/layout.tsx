import type { Metadata, Viewport } from "next";
import { Oswald, Barlow } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Overwatch — Security Workforce Platform | Evenfall Advantage",
    template: "%s | Overwatch",
  },
  description:
    "Military-grade workforce management for security companies. LMS training, Stripe payments, geo-risk intel, de-escalation sims, site assessments, invoicing, certifications, and 50-state law database. Powered by Evenfall Advantage LLC.",
  keywords: [
    "security workforce management", "guard training LMS", "security company software",
    "site security assessment", "geo risk analysis", "security certifications",
    "Evenfall Advantage", "Overwatch security platform",
  ],
  icons: {
    icon: "/overwatch/images/overwatch_logo.png",
    apple: "/overwatch/images/overwatch_logo.png",
  },
  manifest: "/overwatch/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Overwatch",
  },
  openGraph: {
    title: "Overwatch — Command Your Force",
    description: "Unified workforce management, training, and field operations platform built for security professionals.",
    type: "website",
    siteName: "Overwatch by Evenfall Advantage",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#1d3451" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${oswald.variable} ${barlow.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
