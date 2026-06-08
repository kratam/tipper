# Meghívó-link megbízhatóság — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meghívó linken (`/join/[code]`) érkező user a regisztráció után megbízhatóan bekerül a körbe/csoportba — a meghívó-szándék OAuth-független, tartós cookie-ban él, a belépés idempotens és nem render-mellékhatás.

**Architecture:** A `middleware.ts` minden `/join/[code]` látogatáskor lerak egy host-only `tc_pending_invite` cookie-t (capture). A belépés egy dedikált `/api/join/claim` route handlerben fut idempotensen, ami a cookie-t törli és a cél oldalra irányít. A logged-in usert a `/join` oldal `getCurrentUser()` alapján irányítja a claim route-ra (loop-safe: valódi session, nem cookie-jelenlét); a „mellélandolt" usert a middleware funnel és az OAuth verifier-ág azonnal a claimbe tereli.

**Tech Stack:** Next.js 16 App Router, middleware, Route Handlers, Drizzle ORM, next-intl, Vitest. Spec: `docs/superpowers/specs/2026-06-08-invite-join-reliability-design.md`.

---

## File Structure

- **Create** `src/lib/invite/pending-invite.ts` — cookie-konstansok + pure path/decision helperek (unit-tesztelt).
- **Create** `src/lib/invite/pending-invite.test.ts` — a pure helperek tesztjei.
- **Create** `src/lib/invite/claim-invite.ts` — server-only: idempotens membership helperek + `claimInvite()` (resolve + dispatch + cél-URL).
- **Create** `src/app/api/join/claim/route.ts` — GET route handler: getCurrentUser → claimInvite → cookie törlés → redirect.
- **Modify** `src/lib/join-url.ts` — `localizePath()` kiemelése (DRY), `buildJoinCallbackUrl` átállítása rá.
- **Modify** `src/lib/join-url.test.ts` — `localizePath` tesztek hozzáadása.
- **Modify** `src/middleware.ts` — capture + funnel + verifier-immediate claim ágak.
- **Modify** `src/app/[locale]/join/[code]/page.tsx` — render-beli join eltávolítása; logged-in → redirect a claimbe; logged-out → JoinSignIn.
- **Modify** `src/actions/groups.ts` — `joinGroup` átállítása a közös idempotens helperre.
- **Modify** `src/actions/circles.ts` — `joinCircle` átállítása a közös idempotens helperre.

---

### Task 1: Pure helperek — cookie konstansok, path-parszolás, döntés

**Files:**
- Create: `src/lib/invite/pending-invite.ts`
- Test: `src/lib/invite/pending-invite.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/invite/pending-invite.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  decideInviteAction,
  extractInviteCodeFromPath,
  PENDING_INVITE_COOKIE,
  PENDING_INVITE_MAX_AGE_SECONDS,
} from "./pending-invite";

describe("extractInviteCodeFromPath", () => {
  it("matches the default-locale path", () => {
    expect(extractInviteCodeFromPath("/join/4V8M35")).toBe("4V8M35");
  });

  it("matches locale-prefixed paths", () => {
    expect(extractInviteCodeFromPath("/hu/join/4V8M35")).toBe("4V8M35");
    expect(extractInviteCodeFromPath("/en/join/ABC123")).toBe("ABC123");
  });

  it("tolerates a trailing slash", () => {
    expect(extractInviteCodeFromPath("/join/4V8M35/")).toBe("4V8M35");
  });

  it("returns null for non-join paths", () => {
    expect(extractInviteCodeFromPath("/tournaments")).toBeNull();
    expect(extractInviteCodeFromPath("/join")).toBeNull();
    expect(extractInviteCodeFromPath("/join/")).toBeNull();
    expect(extractInviteCodeFromPath("/joinx/abc")).toBeNull();
    expect(extractInviteCodeFromPath("/hu/join/abc/extra")).toBeNull();
  });
});

describe("decideInviteAction", () => {
  it("captures on a /join path regardless of session", () => {
    expect(decideInviteAction({ pathname: "/join/X1", hasSession: false, hasPending: false })).toEqual({
      type: "capture",
      code: "X1",
    });
    expect(decideInviteAction({ pathname: "/hu/join/X1", hasSession: true, hasPending: true })).toEqual({
      type: "capture",
      code: "X1",
    });
  });

  it("claims when authenticated with a pending invite, off the join page", () => {
    expect(decideInviteAction({ pathname: "/tournaments", hasSession: true, hasPending: true })).toEqual({
      type: "claim",
    });
  });

  it("does nothing without both a session and a pending invite", () => {
    expect(decideInviteAction({ pathname: "/tournaments", hasSession: true, hasPending: false })).toEqual({
      type: "none",
    });
    expect(decideInviteAction({ pathname: "/tournaments", hasSession: false, hasPending: true })).toEqual({
      type: "none",
    });
  });

  it("exposes stable cookie constants", () => {
    expect(PENDING_INVITE_COOKIE).toBe("tc_pending_invite");
    expect(PENDING_INVITE_MAX_AGE_SECONDS).toBe(2_592_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/invite/pending-invite.test.ts`
