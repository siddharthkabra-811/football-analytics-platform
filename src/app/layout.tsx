import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { brand } from "./brand";
import "./globals.css";
import { shareMetadata, siteUrl } from "./share-metadata";

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
  metadataBase: siteUrl,
  ...shareMetadata("/", brand.name, brand.description),
  icons: { icon: brand.mark },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlowCondensed.variable}`}>
      {/* Browser extensions can add attributes to body before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
