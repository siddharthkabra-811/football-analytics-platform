import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ninety Atlas Football Analytics",
    short_name: "Ninety Atlas",
    description: "Premier League results and post-match football analytics.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1324",
    theme_color: "#0b1324",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
