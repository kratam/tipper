# Match-finish rate limit újratervezés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Megszüntetni az odds-api.io Free Plan órás (100 req/óra) rate limit túllépését a match-finish ütemezés újratervezésével: tornánként egyetlen, dedup-olt, esemény-vezérelt recheck-lánc.

**Architecture:** A `periodic` cron bucketenkénti QStash fan-outja helyett tornánként **egyetlen** match-finish lánc fut, amelynek invariánsát egy DB-claim (`tournaments.next_finish_check_at` atomikus compare-and-set) garantálja. A következő check idejét egy pure függvény (`computeNextFinishCheck`) számolja: meccs alatt nulla hívás, a várható vég körül ~3 percenként recheck, amíg `finished`. A QStash retry-amplifikációt `retries: 0` öli meg; minden odds-api hibát a route elnyel és a normál recheck-ciklusból próbál újra.

**Tech Stack:** Next.js 16 App Router (route handlers), Drizzle ORM (Neon Postgres), Upstash QStash (`@upstash/qstash`), Vitest (unit tesztek pure logikára).

## Global Constraints

- **Séma-változás kizárólag `npm run db:generate` → `npm run db:migrate` úton** (CLAUDE.md). Soha nem `drizzle-kit push`, kézi SQL vagy Neon MCP migráció. A production migrációt **kézzel** kell futtatni deploy előtt; a Vercel build nem migrál.
- **`.env.local` a `dev` Neon branch-re mutat** — lokális `db:migrate` a dev branch-et migrálja.
- **Lint/format:** `npm run check` (Biome) tisztán kell lefusson minden task végén.
- **RECHECK_INTERVAL = 3 perc** (`3 * 60 * 1000` ms).
- **odds-api Free Plan = 100 request/óra**, nincs napi/havi limit.
- **Auth:** a cron route-ok `CRON_SECRET` Bearer-rel védettek (változatlan).
- Nincs feature branch — közvetlenül `main`-en dolgozunk, commitonként.

---

### Task 1: DB séma — `next_finish_check_at` oszlop

**Files:**
- Modify: `src/db/schema.ts:48-68` (a `tournaments` tábla)
- Create: `drizzle/<generált>.sql` (a `db:generate` hozza létre)

**Interfaces:**
- Produces: `tournaments.nextFinishCheckAt` (Drizzle oszlop, `Date | null`)

- [ ] **Step 1: Oszlop hozzáadása a sémához**

A `src/db/schema.ts`-ben a `tournaments` tábla `createdAt` sora elé (a `useScheduleOverrides` / `isArchived` mintát követve) szúrd be:

```ts
  nextFinishCheckAt: timestamp("next_finish_check_at", { withTimezone: true }),
```

(Nullable szándékosan — alapból nincs aktív lánc; nem kell `.notNull()` és default.)

- [ ] **Step 2: Migráció generálása**

Run: `npm run db:generate`
Expected: új `drizzle/XXXX_*.sql` fájl jön létre, tartalma lényegében:
```sql
ALTER TABLE "tournaments" ADD COLUMN "next_finish_check_at" timestamp with time zone;
```
Ellenőrizd, hogy a migráció **csak** ezt az egy `ADD COLUMN`-t tartalmazza (semmi más drift).

- [ ] **Step 3: Migráció futtatása a dev branch-en**

Run: `npm run db:migrate`
Expected: sikeres futás (exit 0), az oszlop létrejön a `dev` branch-en. Ha „némán elhasal" (exit 1, üres stderr), a dev napló elcsúszott — lásd CLAUDE.md (a `dev` branch `reset_from_parent`-ja a javítás).

- [ ] **Step 4: Típus-ellenőrzés**

