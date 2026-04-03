# Tipper — Hátralevő munka és tesztelési terv

> **Használat:** Új session-ben mondd: "Csináld meg a docs/plans/remaining-work.md tervet"

## Jelenlegi állapot

- **Repo:** github.com/kratam/tipper
- **Deploy:** https://tipper-guestguru.vercel.app (Vercel Pro, GuestGuru team, auto deploy on push)
- **DB:** Neon `patient-leaf-69938778` (eu-central-1), Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth@0.2.0-beta.1`), Google login, shared OAuth keys
- **Stack:** Next.js 16.2.2, TypeScript, Shadcn UI (nova), Tailwind v4, Biome 2.4.10, next-intl, Vitest
- **Tesztek:** 34/34 zöld (pure logic: scoring, tokens, api-sports parsing)
- **DB tartalom:** 2 versenysorozat (VB 2025 — 64 meccs finished, VB 2026 — 56 meccs scheduled), 16+ csapat

### Ami működik (manuálisan tesztelve)
- Landing page (hu/en), locale váltás
- Google bejelentkezés → user sync a public.users táblába
- Tournaments lista (bejelentkezve)
- Tournament detail — meccs lista fordulónként, csapat logókkal
- Meccs detail oldal — csapatok, odds, eredmény
- Auth védelem — redirect landing-re ha nincs session

### Ami NEM lett tesztelve
- Csoport létrehozás / csatlakozás / beállítások
- Tipp leadás / módosítás / visszavonás (bet form)
- Dobogós tipp
- Token kiosztás és egyenleg
- Leaderboard
- Admin panel
- Join link (`/join/[code]`)
- Cron token kiosztás logika
- Pontozás élő meccseknél

---

## Fázis 1: Tesztelési infrastruktúra

### 1.1 Neon test branch (prod másolat)

A Neon instant branching copy-on-write másolatot csinál a produkcióról — az összes adat (meccsek, csapatok, userek, oddsok) azonnal benne van. Nem kell kézzel seed-elni.

**Lépések:**
1. Neon MCP-vel hozz létre egy `test` branch-et a production-ról:
   ```
   mcp__Neon__create_branch(projectId: "patient-leaf-69938778", branchName: "test")
   ```
2. Kérd le a test branch connection string-jét:
   ```
   mcp__Neon__get_connection_string(projectId: "patient-leaf-69938778", branchId: "<test-branch-id>")
   ```
3. Mentsd el `.env.test.local`-ba:
   ```env
   DATABASE_URL=<test branch connection string>
   API_SPORTS_KEY=59a412d1517e283a005f9885bde1da5b
   NEON_AUTH_BASE_URL=https://ep-ancient-term-ag189o58.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth
   NEON_AUTH_COOKIE_SECRET=v0ff2qEiBGdadcM8bKJKHndUR2tmahMD++Rg8Hhh6XI=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   CRON_SECRET=test-secret
   ```
4. Ha a tesztek elrontják az adatokat, dobd el és hozd újra létre a branch-et (instant, 0 költség):
   ```
   mcp__Neon__delete_branch(projectId: "patient-leaf-69938778", branchId: "<test-branch-id>")
   mcp__Neon__create_branch(projectId: "patient-leaf-69938778", branchName: "test")
   ```
   Vagy használd a `reset_from_parent` funkciót:
   ```
   mcp__Neon__reset_from_parent(projectId: "patient-leaf-69938778", branchId: "<test-branch-id>")
   ```

### 1.2 Test user seed (minimális)

A branch a produkció másolata, szóval a meccsek/csapatok/oddsok megvannak. Csak ami hiányzik:
- Test user a `neon_auth` sémában (session cookie-hoz)
- Test user a `public.users` táblában (isAdmin: true)
- 2 csoport a test userrel (token kiosztással)

Hozz létre `src/db/seed-test-user.ts`:

```ts
// Tartalma:
// 1. INSERT INTO neon_auth.user — test user (id: "test-user-uuid", email: "test@tipper.dev", name: "Test Admin")
// 2. INSERT INTO neon_auth.session — aktív session token ehhez a userhez (token: "test-session-token", expiresAt: +30 nap)
// 3. INSERT INTO public.users — (googleId: "test-user-uuid", email: "test@tipper.dev", isAdmin: true)
// 4. INSERT INTO public.groups — 2 csoport a "Jégkorong VB 2026" tournament-hez, owner: test user
// 5. INSERT INTO public.group_members — test user tagja mindkét csoportnak
// 6. INSERT INTO public.token_ledger — 200 token kiosztás csoportonként (type: "distribution")
```

Futtatás: `npx tsx src/db/seed-test-user.ts` (dotenv-vel a `.env.test.local`-ból olvasson)

Adj hozzá script-eket a `package.json`-be:
```json
{
  "db:seed-test": "dotenv -e .env.test.local -- npx tsx src/db/seed-test-user.ts",
  "db:reset-test": "neon branches reset --project-id patient-leaf-69938778 --branch test"
}
```

### 1.3 Playwright E2E tesztek auth-tal

A Neon Auth nem tesztelhető headless Google OAuth-on keresztül. Megoldás: **test session cookie inject.**

A seed script már létrehozott egy session-t a `neon_auth.session` táblában. A Playwright tesztnek ezt a session token-t kell cookie-ként inject-álnia.

**Megközelítés:**
1. A seed script ismert session token-t ír a `neon_auth.session` táblába (pl. `"test-session-token-abc123"`)
2. A Playwright `globalSetup` a Neon Auth cookie formátumát használva inject-álja a cookie-t a böngészőbe
3. Minden teszt előtt a `storageState`-ből betöltődik a session → a user bejelentkezve van
4. Alternatíva: adj hozzá egy `GET /api/auth/test-login` route-ot ami CSAK `process.env.CRON_SECRET === "test-secret"` esetén működik, és a Neon Auth `getSession()`-t hívva létrehozza a session cookie-t. A Playwright ezt hívja meg `page.goto()` előtt.

Hozz létre `tests/e2e/` mappát:
```
tests/
  e2e/
    helpers/
      auth.ts          # Test user login helper (cookie inject)
      seed.ts          # Seed trigger
    flows/
      landing.spec.ts  # Landing page, locale switch
      tournament.spec.ts  # Tournament lista, meccs lista
      betting.spec.ts  # Csoport létrehozás → tippelés → eredmény
      groups.spec.ts   # Csoport CRUD, meghívó, beállítások
      admin.spec.ts    # Admin panel, tournament kezelés
