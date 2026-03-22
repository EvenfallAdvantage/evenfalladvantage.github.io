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
    default: "Overwatch — Security Workforce Platform | Evenfall Advantage",
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
      { url: "/overwatch/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/overwatch/images/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/overwatch/images/apple-touch-icon.png",
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
      <head>
        {/* NIST 800-171 §3.13 — Content Security Policy */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; media-src 'self' https://*.supabase.co blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.daily.co https://api.stripe.com https://cloudflareinsights.com https://nominatim.openstreetmap.org https://api.wheretheiss.at https://api.us.socrata.com https://*.data.socrata.com https://data.cityofchicago.org https://data.cityofnewyork.us https://data.lacity.org https://data.seattle.gov https://data.austintexas.gov https://data.denvergov.org https://data.sfgov.org https://data.nashville.gov https://www.dallasopendata.com https://data.kcmo.org https://data.cincinnati-oh.gov https://data.baltimorecity.gov https://data.detroitmi.gov https://data.memphistn.gov https://opendata.dc.gov https://services.familywatchdog.us https://public.opendatasoft.com https://*.arcgis.com https://api.crimeometer.com https://data.police.uk https://ce-portal-service.commandcentral.com https://overpass-api.de; frame-src 'self' https://*.daily.co https://*.stripe.com https://*.supabase.co https://*.youtube.com blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body
        className={`${oswald.variable} ${barlow.variable} antialiased`}
      >
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
