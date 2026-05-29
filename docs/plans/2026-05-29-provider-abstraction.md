# Provider-absztrakció — Implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Versenysorozatonként konfigurálható adatforrás-provider réteg, ami mögé az api-sports.io bekerül, és amibe második (elsődlegessé váló) forrásként az **odds-api.io** beépül — a sync/scoring/token logika változtatása nélkül. Az odds-api logóhiányát **per-torna zászló-fallback** (és lokalizált országnév) pótolja.

**Architecture:** Egy `MatchProvider` interfész normalizált alakokat (`NormalizedGame`/`NormalizedOdds`/`NormalizedTeam`) ad; a `sync.ts` provider-agnosztikussá válik és tornánként `tournament.provider` alapján dispatch-el. A séma discriminator enumot + nullable provider-specifikus oszlopokat kap; a csapatok provider-namespace-eltek. A logó nélküli (odds-api) nemzeti csapatoknál a query-réteg az ország-kódból zászlót + lokalizált nevet ad.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle ORM (Neon Postgres), next-intl (hu/en), `i18n-iso-countries`, Vitest, Biome.

**Spec:** [docs/superpowers/specs/2026-05-29-provider-abstraction-design.md](../superpowers/specs/2026-05-29-provider-abstraction-design.md)
**eredmenyek (parkolva):** [docs/research/2026-05-29-eredmenyek-flashscore-research.md](../research/2026-05-29-eredmenyek-flashscore-research.md)

**Igazolt odds-api tények (éles kulccsal, 2026-05-29):** base `https://api.odds-api.io/v3`; World Cup slug `international-world-cup` (104 esemény); bookmakerek a csomagban: `TippmixPRO`, `Bet365`; `/odds` `bookmakers` paramétere kötelező; `pending` eseménynél `scores={0,0}` (ignorálandó); státusz `pending|live|settled`.

**Megkötések:**
- Séma-változás KIZÁRÓLAG `npm run db:generate` → `npm run db:migrate`. Soha `drizzle-kit push`, soha kézi SQL a naplón kívül. A backfill UPDATE-ek a generált migrációs `.sql`-be kerülnek.
- Minden új UI szöveg `useTranslations()/getTranslations()`, magyarul ékezetekkel.
- Server Actions: `"use server"` + `getCurrentUser()` admin-ellenőrzés.
- Immutabilitás, sok kis fájl, Biome (`npm run check`).
- Minden fázis önállóan zöld buildet + zöld tesztet ad.
- Env: `ODDS_API_KEY` (már beállítva `.env.local`-ban).

---

## Fázis 1 — Provider-interfész + api-sports kiemelés (séma változatlan)

### Task 1: Provider-interfész típusok + config-feloldás

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `tests/lib/providers/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/providers/types.test.ts
import { describe, expect, it } from "vitest";
import { toProviderConfig } from "@/lib/providers/types";

describe("toProviderConfig", () => {
  it("builds an api-sports config", () => {
    expect(toProviderConfig({ provider: "api-sports", apiLeagueId: 57, apiSeason: 2026, providerSport: null, providerLeagueSlug: null }))
      .toEqual({ provider: "api-sports", leagueId: 57, season: 2026 });
  });
  it("builds an odds-api config", () => {
    expect(toProviderConfig({ provider: "odds-api", apiLeagueId: null, apiSeason: null, providerSport: "football", providerLeagueSlug: "international-world-cup" }))
      .toEqual({ provider: "odds-api", sport: "football", leagueSlug: "international-world-cup" });
  });
  it("throws when api-sports columns missing", () => {
    expect(() => toProviderConfig({ provider: "api-sports", apiLeagueId: null, apiSeason: null, providerSport: null, providerLeagueSlug: null })).toThrow(/api-sports/);
  });
  it("throws when odds-api columns missing", () => {
    expect(() => toProviderConfig({ provider: "odds-api", apiLeagueId: null, apiSeason: null, providerSport: null, providerLeagueSlug: null })).toThrow(/odds-api/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/providers/types.ts
import type { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];
export type ProviderId = "api-sports" | "odds-api";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface NormalizedTeam {
  externalId: string;
  name: string;
  logoUrl: string | null;
}

export interface NormalizedGame {
  externalId: string;
  status: MatchStatus;
  scheduledAt: Date;
  home: NormalizedTeam;
  away: NormalizedTeam;
  homeScore: number | null;
  awayScore: number | null;
}

export interface NormalizedOdds {
  externalGameId: string;
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

export type ProviderTournamentConfig =
  | { provider: "api-sports"; leagueId: number; season: number }
  | { provider: "odds-api"; sport: string; leagueSlug: string };

export interface MatchProvider {
  readonly id: ProviderId;
  fetchFixtures(cfg: ProviderTournamentConfig, locales: Locale[]): Promise<NormalizedGame[]>;
  fetchOdds(cfg: ProviderTournamentConfig): Promise<NormalizedOdds[]>;
  fetchTournamentLogo?(cfg: ProviderTournamentConfig): Promise<string | null>;
}

export interface ProviderColumns {
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
}

export function toProviderConfig(t: ProviderColumns): ProviderTournamentConfig {
  if (t.provider === "api-sports") {
    if (t.apiLeagueId == null || t.apiSeason == null) throw new Error("api-sports tournament is missing apiLeagueId/apiSeason");
    return { provider: "api-sports", leagueId: t.apiLeagueId, season: t.apiSeason };
  }
  if (t.provider === "odds-api") {
    if (!t.providerSport || !t.providerLeagueSlug) throw new Error("odds-api tournament is missing providerSport/providerLeagueSlug");
    return { provider: "odds-api", sport: t.providerSport, leagueSlug: t.providerLeagueSlug };
  }
  throw new Error(`Unknown provider: ${t.provider satisfies never}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/types.ts tests/lib/providers/types.test.ts
git commit -m "feat(providers): add MatchProvider interface + config resolver"
```

### Task 2: api-sports provider (normalizálók + kliens-wrapper)

**Files:**
- Create: `src/lib/providers/api-sports.ts`
- Create: `tests/lib/providers/api-sports-normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/providers/api-sports-normalize.test.ts
import { describe, expect, it } from "vitest";
import { normalizeApiGame, normalizeApiOdds } from "@/lib/providers/api-sports";
import type { ApiGame, ApiOddsGame } from "@/lib/api-sports";