Expected: FAIL — `Cannot find module './pending-invite'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/invite/pending-invite.ts`:

```ts
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

export type InviteAction =
  | { type: "capture"; code: string }
  | { type: "claim" }
  | { type: "none" };

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/invite/pending-invite.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invite/pending-invite.ts src/lib/invite/pending-invite.test.ts
git commit -m "feat(invite): pending-invite cookie konstansok + path/döntés helperek"
```

---

### Task 2: `localizePath` kiemelése (DRY)

**Files:**
- Modify: `src/lib/join-url.ts`
- Test: `src/lib/join-url.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/join-url.test.ts` (keep the existing `buildJoinCallbackUrl` describe block):

```ts
import { describe, expect, it } from "vitest";
import { buildJoinCallbackUrl, localizePath } from "./join-url";

describe("localizePath", () => {
  it("omits the prefix for the default locale (hu)", () => {
    expect(localizePath("hu", "/tournaments")).toBe("/tournaments");
    expect(localizePath("hu", "/circles")).toBe("/circles");
  });

  it("prefixes non-default locales", () => {
    expect(localizePath("en", "/tournaments")).toBe("/en/tournaments");
    expect(localizePath("en", "/circles")).toBe("/en/circles");
  });
});
```

(The existing `buildJoinCallbackUrl` tests remain unchanged and must keep passing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/join-url.test.ts`
Expected: FAIL — `localizePath` is not exported.

- [ ] **Step 3: Write minimal implementation**

Rewrite `src/lib/join-url.ts`:

```ts
import { routing } from "@/i18n/routing";

/**
 * Locale-helyes útvonal: a default locale (hu) prefix nélküli, a többi prefixelt —
 * megegyezik a next-intl `as-needed` viselkedésével.
 */
export function localizePath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

/**
 * A `/join/[code]` oldal locale-helyes útvonala, amit OAuth `callbackURL`-ként
 * adunk át: így a Google login után a böngésző visszatér ide.
 */
export function buildJoinCallbackUrl(locale: string, code: string): string {
  return localizePath(locale, `/join/${code}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/join-url.test.ts`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/join-url.ts src/lib/join-url.test.ts
git commit -m "refactor(invite): localizePath kiemelése a join-url helperből"
```

---

### Task 3: Claim core — idempotens membership + `claimInvite`

**Files:**
- Create: `src/lib/invite/claim-invite.ts`

Note: ez DB-t ír (membership insert + token-osztás), ezért nincs unit teszt — a Task 8 kézi/E2E ellenőrzése fedi. A `distributeInitialTokens` paraméter-sorrend a `src/actions/groups.ts` meglévő hívásából származik.

- [ ] **Step 1: Implement the module**

`src/lib/invite/claim-invite.ts`:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, groupMembers } from "@/db/schema";
import { localizePath } from "@/lib/join-url";
import { distributeInitialTokens } from "@/lib/tokens";
import { getCircleByInviteCode } from "@/queries/circles";
import { getGroupByInviteCode } from "@/queries/groups";

type InviteGroup = NonNullable<Awaited<ReturnType<typeof getGroupByInviteCode>>>;
type InviteCircle = NonNullable<Awaited<ReturnType<typeof getCircleByInviteCode>>>;

/** Idempotens csoport-belépés adott userrel; nincs redirect. Már tag → no-op. */
export async function joinGroupIdempotent(userId: string, group: InviteGroup): Promise<void> {
  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
  });
  if (existing) return;

  await db.insert(groupMembers).values({ groupId: group.id, userId });
  await distributeInitialTokens(
    userId,
    group.id,
    group.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
    group.tournament.timezone,
  );
}

/** Idempotens kör-belépés adott userrel; nincs redirect. Már tag → no-op. */
export async function joinCircleIdempotent(userId: string, circle: InviteCircle): Promise<void> {
  const existing = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, userId)),
  });
  if (existing) return;

  await db.insert(circleMembers).values({ circleId: circle.id, userId });
}

export type ClaimResult =
  | { ok: true; redirectPath: string }
  | { ok: false; reason: "not_found" };

/**
 * A meghívó kódot feloldja (group VAGY circle), idempotensen beléptet, és
 * visszaadja a locale-helyes cél-útvonalat. Ismeretlen kód → not_found.
 */
export async function claimInvite(userId: string, code: string, locale: string): Promise<ClaimResult> {
  const group = await getGroupByInviteCode(code);
  if (group) {
    await joinGroupIdempotent(userId, group);
    return {
      ok: true,
      redirectPath: localizePath(locale, `/tournaments/${group.tournament.slug}/groups/${group.slug}`),
    };
  }

  const circle = await getCircleByInviteCode(code);
  if (circle) {
    await joinCircleIdempotent(userId, circle);
    return { ok: true, redirectPath: localizePath(locale, "/circles") };
  }

  return { ok: false, reason: "not_found" };
}
```

- [ ] **Step 2: Verify it type-checks / builds**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/lib/invite/claim-invite.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invite/claim-invite.ts
git commit -m "feat(invite): idempotens membership core + claimInvite"
```

---

### Task 4: Action-ök átállítása a közös core-ra (DRY, nincs duplikáció)

**Files:**
- Modify: `src/actions/groups.ts` (a `joinGroup` függvény teste)
- Modify: `src/actions/circles.ts` (a `joinCircle` függvény teste)

- [ ] **Step 1: Refactor `joinGroup`**

`src/actions/groups.ts` — cseréld le a teljes `joinGroup` függvényt erre (a `redirect` és `getGroupByInviteCode` importok már megvannak; add hozzá a `joinGroupIdempotent` importot a fájl tetején):

```ts
import { joinGroupIdempotent } from "@/lib/invite/claim-invite";
```

```ts
export async function joinGroup(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await getGroupByInviteCode(inviteCode);
  if (!group) throw new Error("Group not found");

  await joinGroupIdempotent(user.id, group);
  redirect(`/tournaments/${group.tournament.slug}/groups/${group.slug}`);
}
```

- [ ] **Step 2: Refactor `joinCircle`**

`src/actions/circles.ts` — cseréld le a teljes `joinCircle` függvényt erre (add hozzá az importot a fájl tetején):

```ts
import { joinCircleIdempotent } from "@/lib/invite/claim-invite";
```

```ts
export async function joinCircle(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const circle = await getCircleByInviteCode(inviteCode);
  if (!circle) throw new Error("Circle not found");

  await joinCircleIdempotent(user.id, circle);
  return circle;
}
```

- [ ] **Step 3: Verify build + lint (unused imports)**

Run: `npx tsc --noEmit && npm run check`
Expected: no type errors; Biome reports no unused imports (`db`, `and`, `eq`, `groupMembers`, `circleMembers` still used by the other functions in each file; `distributeInitialTokens` still used by `createGroup`).

- [ ] **Step 4: Commit**

```bash
git add src/actions/groups.ts src/actions/circles.ts
git commit -m "refactor(invite): joinGroup/joinCircle a közös idempotens core-ra"
```

---

### Task 5: Claim route handler

**Files:**
- Create: `src/app/api/join/claim/route.ts`

- [ ] **Step 1: Implement the route**

`src/app/api/join/claim/route.ts`:

```ts
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
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/join/claim/route.ts
git commit -m "feat(invite): /api/join/claim route — idempotens belépés + cookie törlés"
```

---

### Task 6: Middleware — capture + funnel + verifier-immediate claim

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Rewrite the middleware**

`src/middleware.ts` (teljes csere):

```ts
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
  return cookieHeader(request).includes(SESSION_COOKIE);
}

function hasPending(request: NextRequest): boolean {
  return cookieHeader(request).includes(PENDING_INVITE_COOKIE);
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
```

- [ ] **Step 2: Verify build + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(invite): middleware capture + funnel + verifier-immediate claim"
```

---

### Task 7: `/join/[code]` oldal egyszerűsítése (nincs render-mellékhatás)

**Files:**
- Modify: `src/app/[locale]/join/[code]/page.tsx`

- [ ] **Step 1: Rewrite the page**

`src/app/[locale]/join/[code]/page.tsx` (teljes csere):

```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { JoinSignIn } from "@/components/join-sign-in";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { buildJoinCallbackUrl } from "@/lib/join-url";
import { getCircleByInviteCode } from "@/queries/circles";
import { getGroupByInviteCode } from "@/queries/groups";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();

  // Bejelentkezett user → a claim route idempotensen beléptet és a cél oldalra visz.
  // (A `tc_pending_invite` cookie-t a middleware már lerakta ezen a kérésen.)
  if (user) redirect("/api/join/claim");

  const [locale, t, group, circle] = await Promise.all([
    getLocale(),
    getTranslations("join"),
    getGroupByInviteCode(code),
    getCircleByInviteCode(code),
  ]);

  // Ismeretlen kód.
  if (!group && !circle) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">{t("notFound")}</CardContent>
        </Card>
      </div>
    );
  }

  // Kijelentkezett meghívott: bejelentkező képernyő. A login után a verifier-ág
  // (middleware) a claim route-ra terel, így a belépés automatikusan megtörténik.
  return (
    <JoinSignIn
      targetName={group?.name ?? circle?.name ?? ""}
      kind={group ? "group" : "circle"}
      callbackURL={buildJoinCallbackUrl(locale, code)}
    />
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors; `joinGroup`/`joinCircle` és `@/i18n/navigation` `redirect` importok eltűntek a fájlból (Biome nem jelez unused-ot).

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/join/[code]/page.tsx
git commit -m "refactor(invite): join oldal — render-join helyett claim-redirect"
```

---

### Task 8: Verifikáció — build, teszt, kézi flow

**Files:** none (ellenőrzés).

- [ ] **Step 1: Full unit suite + build**

Run: `npm run test && npm run check && npm run build`
Expected: minden teszt PASS; Biome tiszta; a build sikeres.

- [ ] **Step 2: Kézi flow — friss user (kijelentkezve)**

1. Indíts dev szervert (`npm run dev`), nyiss privát/inkognitó ablakot (nincs session).
2. Nyiss meg egy valós csoport-meghívó linket: `/join/<valós kód>`.
3. Ellenőrizd a DevTools → Application → Cookies alatt: `tc_pending_invite=<kód>` lerakva (HttpOnly, Lax, ~30 nap).
4. Jelentkezz be Google-lel a sign-in képernyőről.
5. **Várt:** a login után a böngésző a csoport oldalán köt ki, és a user **tag** (megjelenik a tagok közt / a ranglistában a csoportban). A `tc_pending_invite` cookie eltűnt.

- [ ] **Step 3: Kézi flow — „mellélandolás" szimuláció**

1. Inkognitó, töröld a `tc_pending_invite` cookie-t.
2. Állítsd be kézzel a cookie-t a domainre (DevTools): `tc_pending_invite=<valós kód>`, és győződj meg róla, hogy be vagy jelentkezve.
3. Navigálj a `/tournaments` oldalra.
4. **Várt:** a middleware funnel a `/api/join/claim`-re terel, beléptet, törli a cookie-t, és a cél oldalra visz.

- [ ] **Step 4: Kézi flow — kör-meghívó + ismeretlen kód**

1. Ismételd a Step 2-t egy **kör**-meghívó kóddal → a `/circles` oldalon, tagként köt ki.
2. Nyiss egy nem létező kódot kijelentkezve (`/join/NEMLETEZIK`) → a „nem található" kártya jelenik meg.

- [ ] **Step 5: Commit (ha volt apró igazítás)**

```bash
git add -A
git commit -m "test(invite): kézi verifikáció utáni igazítások" || echo "nincs változás"
```

---

## Notes for the implementer

- **Loop-safety:** a middleware `/join` látogatáskor SOSEM claim-el közvetlenül (csak capture); a logged-in claimet a `/join` oldal `getCurrentUser()`-je dönti el. Így egy elévült session cookie (jelenlét, de érvénytelen) nem okoz végtelen redirect-loopot — a claim route null-user esetén a `/join` oldalra visz, ami a sign-in képernyőt rendereli (terminál állapot).
- **Cookie host-only:** a `setPendingCookie` szándékosan nem ad `Domain=` attribútumot → a kanonikus `www.tippcasino.hu`-hoz tapad; az edge-redirectek (vercel.app/apex → www, path-preserving, middleware előtt) nem érintik.
- **`?invite=notfound`** query param: a not_found ágat jelzi; UI-toast külön nincs (scope-on kívül), a param ártalmatlan.
- A `joinGroup`/`joinCircle` server action-ök megmaradnak (most a közös core-t hívják), de a `/join` flow már nem használja őket — jövőbeli hívóknak elérhetők.
```
