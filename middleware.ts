import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // If this is an OAuth callback with session verifier, let the auth handler process it
  // by proxying through our API route which handles cookie exchange
  if (request.nextUrl.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
    const { auth } = await import("./src/lib/auth/server");
    const authMw = auth.middleware({ loginUrl: "/__noop__" });
    const authResponse = await authMw(request);

    // If auth middleware wants to redirect (OAuth token exchange), follow it
    if (authResponse.status >= 300 && authResponse.status < 400) {
      return authResponse;
    }
  }

  // Handle i18n locale routing for everything else
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
