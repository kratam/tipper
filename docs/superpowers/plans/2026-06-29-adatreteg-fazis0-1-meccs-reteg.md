# Adatréteg egységesítés — Fázis 0+1 (TanStack-infra + meccs-réteg) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bevezetni a TanStack Query alapú kliens-adat-réteget és átkötni a meccs-eredmény nézeteket (MatchCard + TipMatrix) egyetlen közös igazságforrásra, hogy egy meccs vége után mindkettő konzisztensen frissüljön.

**Architecture:** TanStack Query mint kliens-cache. Egy torna-szintű `matches` query (score/status/tippek+payout) az egyetlen igazságforrás a meccs-eredményre; a MatchCard és a TipMatrix is ebből olvas. A TipMatrix `useState`-cache-e megszűnik, helyette a forduló-szerkezet egy `tipMatrix` query-ből jön, a változó score/payout pedig a `matches` query-ből egy pure merge-dzsel. Az SSR-átadás `HydrationBoundary`-vel egységes. A `matches` query-t tippadás után `invalidateQueries` frissíti.

**Tech Stack:** Next.js 16.2.2 (App Router), React 19.2.4, TanStack Query v5, TypeScript strict, Drizzle ORM, Vitest, Biome.

## Global Constraints

- Next.js **16.2.2**, React **19.2.4** — nincs verzióemelés ezen a terven.
- TanStack Query a **kliens**-réteg; SWR egyelőre **marad** (notification + leaderboard csak a Fázis 2–3 tervben kerül át) — ebben a tervben **mindkét provider** él egymás mellett.
- Minden UI-szöveg `useTranslations()`/`getTranslations()` — ez a terv nem vezet be új user-facing stringet.
- Server Actions: `"use server"` + `getCurrentUser()` ellenőrzés minden actionben.
- DB: Drizzle query API, nem raw SQL.
- Commit: conventional commits (feat/fix/chore/docs/refactor). Minden task végén commit.
- Tesztek: Vitest, TDD a pure logikára. A pure transzformációk (`query-keys`, `mergeMatchData`, `applyLiveScores`) tesztelve; a provider/hook/komponens-átkötés verifikációja `npm run check` + `npm run build` zöld.
- Magyar nyelvű kód-kommentek, ékezetekkel.

---

### Task 1: TanStack Query infrastruktúra (provider + query client)

**Files:**
- Create: `src/lib/query-client.ts`
- Create: `src/components/query-provider.tsx`
- Modify: `src/app/[locale]/layout.tsx:5` (import), `:40-44` (provider beágyazás)
- Modify: `package.json` (függőségek)

**Interfaces:**
- Produces: `makeQueryClient(): QueryClient`, `getQueryClient(): QueryClient` (`src/lib/query-client.ts`); `QueryProvider({children})` (`src/components/query-provider.tsx`).

- [ ] **Step 1: TanStack Query telepítése**

Run:
```bash
npm install @tanstack/react-query@^5 && npm install -D @tanstack/react-query-devtools@^5
```
Expected: `package.json` dependencies közé bekerül `@tanstack/react-query`, devDependencies közé `@tanstack/react-query-devtools`.

- [ ] **Step 2: Query client factory**

Create `src/lib/query-client.ts`:
```ts
import { QueryClient, isServer } from "@tanstack/react-query";

// Közös default beállítások szerverre és kliensre.
// staleTime: 30s — a HydrationBoundary-vel prefetch-elt adat ne refetch-eljen
// azonnal a kliensen mount után (különben dupla fetch).
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// Szerveren mindig friss klienst adunk (kérés-izoláció); böngészőben singletont,
// hogy a HydrationBoundary ugyanabba a cache-be töltsön, amit a hookok olvasnak.
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

- [ ] **Step 3: Provider komponens**

Create `src/components/query-provider.tsx`:
```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Beágyazás a layoutba**

`src/app/[locale]/layout.tsx` — a `SWRProvider` import alá add a `QueryProvider` importot, és csomagold a `SWRProvider`-t a `QueryProvider`-be.

Import (a `:5` SWRProvider import után):
```tsx
import { QueryProvider } from "@/components/query-provider";
```

A `return` JSX-ben (`:39-45`) cseréld le:
```tsx
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <SWRProvider>
          <Nav user={navUser} activeTournaments={activeTournaments} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <Toaster />
        </SWRProvider>
      </QueryProvider>
    </NextIntlClientProvider>
```

- [ ] **Step 5: Verifikáció**

