import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { rewriteAuthCookies } from "@/lib/auth/cookie-fix";
import {
  decideInviteAction,
  extractInviteCodeFromPath,
  PENDING_INVITE_COOKIE,
  PENDING_INVITE_MAX_AGE_SECONDS,
} from "@/lib/invite/pending-invite";

const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";
const SESSION_COOKIE = "neon-auth.session_token";
const CLAIM_PATH = "/api/join/claim";

const intlMiddleware = createIntlMiddleware(routing);

function cookieHeader(request: NextRequest): string {
  return request.headers.get("cookie") ?? "";
}

function hasSession(request: NextRequest): boolean {
  // Substring match (nem exact `.has()`): a Neon Auth session cookie HTTPS-en
  // `__Secure-` prefixet kaphat (vö. a `__Secure-neon-auth.session_challange`
  // challenge cookie-val), ezért prefix-toleráns illesztés kell.
  return cookieHeader(request).includes(SESSION_COOKIE);
}

function hasPending(request: NextRequest): boolean {
  // Exact név-illesztés — a saját cookie-nk neve fix (`tc_pending_invite`, nincs
  // prefix), így nincs substring false-positive egy esetleges testvér-cookie-ra.
  return request.cookies.has(PENDING_INVITE_COOKIE);
}

function setPendingCookie(response: NextResponse, code: string): void {
  response.cookies.set(PENDING_INVITE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_INVITE_MAX_AGE_SECONDS,
  });
}

function claimRedirect(request: NextRequest, extraSetCookies?: string[]): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = CLAIM_PATH;
  // Minden query param eldobása — a `neon_auth_session_verifier` nem szivároghat
  // át a claim endpointra.
  url.search = "";
  const response = NextResponse.redirect(url);
  if (extraSetCookies) {
    for (const cookie of extraSetCookies) response.headers.append("set-cookie", cookie);
  }
  return response;
}

export default async function middleware(request: NextRequest) {
  // 1) OAuth callback (verifier) — token-csere, majd ha van meghívó-szándék,
  //    azonnal a claimbe terelünk (a frissen kapott session cookie-kal együtt).
  if (request.nextUrl.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
    const cookies = cookieHeader(request);
    const hasChallengeCookie = cookies.includes("__Secure-neon-auth.session_challange");

    const { auth } = await import("@/lib/auth/server");
    const authMw = auth.middleware({ loginUrl: "/__noop__" });
    const authResponse = await authMw(request);

    // OAuth bukás → marad a meglévő viselkedés (warning + a redirect követése).
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

    // Sikeres token-csere — gyűjtsük be a (rewrite-olt) session cookie-kat.
    rewriteAuthCookies(authResponse.headers);
    const authCookies = authResponse.headers.getSetCookie();

    // Meghívó-szándék (pending cookie, vagy a callback path-ban a kód) → claim.
    const code = extractInviteCodeFromPath(request.nextUrl.pathname);
    if (hasPending(request) || code) {
      const response = claimRedirect(request, authCookies);
      if (code && !hasPending(request)) setPendingCookie(response, code);
      return response;
    }

    // Nincs meghívó → szokásos i18n render a session cookie-kal.
    const intlResponse = intlMiddleware(request);
    for (const cookie of authCookies) intlResponse.headers.append("set-cookie", cookie);
    return intlResponse;
  }

  // 2) Capture / funnel döntés (pure, tesztelt).
  const action = decideInviteAction({
    pathname: request.nextUrl.pathname,
    hasSession: hasSession(request),
    hasPending: hasPending(request),
  });

  if (action.type === "capture") {
    // `/join/[code]` látogatás — rakjuk le a tartós cookie-t, és menjen tovább a
    // szokásos i18n flow (a logged-in claimet a `/join` oldal intézi).
    const response = intlMiddleware(request);
    setPendingCookie(response, action.code);
    return response;
  }

  if (action.type === "claim") {
    // Bejelentkezve + van pending, de máshol landolt → terelés a claimbe.
    return claimRedirect(request);
  }

  // 3) Default i18n routing.
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
