import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev-only: engedélyezi a Tailscale/beam hostot (HMR + Server Actions) amikor a
  // dev szervert a tailnetre tükrözzük (vékony kliens munkamód). Prodra nincs hatása.
  allowedDevOrigins: ["gg-server.pitta-cliff.ts.net"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "blob.iihf.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
