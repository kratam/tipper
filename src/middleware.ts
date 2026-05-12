import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

const intlMiddleware = createIntlMiddleware(routing);

// See src/app/api/auth/[...path]/route.ts — upstream sets SameSite=None;Partitioned,
// which Safari iOS strips on cross-site navigation. Lax is universally compatible.
function rewriteAuthCookies(headers: Headers): void {
  const cookies = headers.getSetCookie();
  if (cookies.length === 0) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const fixed = cookie
      .replace(/;\s*Partitioned/i, "")
      .replace(/;\s*SameSite=None/i, "; SameSite=Lax");
    headers.append("set-cookie", fixed);
  }
}

export default async function middleware(request: NextRequest) {
  // If this is an OAuth callback with session verifier, process auth first
  if (request.nextUrl.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const hasChallengeCookie = cookieHeader.includes("__Secure-neon-auth.session_challange");

    const { auth } = await import("@/lib/auth/server");
    const authMw = auth.middleware({ loginUrl: "/__noop__" });
    const authResponse = await authMw(request);

    // If auth middleware wants to redirect (OAuth token exchange), follow it
    if (authResponse.status >= 300 && authResponse.status < 400) {
      const location = authResponse.headers.get("location") ?? "";
      if (location.includes("/__noop__")) {
        console.warn("[auth] OAuth callback failed → /__noop__", {
          hasChallengeCookie,
          userAgent: request.headers.get("user-agent"),
          referer: request.headers.get("referer"),
          location,
        });
      }
      rewriteAuthCookies(authResponse.headers);
      return authResponse;
    }

    // If auth middleware returned 200, merge its cookies into the intl response
    const intlResponse = intlMiddleware(request);
    for (const cookie of authResponse.headers.getSetCookie()) {
      const fixed = cookie
        .replace(/;\s*Partitioned/i, "")
        .replace(/;\s*SameSite=None/i, "; SameSite=Lax");
      intlResponse.headers.append("Set-Cookie", fixed);
    }
    return intlResponse;
  }

  // Handle i18n locale routing for everything else
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
