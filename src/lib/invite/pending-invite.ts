import { routing } from "@/i18n/routing";

/** A meghívó-szándékot tartósan őrző cookie neve (host-only, nincs Domain attribútum). */
export const PENDING_INVITE_COOKIE = "tc_pending_invite";

/** 30 nap másodpercben — elég hosszú, hogy a „most kattint, később lép be" eset is működjön. */
export const PENDING_INVITE_MAX_AGE_SECONDS = 2_592_000;

const LOCALE_PREFIX = new RegExp(`^/(?:${routing.locales.join("|")})(?=/)`);

/**
 * A `/join/[code]` (és `/{locale}/join/[code]`) útvonalból kiolvassa a meghívó kódot.
 * Bármi más → null. A kód alfanumerikus (lásd `generateInviteCode`).
 */
export function extractInviteCodeFromPath(pathname: string): string | null {
  const withoutLocale = pathname.replace(LOCALE_PREFIX, "");
  const match = withoutLocale.match(/^\/join\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1] : null;
}

export type InviteAction = { type: "capture"; code: string } | { type: "claim" } | { type: "none" };

/**
 * Middleware-döntés (pure, hogy tesztelhető legyen):
 * - `/join/[code]` látogatás → mindig capture (a cookie lerakása). A logged-in
 *   claimet a `/join` oldal intézi valódi session alapján (loop-safe).
 * - bejelentkezve + van pending cookie, máshol → claim (funnel a claim route-ra).
 * - egyébként → none.
 */
export function decideInviteAction(input: {
  pathname: string;
  hasSession: boolean;
  hasPending: boolean;
}): InviteAction {
  const code = extractInviteCodeFromPath(input.pathname);
  if (code) return { type: "capture", code };
  if (input.hasSession && input.hasPending) return { type: "claim" };
  return { type: "none" };
}
