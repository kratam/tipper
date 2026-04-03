import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { auth } from "./src/lib/auth/server";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Let Neon Auth middleware handle OAuth session verifier exchange
  const authResponse = await auth.middleware()(request);

  // If auth middleware returned a redirect (session verifier exchange), follow it
  if (authResponse && authResponse.status >= 300 && authResponse.status < 400) {
    return authResponse;
  }

  // 2. Then handle i18n locale routing
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
