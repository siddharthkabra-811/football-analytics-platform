import type { Metadata } from "next";
import { brand } from "./brand";

export const siteUrl = new URL("https://ninetyatlas.vercel.app");

const shareImage = {
  url: "/ninety-atlas-share-v2.jpg",
  type: "image/jpeg",
  width: 1200,
  height: 630,
  alt: "Ninety Atlas logo and See the story behind the score over a football stadium",
};

export function shareMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: path,
      title,
      description,
      images: [{ ...shareImage, secureUrl: new URL(shareImage.url, siteUrl) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}
