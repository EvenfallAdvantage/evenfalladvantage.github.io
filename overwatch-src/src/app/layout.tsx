import type { Metadata, Viewport } from "next";
import { Oswald, Barlow } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
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
    default: "Overwatch",
    template: "%s | Overwatch",
  },
  description:
    "Professional workforce management for security companies. LMS training, payments, geo-risk intel, de-escalation sims, site assessments, invoicing, certifications, and 50-state law database. Powered by Evenfall Advantage LLC.",
  keywords: [
    "security workforce management", "guard training LMS", "security company software",
    "site security assessment", "geo risk analysis", "security certifications",
    "Evenfall Advantage", "Overwatch security platform",
  ],
  icons: {
    icon: [
      { url: "/overwatch/favicon.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/overwatch/images/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
    ],
    apple: "/overwatch/images/apple-touch-icon.png?v=2",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          NIST 800-171 §3.13 — Content Security Policy

          CSP is NOT delivered via meta tag because:
          1. Report-Only CSP via <meta> is disallowed by the spec (browsers ignore it)
          2. Enforcing CSP via <meta> blocks Chrome's Web Speech API (dictation)
             because the speech service uses unpredictable internal Google endpoints
          3. GitHub Pages does not support HTTP response headers

          Security is enforced at the application layer instead:
          - Supabase RLS policies on every table
          - JWT verification on all Edge Functions
          - CORS origin allowlist in _shared/cors.ts
          - Auth guards on every protected page
          - HTTPS enforced by GitHub Pages

          If the hosting moves to a platform that supports response headers
          (Vercel, Cloudflare Pages, etc.), CSP should be delivered as an HTTP
          header with the allowlist from docs/csp-reference.txt.
        */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body
        className={`${oswald.variable} ${barlow.variable} antialiased overflow-x-hidden`}
      >
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