Run: `npm run check`
Expected: nincs hiba.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(match-finish): next_finish_check_at oszlop a tournaments táblán"
```

---

### Task 2: `computeNextFinishCheck` + `delaySecondsUntil` pure logika (TDD)

**Files:**
- Create: `src/lib/match-finish-schedule.ts`
- Test: `tests/lib/match-finish-schedule.test.ts`

**Interfaces:**
- Produces:
  - `RECHECK_INTERVAL_MS: number` (= 180000)
  - `interface PendingMatch { scheduledAt: Date; status: "scheduled" | "live"; durationMs: number }`
  - `computeNextFinishCheck(pending: PendingMatch[], now: Date): Date | null`
  - `delaySecondsUntil(target: Date, now: Date): number`

- [ ] **Step 1: Failing test megírása**

Create `tests/lib/match-finish-schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeNextFinishCheck,
  delaySecondsUntil,
  type PendingMatch,
  RECHECK_INTERVAL_MS,
} from "@/lib/match-finish-schedule";

const FOOTBALL = 115 * 60 * 1000; // 1h55m
const NOW = new Date("2026-06-23T20:00:00.000Z");

function match(scheduledAt: string, status: "scheduled" | "live" = "scheduled"): PendingMatch {
  return { scheduledAt: new Date(scheduledAt), status, durationMs: FOOTBALL };
}

describe("computeNextFinishCheck", () => {
  it("üres pending → null (a lánc leáll)", () => {
    expect(computeNextFinishCheck([], NOW)).toBeNull();
  });

  it("minden meccs a jövőben fejeződik be → a legkorábbi várható vég", () => {
    // 19:00 kezdés → vége 20:55; 22:00 kezdés → vége 23:55
    const result = computeNextFinishCheck(
      [match("2026-06-23T22:00:00Z"), match("2026-06-23T19:00:00Z")],
      NOW,
    );
    expect(result).toEqual(new Date("2026-06-23T20:55:00.000Z"));
  });

  it("van lejárt várható végű (még nem finished) meccs → now + RECHECK_INTERVAL", () => {
    // 17:55 kezdés → vége 19:50, ami < NOW(20:00) → overdue
    const result = computeNextFinishCheck([match("2026-06-23T17:55:00Z")], NOW);
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });

  it("live meccs a várható vég ELŐTT → a várható vég (nem recheck még)", () => {
    // 19:30 kezdés, live → vége 21:25 > NOW → nem overdue
    const result = computeNextFinishCheck([match("2026-06-23T19:30:00Z", "live")], NOW);
    expect(result).toEqual(new Date("2026-06-23T21:25:00.000Z"));
  });

  it("live meccs a várható vég UTÁN → now + RECHECK_INTERVAL", () => {
    // 18:00 kezdés, live → vége 19:55 < NOW → overdue
    const result = computeNextFinishCheck([match("2026-06-23T18:00:00Z", "live")], NOW);
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });

  it("vegyes: egy overdue + egy jövőbeli → az overdue nyer (recheck)", () => {
    const result = computeNextFinishCheck(
      [match("2026-06-23T17:55:00Z"), match("2026-06-23T22:00:00Z")],
      NOW,
    );
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });
});

describe("delaySecondsUntil", () => {
  it("jövőbeli cél → másodpercek felfelé kerekítve", () => {
    expect(delaySecondsUntil(new Date("2026-06-23T20:10:30Z"), NOW)).toBe(630);
  });

  it("közeli/múltbeli cél → minimum 60 másodperc padló", () => {
    expect(delaySecondsUntil(new Date("2026-06-23T20:00:10Z"), NOW)).toBe(60);
    expect(delaySecondsUntil(new Date("2026-06-23T19:00:00Z"), NOW)).toBe(60);
  });
});
```

- [ ] **Step 2: Teszt futtatása — bukjon**

Run: `npx vitest run tests/lib/match-finish-schedule.test.ts`
Expected: FAIL — „Cannot find module '@/lib/match-finish-schedule'".

- [ ] **Step 3: Minimális implementáció**

Create `src/lib/match-finish-schedule.ts`:

```ts
// A match-finish recheck-lánc döntéslogikája. Tiszta (DB/IO nélkül), hogy
// unit-tesztelhető legyen — lásd tests/lib/match-finish-schedule.test.ts.