const baseGame: ApiGame = {
  id: 42, date: "2026-05-01T18:00:00+00:00", status: { short: "FT" },
  teams: { home: { id: 1, name: "Canada", logo: "https://logo/1.png" }, away: { id: 2, name: "Czechia", logo: "https://logo/2.png" } },
  scores: { home: 5, away: 4 },
  periods: { first: "1-1", second: "1-2", third: "1-0", overtime: "2-1", penalties: null },
};

describe("normalizeApiGame", () => {
  it("uses regulation score for finished games and the provider name", () => {
    const g = normalizeApiGame(baseGame);
    expect(g.externalId).toBe("42");
    expect(g.status).toBe("finished");
    expect(g.homeScore).toBe(3); // 1+1+1 regulation, OT excluded
    expect(g.awayScore).toBe(3); // 1+2+0
    expect(g.home).toEqual({ externalId: "1", name: "Canada", logoUrl: "https://logo/1.png" });
  });
  it("uses raw scores for non-finished games", () => {
    const g = normalizeApiGame({ ...baseGame, status: { short: "NS" }, scores: { home: null, away: null } });
    expect(g.status).toBe("scheduled");
    expect(g.homeScore).toBeNull();
  });
});

describe("normalizeApiOdds", () => {
  it("maps a 3Way bookmaker bet into NormalizedOdds", () => {
    const oddsGame: ApiOddsGame = {
      game: { id: 42 },
      bookmakers: [{ id: 1, name: "Bet365", bets: [{ id: 1, name: "3Way Result", values: [
        { value: "Home", odd: "1.50" }, { value: "Draw", odd: "4.20" }, { value: "Away", odd: "5.00" },
      ] }] }],
    };
    expect(normalizeApiOdds(oddsGame)).toEqual({ externalGameId: "42", homeOdds: "1.50", drawOdds: "4.20", awayOdds: "5.00" });
  });
  it("returns null when no 3-way odds present", () => {
    expect(normalizeApiOdds({ game: { id: 7 }, bookmakers: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/api-sports-normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/providers/api-sports.ts
import {
  type ApiGame, type ApiOddsGame, extract3WayOdds, fetchGames,
  fetchLeagueLogoUrl, fetchOdds, mapApiStatus, parseRegulationScore,
} from "@/lib/api-sports";
import type { MatchProvider, NormalizedGame, NormalizedOdds, ProviderTournamentConfig } from "@/lib/providers/types";

export function normalizeApiGame(game: ApiGame): NormalizedGame {
  const status = mapApiStatus(game.status.short);
  const regulation = parseRegulationScore(game.periods);
  return {
    externalId: String(game.id),
    status,
    scheduledAt: new Date(game.date),
    home: { externalId: String(game.teams.home.id), name: game.teams.home.name, logoUrl: game.teams.home.logo },
    away: { externalId: String(game.teams.away.id), name: game.teams.away.name, logoUrl: game.teams.away.logo },
    homeScore: status === "finished" ? regulation.home : game.scores.home,
    awayScore: status === "finished" ? regulation.away : game.scores.away,
  };
}

export function normalizeApiOdds(oddsGame: ApiOddsGame): NormalizedOdds | null {
  const t = extract3WayOdds(oddsGame);
  if (!t) return null;
  return { externalGameId: String(oddsGame.game.id), homeOdds: t.homeOdds, drawOdds: t.drawOdds, awayOdds: t.awayOdds };
}

function assertApiSports(cfg: ProviderTournamentConfig): asserts cfg is { provider: "api-sports"; leagueId: number; season: number } {
  if (cfg.provider !== "api-sports") throw new Error(`Expected api-sports config, got ${cfg.provider}`);
}

export const apiSportsProvider: MatchProvider = {
  id: "api-sports",
  async fetchFixtures(cfg) { assertApiSports(cfg); return (await fetchGames(cfg.leagueId, cfg.season)).map(normalizeApiGame); },
  async fetchOdds(cfg) { assertApiSports(cfg); return (await fetchOdds(cfg.leagueId, cfg.season)).map(normalizeApiOdds).filter((o): o is NormalizedOdds => o !== null); },
  async fetchTournamentLogo(cfg) { assertApiSports(cfg); return fetchLeagueLogoUrl(cfg.leagueId); },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/api-sports-normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/api-sports.ts tests/lib/providers/api-sports-normalize.test.ts
git commit -m "feat(providers): add api-sports provider + normalizers"
```

### Task 3: Provider registry

**Files:**
- Create: `src/lib/providers/index.ts`
- Create: `tests/lib/providers/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/providers/registry.test.ts
import { describe, expect, it } from "vitest";
import { getProvider } from "@/lib/providers";

describe("getProvider", () => {
  it("returns the api-sports provider", () => { expect(getProvider("api-sports").id).toBe("api-sports"); });
  it("throws for an unknown provider", () => {
    // @ts-expect-error testing the runtime guard
    expect(() => getProvider("nope")).toThrow(/Unknown provider/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

> Az `oddsApiProvider` a 3. fázisban jön létre; addig a registry csak api-sports-ot tartalmaz.

```ts
// src/lib/providers/index.ts
import { apiSportsProvider } from "@/lib/providers/api-sports";
import type { MatchProvider, ProviderId } from "@/lib/providers/types";

const registry: Partial<Record<ProviderId, MatchProvider>> = { "api-sports": apiSportsProvider };

export function getProvider(id: ProviderId): MatchProvider {
  const provider = registry[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export * from "@/lib/providers/types";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/index.ts tests/lib/providers/registry.test.ts
git commit -m "feat(providers): add provider registry"
```

### Task 4: sync.ts a provideren keresztül (séma változatlan)

A DB-ben még NINCS `provider` oszlop; a configot hardcode `"api-sports"`-ként építjük. A kulcsok még a régi `apiGameId`/`apiTeamId` oszlopokon mennek.

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Import csere + fetch a provideren át**

A régi api-sports import sor helyett: `import { getProvider } from "@/lib/providers";` (a `fetchLeagueLogoUrl` import maradjon, a `backfillTournamentLogos` még közvetlenül hívja).

`syncFixtures` eleje:

```ts
export async function syncFixtures(tournament: Tournament): Promise<Map<number, string>> {
  const games = await getProvider("api-sports").fetchFixtures(
    { provider: "api-sports", leagueId: tournament.apiLeagueId, season: tournament.apiSeason }, ["hu", "en"],
  );
  const apiGameDates = new Map<number, string>();
  for (const game of games) {
    const homeTeamId = await upsertTeam(Number(game.home.externalId), game.home.name, game.home.logoUrl ?? "");
    const awayTeamId = await upsertTeam(Number(game.away.externalId), game.away.name, game.away.logoUrl ?? "");
    const newStatus = game.status;
    const apiGameId = Number(game.externalId);
    apiGameDates.set(apiGameId, game.scheduledAt.toISOString());
    const existingMatch = await db.query.matches.findFirst({ where: eq(matches.apiGameId, apiGameId) });
    // ... a meglévő if/else blokk VÁLTOZATLAN logikával, az alábbi cserékkel:
    //   regulationScore.home/away -> game.homeScore ?? 0 / game.awayScore ?? 0
    //   game.scores.home/away     -> game.homeScore / game.awayScore
    //   game.id                   -> apiGameId
    //   new Date(game.date)       -> game.scheduledAt
    //   scoreMatch(..., regulationScore.home, regulationScore.away) -> scoreMatch(..., game.homeScore ?? 0, game.awayScore ?? 0)
```

- [ ] **Step 2: `syncOdds` a provideren át**

```ts
export async function syncOdds(tournament: Tournament): Promise<void> {
  const oddsList = await getProvider("api-sports").fetchOdds({ provider: "api-sports", leagueId: tournament.apiLeagueId, season: tournament.apiSeason });
  for (const o of oddsList) {
    const match = await db.query.matches.findFirst({ where: and(eq(matches.apiGameId, Number(o.externalGameId)), eq(matches.status, "scheduled")) });
    if (!match) continue;
    await db.insert(matchOdds).values({ matchId: match.id, homeOdds: o.homeOdds, drawOdds: o.drawOdds, awayOdds: o.awayOdds });
    const betsWithoutOdds = await db.query.bets.findMany({ where: and(eq(bets.matchId, match.id), isNull(bets.oddsAtBet)) });
    for (const bet of betsWithoutOdds) {
      const relevantOdds = getRelevantOdds(bet.predictedHome, bet.predictedAway, o);
      await db.update(bets).set({ oddsAtBet: String(relevantOdds), updatedAt: new Date() }).where(eq(bets.id, bet.id));
    }
  }
}
```

- [ ] **Step 3: Teszt + build**

Run: `npm run test && npm run build`
Expected: minden meglévő teszt PASS, build SIKERES.

- [ ] **Step 4: Hívók érintetlenek**

Run: `grep -rn "syncTournament\|syncFixtures\|syncOdds\|backfillTournamentLogos" src/app src/actions`
Expected: csak hívások; `npm run build` zöld.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.ts
git commit -m "refactor(sync): route fixtures/odds through the provider layer"
```

---

## Fázis 2 — Séma-migráció + read-path (név locale + zászló-média)

### Task 5: Séma-változás + migráció

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/<generált>.sql`

- [ ] **Step 1: `src/db/schema.ts` módosítása**

Új enum: `export const providerEnum = pgEnum("provider", ["api-sports", "odds-api"]);`

`tournaments`:

```ts
  provider: providerEnum("provider").default("api-sports").notNull(),
  apiLeagueId: integer("api_league_id"),
  apiSeason: integer("api_season"),
  providerSport: text("provider_sport"),
  providerLeagueSlug: text("provider_league_slug"),
  useFlagFallback: boolean("use_flag_fallback").default(false).notNull(),
```

`teams` — `name` MARAD; `apiTeamId int UNIQUE` → `provider` + `externalId`:

```ts
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: providerEnum("provider").default("api-sports").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("teams_provider_external_idx").on(table.provider, table.externalId)],
);
```

`matches` — `apiGameId` → `externalId` + torna-szintű unique:

```ts
    externalId: text("external_id").notNull(),
    // az `apiGameId` sort töröld
  },
  (table) => [
    index("matches_tournament_status_idx").on(table.tournamentId, table.status),
    uniqueIndex("matches_tournament_external_idx").on(table.tournamentId, table.externalId),
  ],
```

- [ ] **Step 2: Migráció generálása**

Run: `npm run db:generate`
Expected: új `drizzle/NNNN_*.sql` + frissült `drizzle/meta/`.

- [ ] **Step 3: A generált `.sql` átírása biztonságos, backfilles sorrendre**

```sql
CREATE TYPE "public"."provider" AS ENUM('api-sports', 'odds-api');

-- tournaments
ALTER TABLE "tournaments" ADD COLUMN "provider" "provider" DEFAULT 'api-sports' NOT NULL;
ALTER TABLE "tournaments" ADD COLUMN "provider_sport" text;
ALTER TABLE "tournaments" ADD COLUMN "provider_league_slug" text;
ALTER TABLE "tournaments" ADD COLUMN "use_flag_fallback" boolean DEFAULT false NOT NULL;
ALTER TABLE "tournaments" ALTER COLUMN "api_league_id" DROP NOT NULL;
ALTER TABLE "tournaments" ALTER COLUMN "api_season" DROP NOT NULL;

-- teams (name MARAD)
ALTER TABLE "teams" ADD COLUMN "provider" "provider" DEFAULT 'api-sports' NOT NULL;
ALTER TABLE "teams" ADD COLUMN "external_id" text;
UPDATE "teams" SET "external_id" = "api_team_id"::text;
ALTER TABLE "teams" ALTER COLUMN "external_id" SET NOT NULL;
DROP INDEX IF EXISTS "teams_api_team_id_unique";
ALTER TABLE "teams" DROP COLUMN "api_team_id";
CREATE UNIQUE INDEX "teams_provider_external_idx" ON "teams" ("provider","external_id");

-- matches
ALTER TABLE "matches" ADD COLUMN "external_id" text;
UPDATE "matches" SET "external_id" = "api_game_id"::text;
ALTER TABLE "matches" ALTER COLUMN "external_id" SET NOT NULL;
DROP INDEX IF EXISTS "matches_api_game_id_unique";
ALTER TABLE "matches" DROP COLUMN "api_game_id";
CREATE UNIQUE INDEX "matches_tournament_external_idx" ON "matches" ("tournament_id","external_id");
```

> A `*_unique` constraint pontos neve/típusa sémafüggő — Neon `\d teams` / `\d matches` ellenőrzés. Ha CONSTRAINT: `ALTER TABLE ... DROP CONSTRAINT "..."`.

- [ ] **Step 4: Migráció futtatása (dev branch)**

Run: `npm run db:migrate`
Expected: status 0. Ha némán elhasal → Neon `dev` branch `reset_from_parent`, majd újra.

- [ ] **Step 5: Backfill ellenőrzése**

SQL: `SELECT provider, external_id, name FROM teams LIMIT 5; SELECT external_id FROM matches LIMIT 5;`
Expected: `external_id` kitöltve, `name` változatlan, `provider`='api-sports'.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): provider discriminator + external ids + flag fallback flag"
```

### Task 6: `team-country` helper (zászló + lokalizált országnév) + dep + next.config

**Files:**
- Modify: `package.json` (új dep: `i18n-iso-countries`)
- Modify: `next.config.ts` (flagcdn remote pattern)
- Create: `src/lib/providers/team-country.ts`
- Create: `tests/lib/providers/team-country.test.ts`

- [ ] **Step 1: Dep + next.config**

Run: `npm install i18n-iso-countries`

`next.config.ts` `remotePatterns` bővítése:

```ts
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "blob.iihf.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/providers/team-country.test.ts
import { describe, expect, it } from "vitest";
import { countryCodeFromName, resolveCountryDisplay } from "@/lib/providers/team-country";

describe("countryCodeFromName", () => {
  it("maps standard English country names", () => {
    expect(countryCodeFromName("Hungary")).toBe("HU");
    expect(countryCodeFromName("Brazil")).toBe("BR");
    expect(countryCodeFromName("Czechia")).toBe("CZ");
  });
  it("maps Hungarian country names", () => {
    expect(countryCodeFromName("Magyarország")).toBe("HU");
  });
  it("applies World Cup name aliases", () => {
    expect(countryCodeFromName("Korea Republic")).toBe("KR");
    expect(countryCodeFromName("USA")).toBe("US");
    expect(countryCodeFromName("Bosnia and Herzegovina")).toBe("BA");
  });
  it("returns null for non-country names", () => {
    expect(countryCodeFromName("Manchester United")).toBeNull();
    expect(countryCodeFromName(null)).toBeNull();
  });
});

describe("resolveCountryDisplay", () => {
  it("returns localized name + flag url for a country", () => {
    expect(resolveCountryDisplay("Hungary", "hu")).toEqual({ name: "Magyarország", flagUrl: "https://flagcdn.com/w80/hu.png" });
    expect(resolveCountryDisplay("Hungary", "en")).toEqual({ name: "Hungary", flagUrl: "https://flagcdn.com/w80/hu.png" });
  });
  it("returns null for a non-country", () => {
    expect(resolveCountryDisplay("Manchester United", "hu")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/team-country.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/providers/team-country.ts
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import hu from "i18n-iso-countries/langs/hu.json";
import type { Locale } from "@/lib/providers/types";

countries.registerLocale(en);
countries.registerLocale(hu);

// odds-api World Cup névváltozatok, amiket a lib nem ismer fel közvetlenül.
const ALIASES: Record<string, string> = {
  "korea republic": "KR",
  "korea dpr": "KP",
  usa: "US",
  "bosnia and herzegovina": "BA",
  "ivory coast": "CI",
  "cape verde": "CV",
};

export function countryCodeFromName(name: string | null): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return countries.getAlpha2Code(name, "en") ?? countries.getAlpha2Code(name, "hu") ?? null;
}

export function resolveCountryDisplay(
  name: string | null,
  locale: Locale,
): { name: string; flagUrl: string } | null {
  const code = countryCodeFromName(name);
  if (!code) return null;
  const localized = countries.getName(code, locale) ?? name ?? code;
  return { name: localized, flagUrl: `https://flagcdn.com/w80/${code.toLowerCase()}.png` };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/team-country.test.ts`
Expected: PASS. (Ha egy konkrét VB-név mégsem ismerős, bővítsd az `ALIASES` mapet — a teszt a kapu.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts src/lib/providers/team-country.ts tests/lib/providers/team-country.test.ts
git commit -m "feat(providers): country flag + localized name helper"
```

### Task 7: sync.ts externalId + (provider, externalId) team-kulcs

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: `Tournament` típus + config-feloldás**

```ts
import { getProvider } from "@/lib/providers";
import { toProviderConfig } from "@/lib/providers/types";
import type { ProviderId } from "@/lib/providers/types";

export type Tournament = {
  id: string;
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
  useScheduleOverrides: boolean;
};
```

`syncFixtures`/`syncOdds` eleje: `const cfg = toProviderConfig(tournament); const games = await getProvider(cfg.provider).fetchFixtures(cfg, ["hu", "en"]);`

- [ ] **Step 2: `upsertTeam` (provider, externalId) kulcsra**

```ts
async function upsertTeam(provider: ProviderId, externalId: string, name: string, logoUrl: string | null): Promise<string> {
  const [team] = await db
    .insert(teams)
    .values({ provider, externalId, name, logoUrl })
    .onConflictDoUpdate({ target: [teams.provider, teams.externalId], set: { name, logoUrl } })
    .returning({ id: teams.id });
  return team.id;
}
```

Hívás:

```ts
const homeTeamId = await upsertTeam(cfg.provider, game.home.externalId, game.home.name, game.home.logoUrl);
const awayTeamId = await upsertTeam(cfg.provider, game.away.externalId, game.away.name, game.away.logoUrl);
```

- [ ] **Step 3: Meccs-lookup/insert externalId-re, tornára szűkítve**

```ts
const apiGameDates = new Map<string, string>(); // kulcs: externalId
apiGameDates.set(game.externalId, game.scheduledAt.toISOString());
const existingMatch = await db.query.matches.findFirst({
  where: and(eq(matches.tournamentId, tournament.id), eq(matches.externalId, game.externalId)),
});
// insert:
await db.insert(matches).values({
  tournamentId: tournament.id, externalId: game.externalId, homeTeamId, awayTeamId,
  homeScore: game.homeScore, awayScore: game.awayScore, status: game.status,
  scheduledAt: game.scheduledAt, round: game.scheduledAt.toISOString().split("T")[0],
});
```

`syncFixtures` visszatérése: `Promise<Map<string, string>>`.

- [ ] **Step 4: `syncOdds` lookup externalId + tornára szűkítve**

```ts
const match = await db.query.matches.findFirst({
  where: and(eq(matches.tournamentId, tournament.id), eq(matches.externalId, o.externalGameId), eq(matches.status, "scheduled")),
});
```

- [ ] **Step 5: `handleScheduleOverrides` externalId-re**

A select `apiGameId: matches.apiGameId` → `externalId: matches.externalId`; `apiGameDates.get(o.apiGameId)` → `apiGameDates.get(o.externalId)`; az `overrides`/`pairs` típusok string kulcsra.

- [ ] **Step 6: `backfillTournamentLogos` opcionális provider-logóval**

```ts
export async function backfillTournamentLogos(tournamentList: (Tournament & { logoUrl: string | null })[]): Promise<void> {
  for (const tournament of tournamentList) {
    if (tournament.logoUrl) continue;
    const cfg = toProviderConfig(tournament);
    const provider = getProvider(cfg.provider);
    const logoUrl = provider.fetchTournamentLogo ? await provider.fetchTournamentLogo(cfg) : null;
    if (logoUrl) await db.update(tournaments).set({ logoUrl }).where(eq(tournaments.id, tournament.id));
  }
}
```

A `fetchLeagueLogoUrl` import most elhagyható a `sync.ts`-ből.

- [ ] **Step 7: Teszt + build**

Run: `npm run test && npm run build`
Expected: zöld.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sync.ts
git commit -m "refactor(sync): external ids + (provider,externalId) team key"
```

### Task 8: Read-path — query-réteg lokalizált név + zászló (csak zászlós tornak)

A `teams.name`/`logoUrl` mindig jelen van → a nem-zászlós utak változatlanok. A zászlós tornaknál a query-réteg az ország-kódból felülírja a nevet (lokalizált) és a logót (zászló).

**Files:**
- Create: `src/queries/team-display.ts`
- Modify: `src/queries/matches.ts`, `src/queries/podium.ts`, `src/queries/bets.ts`
- Modify: a hívó oldalak, ahol `useFlagFallback`/`locale` átadandó

- [ ] **Step 1: Megosztott mapper**

```ts
// src/queries/team-display.ts
import { resolveCountryDisplay } from "@/lib/providers/team-country";
import type { Locale } from "@/lib/providers/types";

type TeamRow = { name: string; logoUrl: string | null };

export function withTeamDisplay<T extends TeamRow>(team: T, locale: Locale, useFlagFallback: boolean): T {
  if (!useFlagFallback) return team;
  const c = resolveCountryDisplay(team.name, locale);
  if (!c) return team;
  return { ...team, name: c.name, logoUrl: team.logoUrl ?? c.flagUrl };
}

export function withMatchTeamDisplay<M extends { homeTeam: TeamRow; awayTeam: TeamRow }>(
  match: M, locale: Locale, useFlagFallback: boolean,
): M {
  return { ...match, homeTeam: withTeamDisplay(match.homeTeam, locale, useFlagFallback), awayTeam: withTeamDisplay(match.awayTeam, locale, useFlagFallback) };
}
```

- [ ] **Step 2: `queries/matches.ts` — locale + useFlagFallback + mapping**

A match-visszaadó függvények (`getMatchesForTournament`, `getMatchById`, `getFinishedMatchesForTournament`, `getUpcomingBetSummary`) kapjanak `locale: Locale` + `useFlagFallback: boolean` paramétert, és a visszatérés előtt `withMatchTeamDisplay(row, locale, useFlagFallback)`. Példa:

```ts
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/providers/types";
import { withMatchTeamDisplay } from "@/queries/team-display";

export async function getMatchesForTournament(tournamentId: string, useFlagFallback: boolean) {
  const locale = (await getLocale()) as Locale;
  const rows = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournamentId),
    with: { homeTeam: true, awayTeam: true, odds: { orderBy: [desc(matchOdds.fetchedAt)], limit: 1 } },
    orderBy: [matches.scheduledAt],
  });
  return rows.map((r) => withMatchTeamDisplay(r, locale, useFlagFallback));
}
```

> A `locale`-t a query `getLocale()`-lel maga oldja fel (server-only) → a hívók többségét nem kell bántani; csak a `useFlagFallback`-et kell átadni (a betöltött tornából: `tournament.useFlagFallback`). `getMatchById` a `tournament: true` relációból olvashatja.

- [ ] **Step 3: `queries/podium.ts` + `queries/bets.ts`**

`podium.ts`: a torna-csapatlista (`name: teams.name` select MARAD) + `logoUrl` kiegészítve `withTeamDisplay`-jel (locale + a torna `useFlagFallback`-je). `bets.ts`: a `homeTeam`/`awayTeam`-et visszaadó query (103 körül) kapjon `useFlagFallback`-et és `withMatchTeamDisplay`-t (`locale` belül `getLocale()`).

- [ ] **Step 4: Hívók — `useFlagFallback` átadása**

Run: `grep -rn "getMatchesForTournament\|getMatchById\|getFinishedMatchesForTournament\|getUpcomingBetSummary\|getGroupBets\|getUserBets" src/app src/components src/actions`

A `useFlagFallback` a betöltött tornából jön. Add át.

- [ ] **Step 5: Read-path teljesség — podium/admin**

Run: `grep -rn "\.name" src/components/podium-form.tsx src/components/podium-team-list.tsx src/components/admin-panel.tsx | grep -i team`

A podium torna-csapatlista és az `admin-panel.tsx` finish-torna csapatválasztó (`{team.name}`, ~562) is `withTeamDisplay`-en át kapja a `name`/`logoUrl`-t (a finish-picker is a torna `useFlagFallback`-jét használja).

- [ ] **Step 6: Teszt + build + lint**

Run: `npm run test && npm run build && npm run check`
Expected: zöld.

- [ ] **Step 7: Commit**

```bash
git add src/queries src/app src/components src/actions
git commit -m "feat(queries): flag + localized country names for national tournaments"
```

### Task 9: Regresszió (2. fázis zárása)

- [ ] **Step 1:** Run: `npm run test && npm run build`
Expected: zöld. Az app api-sports-only; a hoki-logók/nevek változatlanok (`useFlagFallback=false` → no-op mapper).

---

## Fázis 3 — odds-api provider

### Task 10: odds-api kliens (`/events`, `/odds`, `/leagues`)

**Files:**
- Create: `src/lib/providers/odds-api/client.ts`
- Create: `tests/lib/providers/odds-api-client.test.ts`

- [ ] **Step 1: Write the failing test (mockolt fetch)**

```ts
// tests/lib/providers/odds-api-client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOddsApiClient } from "@/lib/providers/odds-api/client";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("fetches events for a league", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    expect(url).toContain("/v3/events");
    expect(url).toContain("sport=football");
    expect(url).toContain("league=international-world-cup");
    expect(url).toContain("apiKey=k");
    return new Response(JSON.stringify([
      { id: 1, home: "Hungary", away: "Brazil", homeId: 10, awayId: 20, date: "2026-06-01T18:00:00Z", status: "pending", scores: { home: 0, away: 0 } },
    ]), { status: 200 });
  }));
  const events = await createOddsApiClient().fetchEvents("football", "international-world-cup");
  expect(events[0].id).toBe(1);
});

it("requests odds with the bookmakers param", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    expect(url).toContain("/v3/odds");
    expect(url).toContain("eventId=1");
    expect(url).toContain("bookmakers=TippmixPRO%2CBet365");
    return new Response(JSON.stringify({ bookmakers: { TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }] } }), { status: 200 });
  }));
  const resp = await createOddsApiClient().fetchEventOdds(1, ["TippmixPRO", "Bet365"]);
  expect(resp.bookmakers.TippmixPRO[0].name).toBe("ML");
});

it("throws when ODDS_API_KEY is missing", () => {
  expect(() => createOddsApiClient()).toThrow(/ODDS_API_KEY/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/odds-api-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/providers/odds-api/client.ts
const BASE = "https://api.odds-api.io/v3";

export interface OddsApiEvent {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string;
  status: "pending" | "live" | "settled";
  scores: { home: number; away: number; periods?: { fulltime?: { home: number; away: number } } } | null;
}

export interface OddsApiOddsResponse {
  bookmakers: Record<string, Array<{ name: string; odds: Array<{ home: string; draw: string; away: string }> }>>;
}

export function createOddsApiClient() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY is not set");

  async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ apiKey, ...params }).toString();
    const res = await fetch(`${BASE}${path}?${qs}`);
    if (!res.ok) throw new Error(`odds-api ${path} HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    fetchLeagues: (sport: string) => getJson<Array<{ name: string; slug: string; eventsCount: number }>>("/leagues", { sport }),
    fetchEvents: (sport: string, leagueSlug: string) => getJson<OddsApiEvent[]>("/events", { sport, league: leagueSlug }),
    fetchEventOdds: (eventId: number, bookmakers: string[]) =>
      getJson<OddsApiOddsResponse>("/odds", { eventId: String(eventId), bookmakers: bookmakers.join(",") }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/odds-api-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/odds-api/client.ts tests/lib/providers/odds-api-client.test.ts
git commit -m "feat(odds-api): client for events/odds/leagues"
```

### Task 11: odds-api normalizálók (status, score, bookmaker-választó, 3-way)

**Files:**
- Create: `src/lib/providers/odds-api/normalize.ts`
- Create: `tests/lib/providers/odds-api-normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/providers/odds-api-normalize.test.ts
import { describe, expect, it } from "vitest";
import { ODDS_API_BOOKMAKERS, normalizeOddsApiEvent, selectOddsApiOdds } from "@/lib/providers/odds-api/normalize";
import type { OddsApiEvent } from "@/lib/providers/odds-api/client";

const settled: OddsApiEvent = {
  id: 1, home: "Hungary", away: "Brazil", homeId: 10, awayId: 20,
  date: "2026-06-01T18:00:00Z", status: "settled",
  scores: { home: 1, away: 3, periods: { fulltime: { home: 1, away: 3 } } },
};

describe("normalizeOddsApiEvent", () => {
  it("maps a settled event to finished with fulltime score and provider name (no logo)", () => {
    const g = normalizeOddsApiEvent(settled);
    expect(g.externalId).toBe("1");
    expect(g.status).toBe("finished");
    expect(g.homeScore).toBe(1);
    expect(g.awayScore).toBe(3);
    expect(g.home).toEqual({ externalId: "10", name: "Hungary", logoUrl: null });
  });
  it("maps pending to scheduled and ignores the {0,0} placeholder score", () => {
    const g = normalizeOddsApiEvent({ ...settled, status: "pending", scores: { home: 0, away: 0 } });
    expect(g.status).toBe("scheduled");
    expect(g.homeScore).toBeNull();
    expect(g.awayScore).toBeNull();
  });
});

describe("selectOddsApiOdds", () => {
  const resp = { bookmakers: {
    Bet365: [{ name: "ML", odds: [{ home: "1.48", draw: "4.33", away: "6.50" }] }],
    TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }],
  } };
  it("prefers TippmixPRO over Bet365", () => {
    expect(selectOddsApiOdds("1", resp)).toEqual({ externalGameId: "1", homeOdds: "1.46", drawOdds: "4.20", awayOdds: "6.75" });
  });
  it("falls back to any bookmaker with an ML market", () => {
    expect(selectOddsApiOdds("1", { bookmakers: { Unibet: [{ name: "ML", odds: [{ home: "2.0", draw: "3.0", away: "3.0" }] }] } }))
      .toEqual({ externalGameId: "1", homeOdds: "2.0", drawOdds: "3.0", awayOdds: "3.0" });
  });
  it("returns null when no ML market exists", () => {
    expect(selectOddsApiOdds("1", { bookmakers: { Bet365: [{ name: "Totals", odds: [] }] } })).toBeNull();
  });
  it("exposes the preferred bookmaker list (HU first)", () => {
    expect(ODDS_API_BOOKMAKERS).toEqual(["TippmixPRO", "Bet365"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/odds-api-normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/providers/odds-api/normalize.ts
import type { OddsApiEvent, OddsApiOddsResponse } from "@/lib/providers/odds-api/client";
import type { MatchStatus, NormalizedGame, NormalizedOdds } from "@/lib/providers/types";

export const ODDS_API_BOOKMAKERS = ["TippmixPRO", "Bet365"];

const STATUS_MAP: Record<OddsApiEvent["status"], MatchStatus> = { pending: "scheduled", live: "live", settled: "finished" };

export function normalizeOddsApiEvent(e: OddsApiEvent): NormalizedGame {
  const status = STATUS_MAP[e.status] ?? "scheduled";
  const ft = e.scores?.periods?.fulltime;
  const home = status === "finished" ? (ft?.home ?? e.scores?.home ?? null) : null;
  const away = status === "finished" ? (ft?.away ?? e.scores?.away ?? null) : null;
  return {
    externalId: String(e.id),
    status,
    scheduledAt: new Date(e.date),
    home: { externalId: String(e.homeId), name: e.home, logoUrl: null },
    away: { externalId: String(e.awayId), name: e.away, logoUrl: null },
    homeScore: home,
    awayScore: away,
  };
}

export function selectOddsApiOdds(eventId: string, resp: OddsApiOddsResponse): NormalizedOdds | null {
  const names = [...ODDS_API_BOOKMAKERS, ...Object.keys(resp.bookmakers).filter((n) => !ODDS_API_BOOKMAKERS.includes(n))];
  for (const name of names) {
    const ml = resp.bookmakers[name]?.find((m) => m.name === "ML");
    const odd = ml?.odds[0];
    if (odd?.home != null && odd.draw != null && odd.away != null) {
      return { externalGameId: eventId, homeOdds: odd.home, drawOdds: odd.draw, awayOdds: odd.away };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/odds-api-normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/odds-api/normalize.ts tests/lib/providers/odds-api-normalize.test.ts
git commit -m "feat(odds-api): event/odds normalizers + bookmaker selection"
```

### Task 12: odds-api provider + registry bekötés

**Files:**
- Create: `src/lib/providers/odds-api/index.ts`
- Modify: `src/lib/providers/index.ts`
- Create: `tests/lib/providers/odds-api-provider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/providers/odds-api-provider.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "@/lib/providers";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const cfg = { provider: "odds-api" as const, sport: "football", leagueSlug: "international-world-cup" };

it("is registered", () => { expect(getProvider("odds-api").id).toBe("odds-api"); });

it("fetchFixtures normalizes events", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
    { id: 1, home: "Hungary", away: "Brazil", homeId: 10, awayId: 20, date: "2026-06-01T18:00:00Z", status: "pending", scores: { home: 0, away: 0 } },
  ]), { status: 200 })));
  const games = await getProvider("odds-api").fetchFixtures(cfg, ["hu", "en"]);
  expect(games[0].externalId).toBe("1");
  expect(games[0].home.name).toBe("Hungary");
});

it("fetchOdds fetches per-event odds for pending events", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    if (url.includes("/events")) return new Response(JSON.stringify([
      { id: 1, home: "Hungary", away: "Brazil", homeId: 10, awayId: 20, date: "2026-06-01T18:00:00Z", status: "pending", scores: { home: 0, away: 0 } },
      { id: 2, home: "Spain", away: "Japan", homeId: 30, awayId: 40, date: "2026-06-02T18:00:00Z", status: "settled", scores: { home: 1, away: 1 } },
    ]), { status: 200 });
    return new Response(JSON.stringify({ bookmakers: { TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }] } }), { status: 200 });
  }));
  const odds = await getProvider("odds-api").fetchOdds(cfg);
  expect(odds).toEqual([{ externalGameId: "1", homeOdds: "1.46", drawOdds: "4.20", awayOdds: "6.75" }]);
  expect(calls.filter((u) => u.includes("/odds")).length).toBe(1); // csak a pending eseményre
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/providers/odds-api-provider.test.ts`
Expected: FAIL — `getProvider("odds-api")` throws "Unknown provider".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/providers/odds-api/index.ts
import { createOddsApiClient } from "@/lib/providers/odds-api/client";
import { ODDS_API_BOOKMAKERS, normalizeOddsApiEvent, selectOddsApiOdds } from "@/lib/providers/odds-api/normalize";
import type { MatchProvider, NormalizedOdds, ProviderTournamentConfig } from "@/lib/providers/types";

function assertOddsApi(cfg: ProviderTournamentConfig): asserts cfg is { provider: "odds-api"; sport: string; leagueSlug: string } {
  if (cfg.provider !== "odds-api") throw new Error(`Expected odds-api config, got ${cfg.provider}`);
}

export const oddsApiProvider: MatchProvider = {
  id: "odds-api",
  async fetchFixtures(cfg) {
    assertOddsApi(cfg);
    return (await createOddsApiClient().fetchEvents(cfg.sport, cfg.leagueSlug)).map(normalizeOddsApiEvent);
  },
  async fetchOdds(cfg) {
    assertOddsApi(cfg);
    const client = createOddsApiClient();
    const events = await client.fetchEvents(cfg.sport, cfg.leagueSlug);
    const out: NormalizedOdds[] = [];
    for (const e of events) {
      if (e.status !== "pending") continue;
      const resp = await client.fetchEventOdds(e.id, ODDS_API_BOOKMAKERS);
      const odds = selectOddsApiOdds(String(e.id), resp);
      if (odds) out.push(odds);
    }
    return out;
  },
};
```

Registry:

```ts
// src/lib/providers/index.ts
import { apiSportsProvider } from "@/lib/providers/api-sports";
import { oddsApiProvider } from "@/lib/providers/odds-api";
import type { MatchProvider, ProviderId } from "@/lib/providers/types";

const registry: Record<ProviderId, MatchProvider> = { "api-sports": apiSportsProvider, "odds-api": oddsApiProvider };

export function getProvider(id: ProviderId): MatchProvider {
  const provider = registry[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export * from "@/lib/providers/types";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/providers/odds-api-provider.test.ts tests/lib/providers/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/odds-api/index.ts src/lib/providers/index.ts tests/lib/providers/odds-api-provider.test.ts
git commit -m "feat(odds-api): register provider (fixtures + per-event odds)"
```

> **Megjegyzés (igazolt):** a World Cup-lefedettség éles kulccsal ellenőrizve (`international-world-cup`, 104 esemény, `TippmixPRO`+`Bet365` ML 3-way odds). A `/odds/multi` (max 10 eventId) batch dokumentált, de nem verifikált → későbbi optimalizáció; egyelőre per-event `/odds` (104 « 5000 req/óra).

---

## Fázis 4 — Admin UI: provider-választó + feltételes mezők + zászló-kapcsoló

### Task 13: `createTournament` action provider-rel + zászló-kapcsolóval

**Files:**
- Modify: `src/actions/admin.ts`

- [ ] **Step 1: `CreateTournamentInput` + insert**

```ts
import type { ProviderId } from "@/lib/providers/types";

interface CreateTournamentInput {
  name: string;
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
  useFlagFallback: boolean;
  podiumLockDate: Date;
  timezone: string;
}

export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const slug = slugify(input.name);
  const logoUrl =
    input.provider === "api-sports" && input.apiLeagueId != null ? await fetchLeagueLogoUrl(input.apiLeagueId) : null;

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name, slug, provider: input.provider,
      apiLeagueId: input.apiLeagueId, apiSeason: input.apiSeason,
      providerSport: input.providerSport, providerLeagueSlug: input.providerLeagueSlug,
      useFlagFallback: input.useFlagFallback,
      podiumLockDate: input.podiumLockDate, timezone: input.timezone, logoUrl,
    })
    .returning();

  await createOfficialGroup(tournament.id);
  return tournament;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: típushiba a `admin-panel.tsx` hívásnál (Task 14 javítja).

- [ ] **Step 3: Commit**

```bash
git add src/actions/admin.ts
git commit -m "feat(admin): createTournament accepts provider + flag fallback"
```

### Task 14: Admin form — provider-választó + feltételes mezők + zászló-kapcsoló + fordítások

**Files:**
- Modify: `src/components/admin-panel.tsx`
- Modify: `src/app/[locale]/admin/page.tsx`
- Modify: `messages/hu.json`, `messages/en.json`

- [ ] **Step 1: Fordítási kulcsok**

`messages/hu.json` admin szekció:

```json
"provider": "Adatforrás",
"providerApiSports": "api-sports.io (hoki)",
"providerOddsApi": "odds-api.io",
"sport": "Sport (slug)",
"leagueSlug": "Liga (slug)",
"useFlagFallback": "Zászlók logó helyett (nemzeti csapatok)"
```

`messages/en.json` ugyanezek angolul (`"Data source"`, `"Sport (slug)"`, `"League (slug)"`, `"Flags instead of logos (national teams)"`).

- [ ] **Step 2: Form — provider-select + feltételes mezők + zászló-kapcsoló**

Shadcn `Select` a providernek (`api-sports` / `odds-api`); a választott provider szerint:
- `api-sports`: `leagueId` + `season` (meglévő mezők).
- `odds-api`: `sport` (pl. `football`) + `leagueSlug` (pl. `international-world-cup`) szöveges mezők.
Plusz Shadcn `Switch` a `useFlagFallback`-hez. Submit a providernek megfelelő mezőket küldi (a másikat `null`), `useFlagFallback`-kel. Minden címke `t("...")`.

- [ ] **Step 3: Torna lista provider-mezői**

`admin/page.tsx` + lista-render (`admin-panel.tsx` ~360): `tour.provider` szerint api-sports → leagueId/season; odds-api → sport/leagueSlug; `useFlagFallback` állapot jelzése.

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run check`
Expected: zöld; nincs hardcoded string.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-panel.tsx src/app/[locale]/admin/page.tsx messages/hu.json messages/en.json
git commit -m "feat(admin): provider selector + odds-api fields + flag-fallback toggle"
```

---

## Önellenőrzés (spec-coverage)

| Spec-követelmény | Lefedő task |
|---|---|
| Provider-interfész (kötelező/opcionális műveletek) | Task 1 |
| sync provider-agnosztikus + dispatch | Task 4, 7 |
| Séma-migráció (pontos lépések, backfill) | Task 5 |
| Team-identitás (provider-namespace) + migráció | Task 5, 7 |
| Zászló + lokalizált országnév (per-torna `useFlagFallback`) | Task 5 (oszlop), 6 (`team-country`+next.config), 8 (query-réteg) |
| odds-api kliens + enumeráció (triviális) | Task 10, 12 |
| Bookmaker-választás (TippmixPRO/Bet365) + odds-normalizálás | Task 11 |
| odds-api status/score (cancelled hiány dokumentálva) | Task 11 |
| Admin UI (provider + mezők + zászló) | Task 13, 14 |
| Fázisokra bontás (önállóan szállítható) | Fázis 1–4 |
| Tesztstratégia (TDD, pure parserek, scoring érintetlen) | Task 1,2,3,6,10,11,12 + meglévő tesztek |

## Kockázatok és mérséklés

- **Migrációs constraint-nevek** (Task 5): sémafüggők — Neon `\d` ellenőrzés a DROP előtt.
- **Read-path** (Task 8): `team.name`/`logoUrl` mindig jelen (nincs átnevezés) → kis churn; csak a zászlós tornak kapnak felülírást; `npm run build` a háló.
- **Dev-branch napló elcsúszás** (Task 5): `reset_from_parent`.
- **`cancelled` státusz** odds-api-ban nincs → refund odds-api tornán nem automatikus (dokumentált korlát; kézi vagy későbbi finomítás).
- **Országnév-aliasok** (Task 6): `ALIASES` map + teszt; ismeretlen név → angol név + inicálé fallback.