```

**Playwright config** (`playwright.config.ts`):
```ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'dotenv -e .env.test.local -- npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

### 1.4 Tesztelendő user flow-k

**Flow A: Teljes tippelési ciklus**
1. Bejelentkezés (test user)
2. Versenysorozatok → "Test VB 2026" kiválasztás
3. Meccs részletek megnyitás (scheduled meccs)
4. → Nincs csoport → Bet form üres → Csoportjaim-ra navigálás
5. Csoport létrehozás ("Teszt csoportom", token_per_round: 100)
6. Vissza a meccshez → Bet form megjelenik
7. Tipp leadás: 3:1, tét: 50
8. Ellenőrzés: tipp megjelenik, egyenleg csökkent
9. Tipp módosítás: 2:0, tét: 30
10. Tipp visszavonás
11. Ellenőrzés: egyenleg visszaállt

**Flow B: Csoport meghívás**
1. Csoport létrehozás → meghívó kód másolás
2. (Második test user) → `/join/[code]` megnyitás → csatlakozás
3. Leaderboard ellenőrzés: mindkét user megjelenik

**Flow C: Pontozás**
1. Seed-ben van 1 finished meccs és hozzá bet
2. Cron sync lefut → pontozás megtörténik
3. Leaderboard-on a pontszám megjelenik
4. Meccs detail-en a tipp zöld/piros jelölést kap

**Flow D: Admin**
1. Admin user → Admin oldal
2. Versenysorozat létrehozás
3. Státusz váltás: upcoming → active
4. Sync triggerelés

**Flow E: Dobogós tipp**
1. Tournament detail → Dobogós tipp tab
2. Arany/ezüst/bronz kiválasztás
3. Mentés → ellenőrzés hogy megjelenik

---

## Fázis 2: Bugfixek

### 2.1 Hiányzó fordítási kulcsok

A `bet-form.tsx` használ kulcsokat amik nincsenek a `messages/hu.json`-ban:
- `betting.homeScore`
- `betting.awayScore`
- `betting.success`
- `betting.updateSuccess`
- `betting.cancelSuccess`
- `matches.vs`