export const RECHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 perc

export interface PendingMatch {
  scheduledAt: Date;
  status: "scheduled" | "live";
  durationMs: number;
}

/**
 * A következő match-finish check ideje, vagy null ha nincs több lezáratlan meccs.
 * - Üres lista → null (a lánc leáll).
 * - Van olyan meccs, aminek a várható vége már elmúlt (várjuk az eredményt) →
 *   sűrű recheck: now + RECHECK_INTERVAL_MS.
 * - Különben → a legkorábbi várható meccs-vég (addig nulla hívás).
 */
export function computeNextFinishCheck(pending: PendingMatch[], now: Date): Date | null {
  if (pending.length === 0) return null;
  const ends = pending.map((m) => m.scheduledAt.getTime() + m.durationMs);
  const hasOverdue = ends.some((end) => end <= now.getTime());
  if (hasOverdue) return new Date(now.getTime() + RECHECK_INTERVAL_MS);
  return new Date(Math.min(...ends));
}

/** QStash delay másodpercben, minimum 60s padlóval (a meglévő konvenció). */
export function delaySecondsUntil(target: Date, now: Date): number {
  return Math.max(60, Math.ceil((target.getTime() - now.getTime()) / 1000));
}
```

- [ ] **Step 4: Teszt futtatása — passzoljon**

Run: `npx vitest run tests/lib/match-finish-schedule.test.ts`
Expected: PASS (8 teszt).

- [ ] **Step 5: Commit**

```bash
git add src/lib/match-finish-schedule.ts tests/lib/match-finish-schedule.test.ts
git commit -m "feat(match-finish): computeNextFinishCheck pure döntéslogika + tesztek"
```

---

### Task 3: `scheduleMatchFinishCheck` — tournamentId + retries:0

**Files:**
- Modify: `src/lib/qstash.ts:29-41`

**Interfaces:**
- Consumes: semmi új.
- Produces: `scheduleMatchFinishCheck(tournamentId: string, delaySeconds: number): Promise<void>` (a paraméter-sorrend változik: `tournamentId` az első).

- [ ] **Step 1: Függvény átírása**

A `src/lib/qstash.ts`-ben cseréld le a `scheduleMatchFinishCheck`-et:

```ts
/**
 * Match-finish check ütemezése egy adott tornára, `delaySeconds` múlva.
 * QStash POST-ol a /api/cron/match-finish-re, body-ban a tournamentId-vel.
 * `retries: 0` — szándékosan nincs QStash-újrapróbálkozás: egy odds-api 429
 * miatti route-hiba nem szülhet további hívásokat (retry-amplifikáció ellen).
 * Az elveszett láncot a periodic cron önjavítja (DB-claim, lásd sync.ts).
 */
