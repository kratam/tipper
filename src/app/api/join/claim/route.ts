import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { claimInvite } from "@/lib/invite/claim-invite";
import { PENDING_INVITE_COOKIE } from "@/lib/invite/pending-invite";
import { localizePath } from "@/lib/join-url";

/**
 * Meghívó-claim: a `tc_pending_invite` cookie-ból kiolvassa a kódot, idempotensen
 * beléptet, törli a cookie-t, és a cél oldalra irányít. A middleware/`/join` oldal
 * tereli ide a usert login után. Idempotens — kétszeri lefutás ártalmatlan.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.cookies.get(PENDING_INVITE_COOKIE)?.value;
  const locale = request.cookies.get("NEXT_LOCALE")?.value ?? routing.defaultLocale;

  // Nincs pending kód → nincs mit tenni.
  if (!code) {
    return NextResponse.redirect(new URL(localizePath(locale, "/tournaments"), request.url));
  }

  const user = await getCurrentUser();

  // Még nincs session (vagy elévült) → vissza a join oldalra (sign-in). Cookie marad.
  if (!user) {
    return NextResponse.redirect(new URL(localizePath(locale, `/join/${code}`), request.url));
  }

  const result = await claimInvite(user.id, code, locale);
  const target = result.ok
    ? result.redirectPath
    : `${localizePath(locale, "/tournaments")}?invite=notfound`;

  const response = NextResponse.redirect(new URL(target, request.url));
  // Cookie törlése — siker VAGY ismeretlen kód után is, hogy ne ragadjon be.
  response.cookies.set(PENDING_INVITE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
