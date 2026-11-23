import type { NextConfig } from "next";

const config: NextConfig = {
  async redirects() {
    return [{
      source: "/social-preview.jpg",
      destination: "/ninety-atlas-share-v2.jpg",
      permanent: true,
    }];
  },
};

export default config;