export async function scheduleMatchFinishCheck(
  tournamentId: string,
  delaySeconds: number,
): Promise<void> {
  const qstash = getQStashClient();
  const baseUrl = getCallbackBaseUrl();

  await qstash.publishJSON({
    url: `${baseUrl}/api/cron/match-finish`,
    body: { trigger: "scheduled", tournamentId },
    delay: delaySeconds,
    retries: 0,
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
}
```

- [ ] **Step 2: Build + lint ellenőrzés**

Run: `npm run check`
Expected: nincs hiba. (A hívók — periodic/match-finish route — a Task 5/6-ban állnak át; ha most típushiba jön a régi hívásoknál, az várt, és a következő taskok javítják. A `check` itt a formázásra/lintre fókuszál; a teljes típus-zöldet a Task 6 utáni build adja.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/qstash.ts
git commit -m "feat(match-finish): scheduleMatchFinishCheck tornánként + retries:0"
```

---

### Task 4: `scheduleNextFinishCheck` orchestration (DB-claim)

**Files:**
- Modify: `src/lib/sync.ts` (import-sor `:1` és új exportált függvény a „Tournament sync" blokk után, kb. `:191` után)

**Interfaces:**
- Consumes: `computeNextFinishCheck`, `delaySecondsUntil` (Task 2); `scheduleMatchFinishCheck` (Task 3); `expectedMatchDurationMs` (`src/lib/match-duration.ts`).
- Produces: `scheduleNextFinishCheck(tournamentId: string): Promise<void>`

- [ ] **Step 1: Importok bővítése**

A `src/lib/sync.ts` tetején az `drizzle-orm` importba vedd fel az `inArray`, `lte`, `or` neveket (a meglévő `and, desc, eq, isNotNull, isNull, ne, sql` mellé):

```ts
import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
```

És a lib-importokhoz (a fájl tetején, a `getProvider` import köré):

```ts
import { expectedMatchDurationMs } from "@/lib/match-duration";
import { computeNextFinishCheck, delaySecondsUntil } from "@/lib/match-finish-schedule";
import { scheduleMatchFinishCheck } from "@/lib/qstash";
```

- [ ] **Step 2: A `scheduleNextFinishCheck` függvény hozzáadása**

A `syncTournament` után (kb. `src/lib/sync.ts:191`) szúrd be:

```ts
// ── Match-finish lánc ütemezése ──

/**
 * Tornánként EGYETLEN match-finish recheck-lánc fenntartása. A `next_finish_check_at`
 * oszlop a szerződés: ha jövőbeli érték van benne, már fut a lánc. Az atomikus
 * compare-and-set claim garantálja, hogy két párhuzamos hívó (periodic + futó
 * match-finish) közül csak egy ütemez. A `<= now` feltétel teszi lehetővé az
 * önjavítást: egy elveszett (retries:0) láncot a következő hívó újrafoglal.
 */
export async function scheduleNextFinishCheck(tournamentId: string): Promise<void> {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    columns: { id: true, providerSport: true },
  });
  if (!tournament) return;

  const pending = await db
    .select({ scheduledAt: matches.scheduledAt, status: matches.status })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.status, ["scheduled", "live"]),
      ),
    );

  const durationMs = expectedMatchDurationMs(tournament.providerSport);
  const now = new Date();
  const target = computeNextFinishCheck(
    pending.map((m) => ({
      scheduledAt: m.scheduledAt,
      status: m.status as "scheduled" | "live",
      durationMs,
    })),
    now,
  );

  if (target === null) {
    // Nincs több lezáratlan meccs — a lánc leáll.
    await db
      .update(tournaments)
      .set({ nextFinishCheckAt: null })
      .where(eq(tournaments.id, tournamentId));
    return;
  }

  // Atomikus claim: csak akkor ütemezünk, ha nincs jövőbeli függő check.
  const claimed = await db
    .update(tournaments)
    .set({ nextFinishCheckAt: target })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        or(isNull(tournaments.nextFinishCheckAt), lte(tournaments.nextFinishCheckAt, now)),
      ),
    )
    .returning({ id: tournaments.id });

  if (claimed.length === 0) return; // már van jövőbeli check — nem duplikálunk

  await scheduleMatchFinishCheck(tournamentId, delaySecondsUntil(target, now));
}
```

- [ ] **Step 3: Build ellenőrzés**

Run: `npm run check`
Expected: nincs hiba ebben a fájlban (a route-ok még a régi API-t hívják — azokat Task 5/6 javítja).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(match-finish): scheduleNextFinishCheck DB-claim orchestration"
```

---

### Task 5: `match-finish` route — torna-specifikus + hibatűrő

**Files:**
- Modify: `src/app/api/cron/match-finish/route.ts` (teljes átírás)

**Interfaces:**
- Consumes: `scheduleNextFinishCheck` (Task 4), `syncFixtures` (`src/lib/sync.ts`).

- [ ] **Step 1: A route teljes átírása**

Cseréld le a `src/app/api/cron/match-finish/route.ts` teljes tartalmát:

```ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { scheduleNextFinishCheck, syncFixtures } from "@/lib/sync";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tournamentId?: string };

  // Torna-specifikus üzenet (új formátum) → csak azt a tornát. tournamentId nélkül
  // (régi, deploy előtti függő üzenet) → minden aktív torna, az új guard-olt
  // scheduleNextFinishCheck-kel; így a régi láncok gracefully átállnak.
  const targets = body.tournamentId
    ? await db.query.tournaments.findMany({ where: eq(tournaments.id, body.tournamentId) })
    : await db.query.tournaments.findMany({ where: eq(tournaments.status, "active") });

  for (const tournament of targets) {
    // Az odds-api hibát (429 is) elnyeljük: a route SOHA nem dob, hogy a
    // QStash ne kapjon 500-at. Az újrapróbálkozás a normál recheck-ciklusból jön.
    try {
      await syncFixtures(tournament);
    } catch (error) {
      console.error(`[match-finish] syncFixtures failed for ${tournament.id}:`, error);
    }
    // Mindig újraütemezünk — hibás sync esetén is —, a DB-ből számolva.
    await scheduleNextFinishCheck(tournament.id);
  }

  return NextResponse.json({ ok: true, processed: targets.length });
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run check`
Expected: nincs hiba ebben a fájlban.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/match-finish/route.ts
git commit -m "feat(match-finish): torna-specifikus, hibatűrő match-finish route"
```

---

### Task 6: `periodic` route — fan-out törlés + scheduleNextFinishCheck

**Files:**
- Modify: `src/app/api/cron/periodic/route.ts` (a `:42-90` blokk cseréje)

**Interfaces:**
- Consumes: `scheduleNextFinishCheck` (Task 4).

- [ ] **Step 1: A bucket-fan-out cseréje**

A `src/app/api/cron/periodic/route.ts`-ben:

(a) Az importokat egyszerűsítsd — a bucket-logika eltűnik. A fájl teteje legyen:

```ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import {
  backfillTournamentLogos,
  distributeTokensForTournament,
  scheduleNextFinishCheck,
  syncTournament,
} from "@/lib/sync";
```

(b) Töröld a `CRON_WINDOW_MS` konstanst és a komment-blokkját (`:9-12`).

(c) A token-elosztás (`:38-40`) utáni teljes „5. Schedule QStash calls…" blokkot (`:42-83`) cseréld le erre:

```ts
  // 5. Match-finish lánc fenntartása tornánként (egyetlen, dedup-olt lánc;
  //    a guard miatt élő láncot nem duplikál, elveszettet újraindít).
  for (const tournament of activeTournaments) {
    await scheduleNextFinishCheck(tournament.id);
  }

  return NextResponse.json({
    ok: true,
    synced: allTournaments.length,
    tokenDistribution: activeTournaments.length,
    finishChains: activeTournaments.length,
  });
}
```

(A `matches` és `expectedMatchDurationMs` importok feleslegessé válnak ebben a fájlban — töröld őket, ha a `check` unused-importot jelez.)

- [ ] **Step 2: Teljes build (típus-zöld az egész láncra)**

Run: `npm run build`
Expected: sikeres build, nincs típushiba sehol (ez igazolja, hogy a Task 3 megváltozott `scheduleMatchFinishCheck` szignatúrája és az új `scheduleNextFinishCheck` minden hívóban konzisztens).

- [ ] **Step 3: Lint + teljes teszt-futás**

Run: `npm run check && npm run test`
Expected: Biome tiszta; minden Vitest teszt zöld (beleértve a Task 2 új tesztjeit és a meglévő `qstash.test.ts`-t).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/periodic/route.ts
git commit -m "feat(match-finish): periodic fan-out helyett egyetlen finish-lánc tornánként"
```

---

### Task 7 (másodlagos): `syncOdds` dupla `/events` fetch megszüntetése

> Külön is mehet; kis nyereség (+1 `/events`/torna/periodic). Csak akkor kell, ha
> a fő cél (órás limit) után további tisztítást akarunk. Ha bonyolítja a review-t,
> kihagyható a fő szállításból.

**Files:**
- Modify: `src/lib/providers/types.ts:37` (a `fetchOdds` szignatúra)
- Modify: `src/lib/providers/odds-api/index.ts:27-45`
- Modify: `src/lib/providers/api-sports.ts:64-69`
- Modify: `src/lib/sync.ts` (a `syncTournament` / `syncOdds` adatáramlása)

**Interfaces:**
- Produces: `MatchProvider.fetchOdds(cfg, games: NormalizedGame[]): Promise<NormalizedOdds[]>` — a már lehozott fixtures-öket kapja, nem kéri le újra.

- [ ] **Step 1: Interfész bővítése**

`src/lib/providers/types.ts`:

```ts
  fetchOdds(cfg: ProviderTournamentConfig, games: NormalizedGame[]): Promise<NormalizedOdds[]>;
```

- [ ] **Step 2: odds-api provider — a kapott games-ből szűrjön**

`src/lib/providers/odds-api/index.ts` `fetchOdds`-ja ne hívjon `fetchEvents`-et; a `games` paraméterből vegye a pending ID-kat:

```ts
  async fetchOdds(cfg, games) {
    assertOddsApi(cfg);
    const client = createOddsApiClient();
    const pendingIds = games
      .filter((g) => g.status === "scheduled")
      .map((g) => Number(g.externalId));

    const out: NormalizedOdds[] = [];
    for (let i = 0; i < pendingIds.length; i += ODDS_API_MULTI_MAX) {
      const batch = pendingIds.slice(i, i + ODDS_API_MULTI_MAX);
      const entries = await client.fetchMultiEventOdds(batch, ODDS_API_BOOKMAKERS);
      for (const entry of entries) {
        const odds = selectOddsApiOdds(String(entry.id), entry);
        if (odds) out.push(odds);
      }
    }
    return out;
  },
```

(A `fetchEvents` import maradhat, ha máshol kell; ha nem, töröld. A `client.fetchEvents` itt megszűnik.)

- [ ] **Step 3: api-sports provider — fogadja, de figyelmen kívül hagyhatja**

`src/lib/providers/api-sports.ts` `fetchOdds`-ja a `games` paramétert nem használja (az api-sports `/odds` league+season alapú), de a szignatúrának egyeznie kell:

```ts
  async fetchOdds(cfg, _games) {
    assertApiSports(cfg);
    return (await fetchOdds(cfg.leagueId, cfg.season))
      .map(normalizeApiOdds)
      .filter((o): o is NormalizedOdds => o !== null);
  },
```

- [ ] **Step 4: sync.ts — a fixtures-eredmény továbbadása**

A `syncTournament`-ben a `syncFixtures` jelenleg `Map<string,string>`-et ad vissza. A `syncOdds`-nak át kell adni a normalizált games-et. Legtisztább: a `syncFixtures` adja vissza a `NormalizedGame[]`-et is, vagy a `syncOdds` kapja meg paraméterként. Minimal változás — a `syncOdds` szignatúrája:

```ts
export async function syncOdds(tournament: Tournament, games: NormalizedGame[]): Promise<void> {
  const cfg = toProviderConfig(tournament);
  const oddsList = await getProvider(cfg.provider).fetchOdds(cfg, games);
  // ... a maradék változatlan
}
```

A `syncFixtures` térjen vissza a games-szel is (pl. `{ apiGameDates, games }`), vagy a `syncTournament` hozza le egyszer a fixtures-t és adja tovább. Konkrétan a `syncTournament`:

```ts
export async function syncTournament(tournament: Tournament): Promise<void> {
  const cfg = toProviderConfig(tournament);
  const games = await getProvider(cfg.provider).fetchFixtures(cfg, ["hu", "en"]);
  const apiGameDates = await applyFixtures(tournament, games); // a syncFixtures törzse, games paraméterrel
  await syncOdds(tournament, games);
  await handleScheduleOverrides(
    { id: tournament.id, useScheduleOverrides: tournament.useScheduleOverrides },
    apiGameDates,
  );
}
```

ahol az `applyFixtures(tournament, games)` a jelenlegi `syncFixtures` törzse a `fetchFixtures` hívás KIVÉTELÉVEL (a games-t paraméterként kapja). A `match-finish` route által hívott `syncFixtures(tournament)` maradjon meg wrapper-ként (lehozza a games-t, hívja az `applyFixtures`-t), hogy a route ne változzon:

```ts
export async function syncFixtures(tournament: Tournament): Promise<Map<string, string>> {
  const cfg = toProviderConfig(tournament);
  const games = await getProvider(cfg.provider).fetchFixtures(cfg, ["hu", "en"]);
  return applyFixtures(tournament, games);
}
```

- [ ] **Step 5: Provider tesztek frissítése**

A `tests/lib/providers/odds-api-provider.test.ts` és `tests/lib/providers/api-sports-normalize.test.ts` (ha hívják a `fetchOdds`-ot) frissítése az új `(cfg, games)` szignatúrára. Futtasd:

Run: `npx vitest run tests/lib/providers/`
Expected: PASS (a frissített hívásokkal).

- [ ] **Step 6: Teljes verifikáció + commit**

```bash
npm run build && npm run check && npm run test
git add src/lib/providers/ src/lib/sync.ts tests/lib/providers/
git commit -m "perf(match-finish): syncOdds ne kérje le másodszor az event-listát"
```

---

## Self-Review

**1. Spec coverage:**
- Állapotmező (`next_finish_check_at`) → Task 1 ✓
- `computeNextFinishCheck` pure + RECHECK_INTERVAL → Task 2 ✓
- `scheduleNextFinishCheck` DB-claim invariáns → Task 4 ✓
- `scheduleMatchFinishCheck` tournamentId + retries:0, **nincs** deduplicationId → Task 3 ✓
- match-finish route torna-specifikus + hibatűrő (mindig újraütemez) → Task 5 ✓
- periodic fan-out törlés → Task 6 ✓
- másodlagos syncOdds dupla fetch → Task 7 ✓
- régi függő QStash üzenetek kezelése (tournamentId nélkül) → Task 5 fallback-ág ✓
- YAGNI: useMatchPolling érintetlen → egyik task sem nyúl hozzá ✓

**2. Placeholder scan:** Nincs „TBD/TODO"; minden kód-lépés teljes kódot tartalmaz. Task 7 Step 4 az egyetlen, ahol refaktor-leírás van kód helyett több ponton — ezért van „másodlagos" jelöléssel és külön a fő szállítástól.

**3. Type consistency:**
- `scheduleMatchFinishCheck(tournamentId, delaySeconds)` — Task 3 definiálja, Task 4 hívja ✓
- `scheduleNextFinishCheck(tournamentId)` — Task 4 definiálja, Task 5 és 6 hívja ✓
- `computeNextFinishCheck(pending, now) → Date | null`, `PendingMatch` — Task 2 ↔ Task 4 ✓
- `delaySecondsUntil(target, now) → number` — Task 2 ↔ Task 4 ✓
- `matches.status` `inArray(["scheduled","live"])` — a `matchStatusEnum` értékei (schema.ts) ✓

## Megjegyzés a tesztelhetőségről

A projekt teszt-infrastruktúrája pure-logikát fed (nincs DB-integrációs teszt; `vitest.config.ts` coverage = `src/lib/**`). Ezért a **kritikus döntéslogika** (`computeNextFinishCheck`, `delaySecondsUntil`) teljes TDD-vel fedett (Task 2). A DB-claim és a route-orchestration helyességét a `npm run build` (típus-zöld a teljes hívási láncon) + `npm run check` (Biome) + kód-review igazolja, mivel ezek a rétegek DB-t és külső szolgáltatást (QStash) érintenek, amit a jelenlegi infra nem mockol. Manuális preview-teszt nincs (backend-only változás).