**Tennivaló:** Pótold ezeket a `messages/hu.json` és `messages/en.json` fájlokba.

### 2.2 Tournament status megjelenítés logikai hiba

`src/app/[locale]/tournaments/page.tsx:58` — a status string-et az i18n fordítással hasonlítja össze:
```ts
// HIBÁS:
t("active") === tournament.status
// HELYES:
tournament.status === "active"
```

### 2.3 Hardcoded angol szövegek

- `src/components/group-detail-tabs.tsx:278` — "Settings can only be changed..."
- `src/components/create-group-form.tsx:103` — "(Defaults are applied...)"

Fordítási kulcsokra cserélendők.

### 2.4 next/image domain whitelist

A csapat logók API URL-jei (`media.api-sports.io` vagy hasonló) nincsenek engedélyezve a `next.config.ts`-ben. Ezért töröttek a logók a meccs detail oldalon.

**Tennivaló:** Add hozzá a `next.config.ts`-hez:
```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "media-*.api-sports.io" },
    ],
  },
};
```

Ellenőrizd a tényleges hostnevet a `teams.logo_url` mezőből:
```sql
SELECT DISTINCT substring(logo_url from 'https?://([^/]+)') as host FROM teams WHERE logo_url IS NOT NULL LIMIT 10;
```

### 2.5 Cron sync unsafe array destructuring

`src/app/api/cron/sync/route.ts:142-147` — a team upsert-nél az `INSERT...RETURNING` üres tömböt adhat. Adj hozzá `onConflictDoUpdate` az upsert-hez:

```ts
const [team] = await db
  .insert(teams)
  .values({ apiTeamId: apiTeam.id, name: apiTeam.name, logoUrl: apiTeam.logo })
  .onConflictDoUpdate({
    target: teams.apiTeamId,
    set: { name: apiTeam.name, logoUrl: apiTeam.logo },
  })
  .returning();
```

### 2.6 2025-ös VB státusz

A Jégkorong VB 2025 minden meccse `finished`, de a tournament státusza `active`. Állítsd `finished`-re:
```sql
UPDATE tournaments SET status = 'finished' WHERE slug = 'jegkorong-vb-2025';
```

---

## Fázis 3: Hiányzó funkciók

### 3.1 Token kiosztás a cron-ban

A cron sync jelenleg NEM oszt ki tokeneket. A spec szerint:
- Minden új kör (meccsnap) elején a játékos kap `token_per_round` tokent
- Előző körből fel nem használt tokenek `carryover_percent`%-a átvitelre kerül

**Tennivaló:** A cron sync-be add hozzá a token kiosztás logikát:
1. Kérdezd le az aktuális kör (mai dátum) meccseit
2. Minden group-ra ellenőrizd: volt-e már `distribution` típusú bejegyzés erre a kör-re (round)
3. Ha nem: minden group member-nek adj `token_per_round` tokent
4. Számold ki a carryover-t az előző körből

Ez kritikus — nélküle a játékosoknak nincs tokenjük tippelni!

### 3.2 Smart cron — API hívás csak meccsvége körül

A cron gyakran fut (5-10 percenként), de az API-t NEM kell minden alkalommal meghívni. Egy jégkorong meccs ~2.5-3 óra (3×20 perc + szünetek). Az API-t ténylegesen csak akkor érdemes hívni, ha:
- Van `live` státuszú meccs a DB-ben (ilyenkor mindenképp frissítsünk)
- Van `scheduled` meccs aminek a várható vége ±30 percen belül van (`scheduled_at + 3 óra ± 30 perc`)
- Vagy ha a legutóbbi sync óta eltelt >6 óra (naponta legalább pár sync a fixtures/odds frissítéséhez)

**Logika a cron route elején:**
```ts
const MATCH_DURATION_MS = 3 * 60 * 60 * 1000; // ~3 óra
const WINDOW_MS = 30 * 60 * 1000; // ±30 perc
const now = Date.now();

// Van-e live meccs?
const liveMatches = await db.query.matches.findMany({
  where: eq(matches.status, "live"),
});

// Van-e meccs aminek a várható vége közel?
const nearEndMatches = await db.query.matches.findMany({
  where: and(
    eq(matches.status, "scheduled"),
    // scheduled_at + 3h - 30m < now < scheduled_at + 3h + 30m
    gte(matches.scheduledAt, new Date(now - MATCH_DURATION_MS - WINDOW_MS)),
    lte(matches.scheduledAt, new Date(now - MATCH_DURATION_MS + WINDOW_MS)),
  ),
});

const shouldCallApi = liveMatches.length > 0
  || nearEndMatches.length > 0
  || lastSyncWasMoreThan6HoursAgo;

if (!shouldCallApi) {
  return NextResponse.json({ ok: true, skipped: true, reason: "no matches near end" });
}
```

