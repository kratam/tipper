import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "blob.iihf.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
