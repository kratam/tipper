import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // If this is an OAuth callback with session verifier, process auth first
  if (request.nextUrl.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
    const { auth } = await import("@/lib/auth/server");
    const authMw = auth.middleware({ loginUrl: "/__noop__" });
    const authResponse = await authMw(request);

    // If auth middleware wants to redirect (OAuth token exchange), follow it
    if (authResponse.status >= 300 && authResponse.status < 400) {
      return authResponse;
    }

    // If auth middleware returned 200, merge its cookies into the intl response
    const intlResponse = intlMiddleware(request);
    for (const cookie of authResponse.headers.getSetCookie()) {
      intlResponse.headers.append("Set-Cookie", cookie);
    }
    return intlResponse;
  }

  // Handle i18n locale routing for everything else
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