**Előnyök:**
- Cron 5 percenként fut → gyorsabb eredmény
- API hívás csak meccskezdés/-vége körül → ~90%-kal kevesebb request
- Request budget: 56 meccs × 2 request (fixtures+odds) × ~3 hívás meccsenként = ~336 request az egész VB-re (vs. korábbi ~1736)

**Cron:** A projekt a GuestGuru Vercel Pro team-en van, ahol a `*/5 * * * *` cron natívan működik. A `vercel.json`-ban már be van állítva.

**Fontos:** a meccs elején is kell sync (scheduled → live átmenet a tippek lezárásához). Ehhez bővítsd a feltételt:
```ts
// Van-e meccs ami hamarosan kezdődik? (±15 perc)
const nearStartMatches = await db.query.matches.findMany({
  where: and(
    eq(matches.status, "scheduled"),
    gte(matches.scheduledAt, new Date(now - 15 * 60 * 1000)),
    lte(matches.scheduledAt, new Date(now + 15 * 60 * 1000)),
  ),
});
```

### 3.3 Odds sync a 2026-os VB-hez

A 2026-os VB-hez nincsenek oddsok az API-ban (még nem elérhető). Az admin felületen legyen lehetőség kézzel oddsot megadni, VAGY a cron figyelje és töltse be amint elérhetővé válnak.

**Tennivaló:** Az admin panelre adj hozzá meccsenkénti odds megadás lehetőséget (egyszerű form: match select + home/draw/away odds input).

### 3.4 Join oldal hibaüzenetek

`src/app/[locale]/join/[code]/page.tsx` — ha a csoport nem található vagy a user már tag, a `joinGroup` action throw-ol. A page-nek kell error handling:
- "Csoport nem található" üzenet
- "Már tag vagy ebben a csoportban" → redirect a csoport oldalra
- Sikeres csatlakozás → redirect a csoport oldalra (ez már működik)

### 3.5 Nav — bejelentkezett állapot server-side

A `nav.tsx` client component, de a bejelentkezett állapotot nem kapja meg. A `getCurrentUser()` server-only. Megoldás:
- A `[locale]/layout.tsx`-ben hívd meg a `getCurrentUser()`-t
- A Nav-nak add át props-ként: `user={{ name, avatarUrl, isAdmin }}`
- A Nav-ban a signOut is kell: `authClient.signOut()`

Ellenőrizd a jelenlegi implementációt — lehet hogy a Nav már kapja a user-t, de ha nem, pótold.

---

## Fázis 4: Kód minőség

### 4.1 Biome check

Futtasd: `npx biome check --write .` és commitold a javításokat.

### 4.2 Test coverage bővítés

Jelenleg 34 teszt a pure logikára. Adj hozzá:
- `tests/lib/utils.test.ts` — `generateInviteCode` (hossz, karakterek), `slugify` (ékezetes input), `formatDate`
- `tests/actions/` — mock DB-vel az action-ök input validációjának tesztelése (opcionális)

### 4.3 Error boundary

Adj hozzá `src/app/[locale]/error.tsx` — globális error boundary ami "Hiba történt" üzenetet mutat, ne a Next.js default 500 oldalt.

---

## Végrehajtási sorrend

1. **Fázis 1.1-1.2:** Neon test branch + seed script (~15 perc)
2. **Fázis 2:** Bugfixek (~15 perc) — ezek egyszerűek, azonnal javíthatók
3. **Fázis 3.1:** Token kiosztás a cron-ban (~10 perc) — kritikus a működéshez
4. **Fázis 1.3-1.4:** Playwright E2E tesztek (~30 perc)
5. **Fázis 3.2-3.4:** Hiányzó funkciók (~20 perc)
6. **Fázis 4:** Kód minőség (~10 perc)

Összesen: ~2 óra becsült gépi munka.
