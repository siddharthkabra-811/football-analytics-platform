import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 600",
  display: "swap",
  variable: "--font-ui",
});

const barlowCondensed = localFont({
  src: "./fonts/barlow-condensed-bold.woff2",
  weight: "700",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ninetyatlas.vercel.app"),
  title: "Ninety Atlas",
  description: "Post-match football analytics. Explore Premier League results, line-ups, shots, and expected goals.",
  icons: { icon: "/ninety-atlas.svg" },
  openGraph: {
    type: "website",
    url: "https://ninetyatlas.vercel.app/",
    siteName: "Ninety Atlas",
    title: "Ninety Atlas",
    description: "Post-match football analytics. Explore Premier League results, line-ups, shots, and expected goals.",
    images: [{
      url: "https://ninetyatlas.vercel.app/ninety-atlas-share-v2.jpg",
      secureUrl: "https://ninetyatlas.vercel.app/ninety-atlas-share-v2.jpg",
      type: "image/jpeg",
      width: 1200,
      height: 630,
      alt: "Ninety Atlas logo and See the story behind the score over a football stadium",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninety Atlas",
    description: "Post-match football analytics. Explore Premier League results, line-ups, shots, and expected goals.",
    images: [{
      url: "https://ninetyatlas.vercel.app/ninety-atlas-share-v2.jpg",
      alt: "Ninety Atlas logo and See the story behind the score over a football stadium",
    }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlowCondensed.variable}`}>
      {/* Browser extensions can add attributes to body before hydration. */}
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