Run: `npm run check && npm run build`
Expected: Biome zöld, build sikeres (provider helyesen mountol).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/query-client.ts src/components/query-provider.tsx src/app/[locale]/layout.tsx
git commit -m "feat(adatreteg): TanStack Query provider + query client infra"
```

---

### Task 2: Query-kulcs registry

**Files:**
- Create: `src/lib/live/query-keys.ts`
- Test: `src/lib/live/query-keys.test.ts`

**Interfaces:**
- Produces: `liveKeys` objektum a következő kulcs-factory-kkal: `matches(tid)`, `tournament(tid)`, `group(gid)`, `leaderboard(gid)`, `balance(gid)`, `tipMatrix(gid, roundKey)`, `notifications.unread()`, `notifications.list()`.

- [ ] **Step 1: Failing test**

Create `src/lib/live/query-keys.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { liveKeys } from "./query-keys";

describe("liveKeys", () => {
  it("a matches kulcs a torna-id alá hierarchizál", () => {
    expect(liveKeys.matches("t1")).toEqual(["tournament", "t1", "matches"]);
  });

  it("a tournament prefix része a matches kulcsnak (prefix-invalidációhoz)", () => {
    const prefix = liveKeys.tournament("t1");
    const matches = liveKeys.matches("t1");
    expect(matches.slice(0, prefix.length)).toEqual(prefix);
  });

  it("a group prefix része a leaderboard/balance/tipMatrix kulcsoknak", () => {
    const prefix = liveKeys.group("g1");
    expect(liveKeys.leaderboard("g1").slice(0, prefix.length)).toEqual(prefix);
    expect(liveKeys.balance("g1").slice(0, prefix.length)).toEqual(prefix);
    expect(liveKeys.tipMatrix("g1", "r1").slice(0, prefix.length)).toEqual(prefix);
  });

  it("a tipMatrix kulcs a roundKey-t is tartalmazza", () => {
    expect(liveKeys.tipMatrix("g1", "r1")).toEqual(["group", "g1", "tipMatrix", "r1"]);
  });

  it("a notifications kulcsok stabilak", () => {
    expect(liveKeys.notifications.unread()).toEqual(["notifications", "unread"]);
    expect(liveKeys.notifications.list()).toEqual(["notifications", "list"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- query-keys`
Expected: FAIL — `Cannot find module './query-keys'`.

- [ ] **Step 3: Implementáció**

Create `src/lib/live/query-keys.ts`:
```ts
// Központi query-kulcs registry. Minden élő-adat kulcs innen jön — nincs
// szétszórt ad-hoc kulcs a komponensekben. A hierarchia (torna → group →
// domain) prefix-alapú invalidációt tesz lehetővé: pl. invalidateQueries a
// group(gid) prefixre egyszerre frissíti a leaderboard/balance/tipMatrix-ot.
export const liveKeys = {
  tournament: (tid: string) => ["tournament", tid] as const,
  matches: (tid: string) => ["tournament", tid, "matches"] as const,

  group: (gid: string) => ["group", gid] as const,
  leaderboard: (gid: string) => ["group", gid, "leaderboard"] as const,
  balance: (gid: string) => ["group", gid, "balance"] as const,
  tipMatrix: (gid: string, roundKey: string) => ["group", gid, "tipMatrix", roundKey] as const,

  notifications: {
    unread: () => ["notifications", "unread"] as const,
    list: () => ["notifications", "list"] as const,
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- query-keys`
Expected: PASS (5 teszt).

- [ ] **Step 5: Commit**

```bash
git add src/lib/live/query-keys.ts src/lib/live/query-keys.test.ts
git commit -m "feat(adatreteg): központi query-kulcs registry"
```

---

### Task 3: Meccs-merge pure logika kiemelése + tesztelése

A jelenlegi `mergeMatchData` a `use-match-polling.ts`-ben él, beágyazva. Kiemeljük egy önálló, tesztelt pure modulba, hogy a hook (Task 4) és a TipMatrix (Task 6) is használhassa.

**Files:**
- Create: `src/lib/live/merge-match-data.ts`
- Test: `src/lib/live/merge-match-data.test.ts`

**Interfaces:**
- Consumes: `MatchCardData` (`@/components/match-card`), `LiveMatchData` (`@/actions/live`).
- Produces: `mergeMatchData(matches: readonly MatchCardData[], liveData: LiveMatchData[] | undefined): MatchCardData[]`.

- [ ] **Step 1: Failing test**

Create `src/lib/live/merge-match-data.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { LiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";
import { mergeMatchData } from "./merge-match-data";

const baseMatch: MatchCardData = {
  id: "m1",
  homeTeam: { name: "A", logoUrl: null },
  awayTeam: { name: "B", logoUrl: null },
  homeScore: null,
  awayScore: null,
  status: "scheduled",
  scheduledAt: "2026-06-29T18:00:00.000Z",
  round: "2026-06-29",
  odds: null,
  participantsKnown: true,
  userBets: [
    {
      id: "b1",
      predictedHome: 2,
      predictedAway: 1,
      stake: 10,
      result1x2Correct: null,
      goalDiffCorrect: null,
      exactScoreCorrect: null,
      payout: null,
      groupName: "G",
    },
  ],
};

describe("mergeMatchData", () => {
  it("liveData hiányában a meccseket változatlanul (másolatban) adja vissza", () => {
    const out = mergeMatchData([baseMatch], undefined);
    expect(out).toEqual([baseMatch]);
  });

  it("a friss score-t és status-t beolvasztja", () => {
    const live: LiveMatchData[] = [
      { matchId: "m1", homeScore: 3, awayScore: 1, status: "finished", userBets: [] },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0].homeScore).toBe(3);
    expect(out[0].awayScore).toBe(1);
    expect(out[0].status).toBe("finished");
  });

  it("a tipp payout/helyesség mezőit a betId egyezés alapján frissíti", () => {
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            betId: "b1",
            matchId: "m1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 42,
          },
        ],
      },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0].userBets[0].payout).toBe(42);
    expect(out[0].userBets[0].result1x2Correct).toBe(true);
  });

  it("nem érintett meccset érintetlenül hagy", () => {
    const live: LiveMatchData[] = [
      { matchId: "other", homeScore: 1, awayScore: 0, status: "finished", userBets: [] },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0]).toEqual(baseMatch);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- merge-match-data`
Expected: FAIL — `Cannot find module './merge-match-data'`.

- [ ] **Step 3: Implementáció (a logika a `use-match-polling.ts:23-53`-ból emelve)**

Create `src/lib/live/merge-match-data.ts`:
```ts
import type { LiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";

// A torna-szintű élő snapshot (score/status/tipp-payout) beolvasztása a
// statikus meccs-kártya adatba. Pure: ugyanazt a `matches` snapshotot
// használja a MatchCard és a TipMatrix is → egyetlen igazságforrás.
export function mergeMatchData(
  matches: readonly MatchCardData[],
  liveData: LiveMatchData[] | undefined,
): MatchCardData[] {
  if (!liveData) return [...matches];

  const liveMap = new Map(liveData.map((m) => [m.matchId, m]));

  return matches.map((match) => {
    const live = liveMap.get(match.id);
    if (!live) return match;

    return {
      ...match,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      status: live.status,
      userBets: match.userBets.map((bet) => {
        const liveBet = live.userBets.find((lb) => lb.betId === bet.id);
        if (!liveBet) return bet;
        return {
          ...bet,
          result1x2Correct: liveBet.result1x2Correct,
          goalDiffCorrect: liveBet.goalDiffCorrect,
          exactScoreCorrect: liveBet.exactScoreCorrect,
          payout: liveBet.payout,
        };
      }),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- merge-match-data`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add src/lib/live/merge-match-data.ts src/lib/live/merge-match-data.test.ts
git commit -m "refactor(adatreteg): mergeMatchData pure modulba kiemelve + tesztelve"
```

---

### Task 4: `useMatches` hook (a `matches` query)

A `useMatchPolling` TanStack-portja: a `getLiveMatchData` actionre épülő `useQuery`, a meglévő `inMatchWindow` polling-ablakkal, és a kiemelt `mergeMatchData`-val.

**Files:**
- Create: `src/hooks/live/use-matches.ts`
- Reference: `src/lib/match-poll-window.ts` (`inMatchWindow`), `src/actions/live.ts` (`getLiveMatchData`)

**Interfaces:**
- Consumes: `liveKeys.matches` (Task 2), `mergeMatchData` (Task 3), `getLiveMatchData` (`@/actions/live`), `MatchCardData` (`@/components/match-card`).
- Produces: `useMatches(tournamentId: string, matches: readonly MatchCardData[]): MatchCardData[]`.

- [ ] **Step 1: Implementáció**

Create `src/hooks/live/use-matches.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getLiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";
import { mergeMatchData } from "@/lib/live/merge-match-data";
import { liveKeys } from "@/lib/live/query-keys";
import { inMatchWindow } from "@/lib/match-poll-window";

const ONE_MINUTE = 60 * 1000;
const TICK_MS = 60 * 1000;

// A torna meccseinek élő rétege (score/status/tipp-payout). A statikus
// `matches` propot (SSR) beolvasztja a TanStack cache friss snapshotjával.
// Nincs élő score (odds-api nem adja), ezért a polling csak a meccs-ablakban
// fut (~1 perc), egyébként ki van kapcsolva.
export function useMatches(
  tournamentId: string,
  matches: readonly MatchCardData[],
): MatchCardData[] {
  // A meccs-ablakot percenként újraértékeljük, hogy egy nyitva felejtett tab
  // DB-hívás nélkül le-/felpörögjön, amikor az ablak be-/kinyílik.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const matchTimes = useMemo(() => matches.map((m) => Date.parse(m.scheduledAt)), [matches]);
  const active = useMemo(() => inMatchWindow(matchTimes, now), [matchTimes, now]);

  const { data } = useQuery({
    queryKey: liveKeys.matches(tournamentId),
    queryFn: () => getLiveMatchData(tournamentId),
    refetchInterval: active ? ONE_MINUTE : false,
  });

  return useMemo(() => mergeMatchData(matches, data), [matches, data]);
}
```

- [ ] **Step 2: Verifikáció**

Run: `npm run check`
Expected: Biome zöld, nincs típushiba (a hook importjai és szignatúrája rendben).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/live/use-matches.ts
git commit -m "feat(adatreteg): useMatches hook (matches query, TanStack)"
```

---

### Task 5: MatchCard / TournamentTabs átkötése `useMatches`-re

**Files:**
- Modify: `src/components/tournament-tabs.tsx:173` (hook csere), import-sor (`useMatchPolling` → `useMatches`)

**Interfaces:**
- Consumes: `useMatches` (Task 4).

- [ ] **Step 1: Import csere**

`src/components/tournament-tabs.tsx` — keresd meg a `useMatchPolling` importját (jellemzően `import { useMatchPolling } from "@/hooks/use-match-polling";`) és cseréld:
```tsx
import { useMatches } from "@/hooks/live/use-matches";
```

- [ ] **Step 2: Hívás csere**

`src/components/tournament-tabs.tsx:173` — cseréld:
```tsx
  // Live réteg: a friss score/status/tipp-payout beolvasztása a matches propba.
  const liveMatches = useMatches(tournamentId, matches);
```

- [ ] **Step 3: Verifikáció**

Run: `npm run check && npm run build`
Expected: Biome zöld, build sikeres. A `liveMatches` változó használata (group-card render) változatlan, mert a visszatérési típus azonos (`MatchCardData[]`).

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-tabs.tsx
git commit -m "refactor(adatreteg): TournamentTabs a useMatches hookra áll"
```

---

### Task 6: `applyLiveScores` pure logika + TipMatrix átkötése

A TipMatrix a forduló-szerkezetet a `tipMatrix` query-ből kapja (lásd Task 7 prefetch), a változó score/status/payout-ot pedig a közös `matches` query-ből, egy pure merge-dzsel. A `useState`-cache (`cache`/`setCache`, az `initialRound`-beolvasztó `useEffect`, a `refreshCurrentRound`) megszűnik.

**Files:**
- Create: `src/lib/live/apply-live-scores.ts`
- Test: `src/lib/live/apply-live-scores.test.ts`
- Create: `src/hooks/live/use-tip-matrix-round.ts`
- Modify: `src/components/tip-matrix.tsx` (cache-logika eltávolítása, hookok bekötése, új `tournamentId` prop)
- Modify: `src/components/group-detail-tabs.tsx` (a `TipMatrix`-nak átadott `tournamentId`), `src/components/tournament-board-panel.tsx` (ugyanaz)

**Interfaces:**
- Consumes: `TipMatrixRound`, `TipMatrixMatch`, `TipMatrixBet` (`@/queries/tip-matrix`), `LiveMatchData` (`@/actions/live`), `liveKeys` (Task 2), `getTipMatrixRoundAction` (`@/actions/tip-matrix`).
- Produces: `applyLiveScores(round, liveData): TipMatrixRound`; `useTipMatrixRound(groupId, initialRound, roundKey): { round, isFetching }`.

- [ ] **Step 1: Failing test az `applyLiveScores`-ra**

Create `src/lib/live/apply-live-scores.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { LiveMatchData } from "@/actions/live";
import type { TipMatrixRound } from "@/queries/tip-matrix";
import { applyLiveScores } from "./apply-live-scores";

const round: TipMatrixRound = {
  roundKey: "r1",
  roundKind: "group",
  roundGroupNumber: 1,
  roundKnockoutTeams: null,
  roundIsFinal: false,
  orderedRoundKeys: ["r1"],
  matches: [
    {
      id: "m1",
      homeTeam: { name: "A", logoUrl: null },
      awayTeam: { name: "B", logoUrl: null },
      homeScore: null,
      awayScore: null,
      status: "scheduled",
      scheduledAt: "2026-06-29T18:00:00.000Z",
      locked: false,
      odds: null,
    },
  ],
  bets: [
    {
      matchId: "m1",
      userId: "u1",
      predictedHome: 2,
      predictedAway: 1,
      stake: 10,
      oddsAtBet: "2.0",
      payout: null,
      result1x2Correct: null,
      goalDiffCorrect: null,
      exactScoreCorrect: null,
    },
  ],
};

describe("applyLiveScores", () => {
  it("liveData hiányában változatlan round-ot ad (másolatban)", () => {
    expect(applyLiveScores(round, undefined)).toEqual(round);
  });

  it("a meccs score-ját és status-át frissíti a snapshotból", () => {
    const live: LiveMatchData[] = [
      { matchId: "m1", homeScore: 3, awayScore: 2, status: "finished", userBets: [] },
    ];
    const out = applyLiveScores(round, live);
    expect(out.matches[0].homeScore).toBe(3);
    expect(out.matches[0].awayScore).toBe(2);
    expect(out.matches[0].status).toBe("finished");
  });

  it("a tippek payout/helyesség mezőit a (userId, matchId) egyezés alapján frissíti", () => {
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            betId: "ignored",
            matchId: "m1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 99,
          },
        ],
      },
    ];
    const out = applyLiveScores(round, live);
    expect(out.bets[0].payout).toBe(99);
    expect(out.bets[0].exactScoreCorrect).toBe(true);
  });
});
```

Megjegyzés: a `matches` snapshot a néző tippjeit `betId` szerint adja, de a TipMatrix tippjei `(userId, matchId)` kulcsúak és más játékosokét is tartalmazzák. Ezért az `applyLiveScores` a **meccs-szintű** score/status-t mindig alkalmazza, a **payout-ot** pedig csak azokra a tippekre, amelyek a snapshot `userBets`-ében szerepelnek (a néző sajátjai); a többi játékos payout-ja a `tipMatrix` query friss lekérésekor frissül (Task 8 invalidáció). Lásd az implementációt.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- apply-live-scores`
Expected: FAIL — `Cannot find module './apply-live-scores'`.

- [ ] **Step 3: Implementáció**

Create `src/lib/live/apply-live-scores.ts`:
```ts
import type { LiveMatchData } from "@/actions/live";
import type { TipMatrixRound } from "@/queries/tip-matrix";

// A közös `matches` snapshot beolvasztása a tip-mátrix fordulóba: a meccs
// score/status MINDIG a snapshotból (egyetlen igazságforrás), a tipp-payout a
// néző saját tippjeire a snapshot userBets-éből. A többi játékos payout-ja a
// tipMatrix query friss lekérésekor frissül. A round szerkezete (ki mit
// tippelt) változatlan.
export function applyLiveScores(
  round: TipMatrixRound,
  liveData: LiveMatchData[] | undefined,
): TipMatrixRound {
  if (!liveData) return round;

  const liveMatch = new Map(liveData.map((m) => [m.matchId, m]));
  // payout-kulcs: (matchId, betId) — de a tip-mátrix tippnek nincs betId-je,
  // ezért a néző saját tippjeit a snapshot matchId-jén belül egyetlen
  // userBets-elemmel párosítjuk, ha az adott meccsre a néző tippelt.
  const livePayoutByMatch = new Map(
    liveData.map((m) => [m.matchId, m.userBets]),
  );

  return {
    ...round,
    matches: round.matches.map((m) => {
      const live = liveMatch.get(m.id);
      if (!live) return m;
      return { ...m, homeScore: live.homeScore, awayScore: live.awayScore, status: live.status };
    }),
    bets: round.bets.map((bet) => {
      const liveBets = livePayoutByMatch.get(bet.matchId);
      if (!liveBets || liveBets.length === 0) return bet;
      // A snapshot userBets-e a néző sajátja; a tip-mátrixban a néző sorát a
      // matchId azonosítja (egy meccsre egy tipp / játékos). Csak akkor írunk
      // payout-ot, ha van snapshot-tipp erre a meccsre.
      const liveBet = liveBets[0];
      return {
        ...bet,
        result1x2Correct: liveBet.result1x2Correct,
        goalDiffCorrect: liveBet.goalDiffCorrect,
        exactScoreCorrect: liveBet.exactScoreCorrect,
        payout: liveBet.payout,
      };
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- apply-live-scores`
Expected: PASS (3 teszt).

- [ ] **Step 5: `useTipMatrixRound` hook**

Create `src/hooks/live/use-tip-matrix-round.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { liveKeys } from "@/lib/live/query-keys";
import type { TipMatrixRound } from "@/queries/tip-matrix";

// A megjelenített forduló SZERKEZETE (ki mit tippelt). A változó score/payout
// nem itt, hanem a közös `matches` query-ben él (applyLiveScores olvasztja be).
// A nem-aktuális (befejezett) fordulók statikusak: staleTime Infinity, nincs
// felesleges refetch — csak invalidációra/forduló-váltásra fetch-el.
export function useTipMatrixRound(
  groupId: string,
  initialRound: TipMatrixRound,
  roundKey: string,
): TipMatrixRound {
  const { data } = useQuery({
    queryKey: liveKeys.tipMatrix(groupId, roundKey),
    queryFn: async () => {
      const r = await getTipMatrixRoundAction(groupId, roundKey);
      return r ?? initialRound;
    },
    initialData: initialRound.roundKey === roundKey ? initialRound : undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ?? initialRound;
}
```

- [ ] **Step 6: TipMatrix átkötése**

`src/components/tip-matrix.tsx`:

(a) Adj `tournamentId: string` mezőt a `TipMatrixProps` interfészhez (`:40-57` blokk), és a destrukturált propok közé (`:126-137`).

(b) Töröld a `useState`-cache blokkot (`:153-186`): a `cache`/`setCache`, a `roundKey`/`setRoundKey` marad (forduló-lapozás állapota), de a `const round = roundKey ? cache[roundKey] : null;`, az `initialRound`-beolvasztó `useEffect` (`:167-174`) és a `refreshCurrentRound` (`:179-186`) törlendő.

(c) Helyette a forduló-lapozás csak a `roundKey`-t állítja, és a megjelenített round így áll elő. Importok a `tip-matrix.tsx` import-blokkjába:
```tsx
import { useMatchesRaw } from "@/hooks/live/use-matches";
import { useTipMatrixRound } from "@/hooks/live/use-tip-matrix-round";
import { applyLiveScores } from "@/lib/live/apply-live-scores";
```
A komponens-törzsben (a `roundKey` state után), ahol eddig `const round = roundKey ? cache[roundKey] : null;` volt:
```tsx
  // A forduló szerkezete a tipMatrix query-ből; a score/payout a közös matches
  // query-ből, applyLiveScores-szal beolvasztva → konzisztens a MatchCard-dal.
  const baseRound = useTipMatrixRound(groupId, initialRound ?? EMPTY_ROUND, roundKey ?? initialRound?.roundKey ?? "");
  const liveMatchData = useMatchesRaw(tournamentId); // lásd lent
  const round = initialRound ? applyLiveScores(baseRound, liveMatchData) : null;
```

(d) Mivel a TipMatrix-nak a nyers `LiveMatchData[]` kell (nem MatchCardData-ba olvasztva), adj egy vékony hookot a `matches` query nyers olvasásához. Bővítsd a `src/hooks/live/use-matches.ts`-t egy export-tal:
```ts
import { useQuery } from "@tanstack/react-query";
import { getLiveMatchData, type LiveMatchData } from "@/actions/live";
import { liveKeys } from "@/lib/live/query-keys";

// A matches query NYERS olvasása (merge nélkül) — a TipMatrix score/payout
// beolvasztásához. Ugyanaz a queryKey, mint a useMatches → közös cache.
export function useMatchesRaw(tournamentId: string): LiveMatchData[] | undefined {
  const { data } = useQuery({
    queryKey: liveKeys.matches(tournamentId),
    queryFn: () => getLiveMatchData(tournamentId),
    enabled: !!tournamentId,
  });
  return data;
}
```
Definiálj egy `EMPTY_ROUND` konstanst a tip-matrix.tsx tetején (a komponens fölött), hogy a hook-szabály (feltétel nélküli hívás) ne sérüljön:
```tsx
const EMPTY_ROUND: TipMatrixRound = {
  roundKey: "",
  roundKind: "group",
  roundGroupNumber: null,
  roundKnockoutTeams: null,
  roundIsFinal: false,
  orderedRoundKeys: [],
  matches: [],
  bets: [],
};
```

(e) A forduló-lapozás gombja (eddig a `getTipMatrixRoundAction`-t hívta és cache-be tette, `:263-270` körül) mostantól csak a `roundKey`-t állítja:
```tsx
  const goToRound = (key: string) => setRoundKey(key);
```
A betöltést a `useTipMatrixRound` végzi a `roundKey` változására.

(f) A `onBetMutated={refreshCurrentRound}` átadás (`:588` körül) törlendő — a tippadás utáni frissítést a Task 8 invalidáció végzi. A `BetForm`/`BetDialog` `onBetMutated` propja opcionális marad, de a TipMatrix nem ad át callbacket.

- [ ] **Step 7: `tournamentId` átadása a szülőkből**

`src/components/group-detail-tabs.tsx` — a `TipMatrix` rendereléséhez add át a `tournamentId`-t. A `GroupDetailTabs` jelenleg `groupId`-t kap; bővítsd a propjait `tournamentId: string`-gel, a `page.tsx` (`:119-170`) pedig adja át `tournamentId={group.tournamentId}`. A `TipMatrix`-nak: `tournamentId={tournamentId}`.

`src/components/tournament-board-panel.tsx` — ugyanígy: a `TipMatrix`-nak `tournamentId={tournamentId}` (a panel már ismeri a torna kontextust; ha nem, propként kapja meg a `tournament-tabs.tsx`-ből).

- [ ] **Step 8: Verifikáció**

Run: `npm run test && npm run check && npm run build`
Expected: minden teszt PASS, Biome zöld, build sikeres. A TipMatrix már nem tárol round-cache-t; a score a közös `matches` query-ből jön.

- [ ] **Step 9: Commit**

```bash
git add src/lib/live/apply-live-scores.ts src/lib/live/apply-live-scores.test.ts src/hooks/live/use-tip-matrix-round.ts src/hooks/live/use-matches.ts src/components/tip-matrix.tsx src/components/group-detail-tabs.tsx src/components/tournament-board-panel.tsx "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx"
git commit -m "feat(adatreteg): TipMatrix közös matches igazságforrásra, useState-cache megszűnt"
```

---

### Task 7: HydrationBoundary a meccs-oldalakon

A `matches` és `tipMatrix` query-k szerver-oldali prefetch-e, dehydrate-elve a kliensnek — nincs dupla fetch, nincs villanás.

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` (prefetch + HydrationBoundary)
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx` (prefetch + HydrationBoundary a `matches`-re)

**Interfaces:**
- Consumes: `getQueryClient` (Task 1), `liveKeys` (Task 2), `getLiveMatchData` (`@/actions/live`).

- [ ] **Step 1: Group oldal — prefetch + boundary**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — a `return` előtt:
```tsx
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: liveKeys.matches(group.tournamentId),
      queryFn: () => getLiveMatchData(group.tournamentId),
    }),
    initialMatrixRound
      ? queryClient.prefetchQuery({
          queryKey: liveKeys.tipMatrix(group.id, initialMatrixRound.roundKey),
          queryFn: async () => initialMatrixRound,
        })
      : Promise.resolve(),
  ]);
```
Importok a fájl tetejére:
```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { liveKeys } from "@/lib/live/query-keys";
import { getLiveMatchData } from "@/actions/live";
```
A `return (...)` JSX-et csomagold:
```tsx
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        {/* ...meglévő tartalom... */}
      </div>
    </HydrationBoundary>
  );
```

- [ ] **Step 2: Tournament oldal — prefetch a matches-re**

`src/app/[locale]/tournaments/[slug]/page.tsx` — ugyanezzel a mintával prefetch-eld a `liveKeys.matches(tournament.id)` kulcsot a `getLiveMatchData`-val, és csomagold a `return`-t `HydrationBoundary`-be. (A `tournamentId` itt a tornából jön; használd a meglévő azonosítót.)

- [ ] **Step 3: Verifikáció**

Run: `npm run check && npm run build`
Expected: Biome zöld, build sikeres. A kliensen a `useMatches`/`useTipMatrixRound` a prefetch-elt cache-ből hidratál (staleTime 30s → nincs azonnali refetch).

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/tournaments/[slug]/page.tsx" "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx"
git commit -m "feat(adatreteg): HydrationBoundary a matches/tipMatrix prefetchhez"
```

---

### Task 8: Tippadás utáni invalidáció (cross-surface alap)

A tippadás/visszavonás után a `matches` query invalidálódik → a MatchCard és a TipMatrix is friss snapshotot kap, egyetlen helyről. Ez kiváltja a `bet-form` `router.refresh()` + `onBetMutated` szórását a meccs-réteg szintjén. (A leaderboard/balance invalidáció a Fázis 2/4 tervben jön.)

**Files:**
- Create: `src/lib/live/invalidate.ts`
- Test: `src/lib/live/invalidate.test.ts`
- Modify: `src/components/bet-form.tsx` (placeBet/cancelBet siker-ág)

**Interfaces:**
- Consumes: `liveKeys` (Task 2), `QueryClient` (`@tanstack/react-query`).
- Produces: `invalidateAfterBet(qc: QueryClient, ctx: { tournamentId: string; groupId: string }): Promise<void>`.

- [ ] **Step 1: Failing test**

Create `src/lib/live/invalidate.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterBet } from "./invalidate";
import { liveKeys } from "./query-keys";

describe("invalidateAfterBet", () => {
  it("a matches és a group prefix kulcsokat invalidálja", async () => {
    const calls: unknown[] = [];
    const qc = { invalidateQueries: vi.fn(async (arg) => { calls.push(arg); }) };
    await invalidateAfterBet(qc as never, { tournamentId: "t1", groupId: "g1" });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: liveKeys.matches("t1") });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: liveKeys.group("g1") });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- invalidate`
Expected: FAIL — `Cannot find module './invalidate'`.

- [ ] **Step 3: Implementáció**

Create `src/lib/live/invalidate.ts`:
```ts
import type { QueryClient } from "@tanstack/react-query";
import { liveKeys } from "./query-keys";

// Tippadás/visszavonás utáni egységes invalidáció. Egyetlen hívás frissít
// minden felületet, ahol a tipp/egyenleg/leaderboard megjelenik:
// - matches(tid): a néző tippjei+payout minden meccs-nézeten (MatchCard, TipMatrix)
// - group(gid) prefix: tipMatrix + leaderboard + balance (Fázis 2/4-ben élesedik)
export async function invalidateAfterBet(
  qc: QueryClient,
  ctx: { tournamentId: string; groupId: string },
): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: liveKeys.matches(ctx.tournamentId) }),
    qc.invalidateQueries({ queryKey: liveKeys.group(ctx.groupId) }),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- invalidate`
Expected: PASS (1 teszt).

- [ ] **Step 5: Bekötés a bet-form-ba**

`src/components/bet-form.tsx`:
- Importáld: `import { useQueryClient } from "@tanstack/react-query";`, `import { invalidateAfterBet } from "@/lib/live/invalidate";`
- A komponens-törzsben: `const queryClient = useQueryClient();`
- A `BetFormProps`-hoz add `tournamentId: string`-et (a hívók — bet-dialog / tournament-tabs — átadják a meccs tornáját).
- A `placeBet` és `cancelBet` siker-ágában (`:201`, `:219` körül) a `router.refresh()` mellé / helyett:
```tsx
        await invalidateAfterBet(queryClient, { tournamentId, groupId });
```
(ahol `groupId` az adott bet-sor csoportja). A `router.refresh()` egyelőre **maradhat** a nem-migrált felületek miatt; a teljes kivezetése a Fázis 4 terv feladata.

- [ ] **Step 6: Verifikáció**

Run: `npm run test && npm run check && npm run build`
Expected: minden teszt PASS, Biome zöld, build sikeres.

- [ ] **Step 7: Commit**

```bash
git add src/lib/live/invalidate.ts src/lib/live/invalidate.test.ts src/components/bet-form.tsx
git commit -m "feat(adatreteg): tippadás utáni matches/group invalidáció (cross-surface alap)"
```

---

## Manuális end-to-end verifikáció (a terv végén)

A bejelentett bug regressziójának kézi ellenőrzése (a projektben nincs még Playwright E2E):

1. `npm run dev`, nyiss meg egy csoport-oldalt élő/közelgő meccsel.
2. Egy másik fülön (vagy DB-ből) állíts be egy meccset `finished` státuszra eredménnyel.
3. Várj ~1 percet (meccs-ablak polling) vagy válts fülre (refetchOnWindowFocus).
4. **Elvárás:** az alsó MatchCard ÉS a felső TipMatrix is ugyanazt a végeredményt + payout-ot mutatja — nem tartanak szét.
5. Adj le egy tippet a tipp-tábláról: **elvárás:** a TipMatrix cellája azonnal frissül (invalidateAfterBet → matches refetch), a MatchCard is.

---

## Self-Review jegyzet

- **Spec-lefedettség (Fázis 0+1):** query-kulcs registry (Task 2), egy matches igazságforrás + a két nézet bekötése (Task 3–6), HydrationBoundary (Task 7), tippadás-invalidáció (Task 8), TanStack provider (Task 1). A leaderboard/balance/notification/szerver-cache a Fázis 2–5 külön terveire marad (a spec 12. szakasza szerint).
- **Nyitott pont (a spec 14.-ből):** a más játékosok payout-ja a TipMatrix-on a `tipMatrix` query friss lekérésekor frissül (a `matches` snapshot csak a néző sajátját adja). Ez a Task 8 `group(gid)` invalidációval és a meccs-vége polling melletti `tipMatrix` refetch-csel kezelt; ha élesben kevésnek bizonyul, a Fázis 4 tervben a `tipMatrix` query is bekerül a meccs-ablak pollingba.
- **Típus-konzisztencia:** `mergeMatchData` és `applyLiveScores` ugyanazt a `LiveMatchData` shape-et fogyasztja; `useMatches`/`useMatchesRaw` ugyanazt a `liveKeys.matches(tid)` kulcsot használja (közös cache).
