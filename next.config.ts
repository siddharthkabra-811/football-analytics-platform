import type { NextConfig } from "next";

const config: NextConfig = {
  // Some link-preview services fetch with a generic user agent and only parse the head.
  htmlLimitedBots: /.*/,
  async redirects() {
    return [{
      source: "/social-preview.jpg",
      destination: "/ninety-atlas-share-v2.jpg",
      permanent: true,
    }];
  },
};

export default config;
