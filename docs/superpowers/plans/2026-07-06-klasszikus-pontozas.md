# Klasszikus (token nélküli) pontozás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tipp-táblán egy „A1 sarok" kapcsolóval a játékos válthat a jelenlegi token-pontozás és egy klasszikus (tét/token nélküli) 0–3 pontos számítás közt, ahol a cellák, a Σ oszlop és a sorrend is átvált.

**Architecture:** Pure logikára épül: egy új `classicPointsFromFlags` a már tárolt `bets` találat-flagekből számol 0–3 pontot, a `buildMatrixRows` kap egy `mode` paramétert. A total-nézet klasszikus összpontja egy új `getGroupClassicPoints` szerver-aggregációból jön (a token-`profit` mellett a leaderboard-sorokon utazik), a forduló-nézet és a cellák a mátrixba már beolvasott flagekből számolnak kliens-oldalon. Séma-változás nincs.

**Tech Stack:** Next.js 16 App Router (Server Components + `"use client"` szigetek), Drizzle ORM (Neon Postgres), next-intl, Vitest, Tailwind v4, Biome.

## Global Constraints

- Séma-változás **TILOS** — minden a meglévő `bets` flagekből (`result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect`) és a meccs-státuszból számol.
- Minden UI szöveg `useTranslations()` — nincs hardcoded string; magyar szövegek ékezetekkel.
- Pontlogika **pure + tesztelt** (`src/lib/scoring.ts`, `src/lib/tip-matrix.ts` mintájára, Vitest).
- Design system: csak meglévő tokenek/utilityk (`text-gold`, `text-faint`, `text-win`, `text-loss`, `bg-surface-2/3`) — nincs raw hex; a mód-kapcsoló a meglévő Σ-fejléc toggle **mintáját** tükrözi.
- A `scope` (total/round) marad komponens-állapot; a **mód** (token/classic) **localStorage**-ban perzisztál, közös kulccsal (`tipmatrix:mode`).
- Pontszabály: `pont = kimenet-találat(1) + gólkülönbség-találat(1) + pontos-eredmény-találat(1)` → 0/1/2/3. **Csak meccsek**, dobogó nincs benne.
- Commit: conventional commits (feat/test/chore). Frequent commits, TDD.
- A `npm run db:migrate` NEM része ennek a munkának (nincs migráció).

## File Structure

- `src/lib/scoring.ts` — **módosít**: új pure `classicPointsFromFlags`. (Pontlogika otthona.)
- `tests/lib/scoring.test.ts` — **módosít**: `classicPointsFromFlags` tesztek.
- `src/lib/tip-matrix.ts` — **módosít**: `MatrixMode` típus, `buildMatrixRows` `mode` param + klasszikus ágak, `MatrixRowInput.classicPoints?`, bet-input flag-mezők.
- `tests/lib/tip-matrix.test.ts` — **módosít**: klasszikus total/round tesztek.
- `src/queries/classic-points.ts` — **létrehoz**: `getGroupClassicPoints(groupId): Promise<Map<string, number>>`.
- `src/hooks/use-persisted-matrix-mode.ts` — **létrehoz**: localStorage-perzisztált mód-hook.
- `src/hooks/use-leaderboard-polling.ts` — **módosít**: a `classicPoints` mezőt átvinni az élő-frissítéskor.
- `src/components/tip-matrix.tsx` — **módosít**: A1 mód-kapcsoló, `renderCell` klasszikus ág, `mode` átadása a `buildMatrixRows`-nak, `TipMatrixLeaderboardRow.classicPoints`.
- `src/components/group-detail-tabs.tsx`, `src/components/circle-detail-tabs.tsx` — **módosít**: `classicPoints` a `LeaderboardRow` típusban + továbbadás.
- `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`, `.../circles/[circleSlug]/page.tsx` — **módosít**: `getGroupClassicPoints` lekérés + `classicPoints` a leaderboard-sorokra.
- `messages/hu.json`, `messages/en.json` — **módosít**: `tipMatrix.modeToken`, `modeClassic`, `modeHint`.

---

### Task 1: `classicPointsFromFlags` pure függvény

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `tests/lib/scoring.test.ts`

**Interfaces:**
- Produces: `classicPointsFromFlags(flags: { result1x2Correct: boolean | null; goalDiffCorrect: boolean | null; exactScoreCorrect: boolean | null }): number | null` — `null`, ha még nem pontozott (bármely flag `null`/`undefined`); egyébként `0..3`.

- [ ] **Step 1: Írd meg a bukó tesztet**

Told hozzá a `tests/lib/scoring.test.ts` végéhez (az importot bővítsd: `classicPointsFromFlags`):

```ts
import { calculateBetPayout, calculatePodiumPoints, classicPointsFromFlags, get1X2 } from "@/lib/scoring";

describe("classicPointsFromFlags", () => {
  it("exact score => 3", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: true,
        exactScoreCorrect: true,
      }),
    ).toBe(3);
  });
  it("goal difference (not exact) => 2", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: true,
        exactScoreCorrect: false,
      }),
    ).toBe(2);
  });
  it("outcome only => 1", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: false,
        exactScoreCorrect: false,
      }),
    ).toBe(1);
  });
  it("wrong outcome => 0", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: false,
        goalDiffCorrect: false,
        exactScoreCorrect: false,
      }),
    ).toBe(0);
  });
  it("unscored (null flags) => null", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: null,
        goalDiffCorrect: null,
        exactScoreCorrect: null,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npm run test -- scoring`
Expected: FAIL — `classicPointsFromFlags is not exported` / `is not a function`.

- [ ] **Step 3: Implementáld a minimál kódot**

Told hozzá a `src/lib/scoring.ts`-hez (a `get1X2` után, a fájl bármely pontján):

```ts
/**
 * Klasszikus (token nélküli) pont egy lepontozott tippre: kimenet-találat (+1),
 * gólkülönbség-találat (+1), pontos eredmény (+1) → 0..3. A flageket a scoring
 * cron írja a `bets`-be; ha még nincs pontozva (`null`), `null`-t adunk.
 */
export function classicPointsFromFlags(flags: {
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}): number | null {
  if (flags.result1x2Correct == null) return null;
  return (
    (flags.result1x2Correct ? 1 : 0) +
    (flags.goalDiffCorrect ? 1 : 0) +
    (flags.exactScoreCorrect ? 1 : 0)
  );
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npm run test -- scoring`
Expected: PASS (minden `classicPointsFromFlags` teszt zöld, a meglévők is).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "feat(scoring): classicPointsFromFlags pure fn (0-3 pont a tárolt flagekből)"
```

---

### Task 2: `buildMatrixRows` `mode` paraméter + klasszikus ágak

**Files:**
- Modify: `src/lib/tip-matrix.ts:199-265`
- Test: `tests/lib/tip-matrix.test.ts`

**Interfaces:**
- Consumes: `classicPointsFromFlags` (Task 1).
- Produces:
  - `export type MatrixMode = "token" | "classic"`
  - `MatrixRowInput` bővül: `classicPoints?: number`
  - `buildMatrixRows(rows, bets, scope, mode?: MatrixMode)` — a `bets` elemei mostantól opcionálisan hordozhatják a `result1x2Correct` / `goalDiffCorrect` / `exactScoreCorrect` flageket; `mode` default `"token"`.

- [ ] **Step 1: Írd meg a bukó teszteket**

Told hozzá a `tests/lib/tip-matrix.test.ts` `describe("buildMatrixRows", …)` blokkjához (a meglévő `lb` fixture-t bővítsd `classicPoints`-szal, és add hozzá az új `it`-eket):

```ts
  const lb: MatrixRowInput[] = [
    { rank: 1, userId: "u1", userName: "Anna", userAvatarUrl: null, profit: 42, classicPoints: 5 },
    { rank: 2, userId: "u2", userName: "Béla", userAvatarUrl: null, profit: 30, classicPoints: 9 },
    { rank: 3, userId: "u3", userName: "Cili", userAvatarUrl: null, profit: 10, classicPoints: 7 },
  ];

  it("classic total: value=classicPoints, reordered desc, ranks 1..n", () => {
    const out = buildMatrixRows(lb, [], "total", "classic");
    expect(out.map((r) => r.userId)).toEqual(["u2", "u3", "u1"]);
    expect(out.map((r) => r.value)).toEqual([9, 7, 5]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("classic round: sums 0-3 points per user, skips unscored, reorders desc", () => {
    const bets = [
      // u1: exact (3) + outcome (1) => 4
      { userId: "u1", payout: 0, stake: 0, result1x2Correct: true, goalDiffCorrect: true, exactScoreCorrect: true },
      { userId: "u1", payout: 0, stake: 0, result1x2Correct: true, goalDiffCorrect: false, exactScoreCorrect: false },
      // u2: goal diff (2) => 2
      { userId: "u2", payout: 0, stake: 0, result1x2Correct: true, goalDiffCorrect: true, exactScoreCorrect: false },
      // u3: unscored => skip => 0
      { userId: "u3", payout: null, stake: 0, result1x2Correct: null, goalDiffCorrect: null, exactScoreCorrect: null },
    ];
    const out = buildMatrixRows(lb, bets, "round", "classic");
    expect(out.map((r) => r.userId)).toEqual(["u1", "u2", "u3"]);
    expect(out.map((r) => r.value)).toEqual([4, 2, 0]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("defaults to token mode when mode omitted (total unchanged)", () => {
    const out = buildMatrixRows(lb, [], "total");
    expect(out.map((r) => r.value)).toEqual([42, 30, 10]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npm run test -- tip-matrix`
Expected: FAIL — a `"classic"` ág `value`-i `0`-k (a klasszikus logika még nincs meg), a sorrend nem stimmel.

- [ ] **Step 3: Implementáld — cseréld le a `buildMatrixRows`-t és a típusokat**

A `src/lib/tip-matrix.ts` tetejére (az importokhoz):

```ts
import { classicPointsFromFlags } from "@/lib/scoring";
```

Cseréld le a `MatrixScope` típust követő blokkot (a `MatrixRowInput` interfészt és a teljes `buildMatrixRows` függvényt, `199-265` környéke) erre:

```ts
export type MatrixScope = "total" | "round";
export type MatrixMode = "token" | "classic";

/** A ranglista egy sora a mátrix-megjelenítéshez (globális adatok). */
export interface MatrixRowInput {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
  /** Teljes klasszikus (token nélküli) összpont — a `classic`+`total` nézethez. */
  classicPoints?: number;
}

/** A mátrix egy megjelenítendő sora — `value`/`rank` a választott nézet szerint. */
export interface MatrixRowDisplay {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  value: number;
}

interface MatrixBetInput {
  userId: string;
  payout: number | null;
  stake: number;
  result1x2Correct?: boolean | null;
  goalDiffCorrect?: boolean | null;
  exactScoreCorrect?: boolean | null;
}

/**
 * A Tipp-tábla sorait állítja össze a választott nézet (scope × mode) szerint.
 *
 * - `token` + `total`: a bemeneti (globális) sorrend és helyezés változatlan,
 *   az érték a teljes token-`profit`.
 * - `classic` + `total`: az érték a user teljes klasszikus összpontja
 *   (`classicPoints`), csökkenő pont szerint újrarendezve.
 * - `*` + `round`: az érték az adott forduló userenkénti összege — `token`-nél a
 *   nettó (`betNet`), `classic`-nél a 0–3 pont (`classicPointsFromFlags`) —, a
 *   lepontozatlan tipp (`null`) kimarad. Csökkenő érték szerint újrarendezve.
 *
 * A lepontozatlan tipp kihagyása egyben az adatvédelmi garancia is: pontozott
 * tipp csak lockolt (befejezett) meccsen van, amit minden néző lát; más
 * felhasználó jövőbeli tippje (null) sosem kerül a forduló-értékbe.
 * Holtversenynél a stabil rendezés a bemeneti sorrendet tartja; a helyezés az
 * új sorrend `index + 1`-e.
 */
export function buildMatrixRows(
  rows: readonly MatrixRowInput[],
  bets: readonly MatrixBetInput[],
  scope: MatrixScope,
  mode: MatrixMode = "token",
): MatrixRowDisplay[] {
  if (scope === "total" && mode === "token") {
    return rows.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: r.profit,
    }));
  }

  const valueByUser = new Map<string, number>();
  if (scope === "total") {
    for (const r of rows) valueByUser.set(r.userId, r.classicPoints ?? 0);
  } else {
    for (const b of bets) {
      const v = mode === "token" ? betNet(b.payout, b.stake) : classicPointsFromFlags(b);
      if (v == null) continue;
      valueByUser.set(b.userId, (valueByUser.get(b.userId) ?? 0) + v);
    }
  }

  return rows
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: valueByUser.get(r.userId) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((r, index) => ({ ...r, rank: index + 1 }));
}
```

> Megjegyzés: a `betNet` függvény a fájlban feljebb már definiált; ne töröld. A `MatrixBetInput.payout/stake` a `classic`-ágban nincs használva, de a `betNet`-ág miatt kell.

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npm run test -- tip-matrix`
Expected: PASS (új klasszikus tesztek + minden meglévő `buildMatrixRows` teszt zöld — a token-ág változatlan).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tip-matrix.ts tests/lib/tip-matrix.test.ts
git commit -m "feat(tip-matrix): buildMatrixRows mode param + klasszikus total/round ágak"
```

---

### Task 3: `getGroupClassicPoints` query + `classicPoints` átvezetése az adatrétegen

**Files:**
- Create: `src/queries/classic-points.ts`
- Modify: `src/hooks/use-leaderboard-polling.ts`
- Modify: `src/components/tip-matrix.tsx` (csak a `TipMatrixLeaderboardRow` típus)
- Modify: `src/components/group-detail-tabs.tsx`, `src/components/circle-detail-tabs.tsx` (a `LeaderboardRow` típusok)
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`
- Modify: `src/app/[locale]/tournaments/[slug]/circles/[circleSlug]/page.tsx`

**Interfaces:**
- Consumes: semmi Task 1/2-ből futásidőben (a mód még mindig `token`, a `classicPoints` csak utazik).
- Produces: `getGroupClassicPoints(groupId: string): Promise<Map<string, number>>` — userId → teljes klasszikus összpont a csoport `finished` meccsű tippjeire. A `classicPoints: number` mező megjelenik a leaderboard-sorokon egészen a `TipMatrix` `leaderboard` propjáig.

- [ ] **Step 1: Írd meg a query-t**

Create `src/queries/classic-points.ts`:

```ts
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";

/**
 * A klasszikus (token nélküli) összpont userenként egy csoportban: a `finished`
 * meccsű, lepontozott tippek találat-flagjeinek összege
 * (kimenet + gólkülönbség + pontos eredmény → 0..3 per tipp). Séma-változás
 * nélkül, közvetlenül a `bets` flagekből.
 */
export async function getGroupClassicPoints(groupId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      userId: bets.userId,
      points: sql<number>`COALESCE(SUM(
        (CASE WHEN ${bets.result1x2Correct} THEN 1 ELSE 0 END)
        + (CASE WHEN ${bets.goalDiffCorrect} THEN 1 ELSE 0 END)
        + (CASE WHEN ${bets.exactScoreCorrect} THEN 1 ELSE 0 END)
      ), 0)::int`,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.groupId, groupId), eq(matches.status, "finished")))
    .groupBy(bets.userId);

  return new Map(rows.map((r) => [r.userId, r.points]));
}
```

- [ ] **Step 2: Told a `classicPoints` mezőt a leaderboard-típusokhoz**

`src/components/tip-matrix.tsx` — a `TipMatrixLeaderboardRow` interfészhez (a `profit: number;` alá):

```ts
  profit: number;
  classicPoints?: number;
```

`src/components/group-detail-tabs.tsx` — a `LeaderboardRow` interfészhez (a `profit: number;` alá):

```ts
  profit: number;
  classicPoints?: number;
```

`src/components/circle-detail-tabs.tsx` — a `LeaderboardRow` interfészhez (a `profit: number;` alá):

```ts
  profit: number;
  classicPoints?: number;
```

- [ ] **Step 3: A polling-hook vigye át a `classicPoints`-ot**

`src/hooks/use-leaderboard-polling.ts` — bővítsd a lokális `LeaderboardRow` interfészt és az élő-map lookupot:

A `LeaderboardRow` interfészhez (a `profit: number;` alá):

```ts
  profit: number;
  classicPoints?: number;
```

A `return useMemo(...)` blokkban a `liveData.map(...)` a `classicPoints`-ot az `initialData`-ból pótolja userId szerint (a live action csak token-profitot/rangot ad, a klasszikus összpont onnan nem jön):

```ts
  return useMemo(() => {
    if (!liveData) return [...initialData];
    const classicByUser = new Map(initialData.map((r) => [r.userId, r.classicPoints]));
    return liveData.map((row: LiveLeaderboardRow) => ({
      rank: row.rank,
      userId: row.userId,
      userName: row.userName,
      userAvatarUrl: row.userAvatarUrl,
      profit: row.profit,
      classicPoints: classicByUser.get(row.userId) ?? 0,
    }));
  }, [initialData, liveData]);
```

- [ ] **Step 4: Group page — lekérés + `classicPoints` a sorokra**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`:

Import (a többi query-import mellé):

```ts
import { getGroupClassicPoints } from "@/queries/classic-points";
```

Told a `getGroupClassicPoints(group.id)`-t a `Promise.all` tömbhöz és destrukturáld ki `classicByUser` néven. A meglévő destrukturálás (`const [leaderboardRaw, finishedMatches, groupBetsRaw, initialMatrixRound, badgesMap, statsMap] = await Promise.all([...])`) bővül egy elemmel — a Promise.all tömb és a bal oldali destrukturálás **azonos sorrendben** kap egy új utolsó elemet:

```ts
  const [
    leaderboardRaw,
    finishedMatches,
    groupBetsRaw,
    initialMatrixRound,
    badgesMap,
    statsMap,
    classicByUser,
  ] = await Promise.all([
    getGroupLeaderboard(group.id),
    // …a meglévő promise-ok változatlanul, ugyanabban a sorrendben…
    getGroupClassicPoints(group.id),
  ]);
```

> A meglévő promise-ok sorrendjét NE változtasd; csak told a `getGroupClassicPoints(group.id)`-t a tömb végére és a `classicByUser`-t a destrukturálás végére.

A `leaderboard={leaderboard.map((row) => ({ … profit: row.profit, }))}` objektumhoz add hozzá a `classicPoints` mezőt:

```tsx
          leaderboard={leaderboard.map((row) => ({
            rank: row.rank,
            userId: row.userId,
            userName: row.userName,
            userAvatarUrl: row.userAvatarUrl,
            profit: row.profit,
            classicPoints: classicByUser.get(row.userId) ?? 0,
          }))}
```

- [ ] **Step 5: Circle page — lekérés + `classicPoints` a sorokra**

`src/app/[locale]/tournaments/[slug]/circles/[circleSlug]/page.tsx`:

Import:

```ts
import { getGroupClassicPoints } from "@/queries/classic-points";
```

Told a `getGroupClassicPoints(official.id)`-t a meglévő `Promise.all`-hoz (a leaderboard/finished/… mellé), destrukturáld `classicByUser` néven a tömb végén (a promise-ok sorrendjét megtartva).

A circle `leaderboard`-ot (`filterAndRerankLeaderboard(...)` eredménye) a `CircleDetailTabs`-nak átadás előtt gazdagítsd `classicPoints`-szal. Cseréld a `leaderboard={leaderboard}` propot erre:

```tsx
          leaderboard={leaderboard.map((row) => ({
            ...row,
            classicPoints: classicByUser.get(row.userId) ?? 0,
          }))}
```

- [ ] **Step 6: Ellenőrizd a típusokat és a lintet**

Run: `npm run build`
Expected: sikeres típusellenőrzés/build (nincs TS hiba a `classicPoints` körül; a `getGroupClassicPoints` importok feloldódnak).

Run: `npm run check`
Expected: nincs Biome hiba az érintett fájlokban.

Run: `npm run test -- tip-matrix scoring`
Expected: PASS (a pure tesztek változatlanul zöldek).

- [ ] **Step 7: Commit**

```bash
git add src/queries/classic-points.ts src/hooks/use-leaderboard-polling.ts src/components/tip-matrix.tsx src/components/group-detail-tabs.tsx src/components/circle-detail-tabs.tsx "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx" "src/app/[locale]/tournaments/[slug]/circles/[circleSlug]/page.tsx"
git commit -m "feat(classic): getGroupClassicPoints query + classicPoints átvezetése a leaderboard-sorokon"
```

---

### Task 4: A1 mód-kapcsoló a Tipp-táblán + klasszikus cella-render

**Files:**
- Create: `src/hooks/use-persisted-matrix-mode.ts`
- Modify: `src/components/tip-matrix.tsx`
- Modify: `messages/hu.json`, `messages/en.json`

**Interfaces:**
- Consumes: `usePersistedMatrixMode` (ez a task hozza létre), `buildMatrixRows(..., mode)` (Task 2), `classicPointsFromFlags` (Task 1), `classicPoints` a `leaderboard` propon (Task 3), `MatrixMode` (Task 2).
- Produces: futó UI — a Tipp-tábla bal-felső cellája kapcsoló; a mód a cellák al-számát, a Σ-t és a sorrendet vezérli; a mód localStorage-ban perzisztál.

- [ ] **Step 1: Hozd létre a perzisztált mód-hookot**

Create `src/hooks/use-persisted-matrix-mode.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { MatrixMode } from "@/lib/tip-matrix";

const STORAGE_KEY = "tipmatrix:mode";

/**
 * A Tipp-tábla token/klasszikus módja localStorage-ban perzisztálva. SSR-en és
 * az első kliens-renderen `"token"` (hydration-mismatch elkerülése), majd mount
 * után beolvassa a tárolt értéket. A kulcs közös a csoport- és kör-mátrix közt.
 */
export function usePersistedMatrixMode(): readonly [MatrixMode, () => void] {
  const [mode, setMode] = useState<MatrixMode>("token");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "classic" || stored === "token") setMode(stored);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: MatrixMode = m === "token" ? "classic" : "token";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }, []);

  return [mode, toggle] as const;
}
```

- [ ] **Step 2: Kösd be a hookot és a `mode`-ot a `TipMatrix`-ba**

`src/components/tip-matrix.tsx`:

Importok (a meglévők mellé):

```ts
import { classicPointsFromFlags } from "@/lib/scoring";
import { usePersistedMatrixMode } from "@/hooks/use-persisted-matrix-mode";
```

A `betNet, buildMatrixRows, ...` import a `@/lib/tip-matrix`-ból bővüljön `MatrixMode`-dal, ha típusként kell — de közvetlenül nem hivatkozunk rá, így nem kötelező.

A komponens törzsében a `const [scope, setScope] = useState<MatrixScope>("total");` mellé:

```ts
  const [mode, toggleMode] = usePersistedMatrixMode();
```

A `displayRows` memo hívásába add át a `mode`-ot:

```ts
    () => buildMatrixRows(leaderboard, round?.bets ?? [], scope, mode),
    [leaderboard, round, scope, mode],
```

- [ ] **Step 3: `renderCell` — klasszikus al-szám a `mode` szerint**

`src/components/tip-matrix.tsx`, a `renderCell` függvény lezárt (`m.locked`) ágában cseréld le a `const net = betNet(bet.payout, bet.stake);` sortól a `return (...)` végéig tartó blokkot erre:

```tsx
    const net = betNet(bet.payout, bet.stake);
    const classic = classicPointsFromFlags(bet);

    const sub =
      mode === "classic" ? (
        classic == null ? (
          <span className="text-[10px] text-faint">…</span>
        ) : (
          <span className={cn("text-[10px]", classic > 0 ? "text-gold" : "text-faint")}>
            {classic}
          </span>
        )
      ) : net == null ? (
        <span className="text-[10px] text-faint">…</span>
      ) : (
        <span className={cn("text-[10px]", net >= 0 ? "text-win" : "text-loss")}>{signed(net)}</span>
      );

    return (
      <span className="flex flex-col items-center leading-tight">
        <span className={cn("text-[13px]", tone)}>{pred}</span>
        {sub}
      </span>
    );
```

> A `tone` (tippelt eredmény színe) változatlan marad — csak az al-szám vált.

- [ ] **Step 4: A1 sarok — a játékos-fejléc `<th>` legyen mód-kapcsoló**

`src/components/tip-matrix.tsx`, a `<thead>` első `<th>`-ját (a `{t("player")}`-t tartalmazó, `sticky left-0 z-[2]` cella) cseréld le erre (a Σ-fejléc toggle mintáját tükrözi: `p-0` th + teljes szélességű, paddingelt gomb + két egymás alatti felirat, aktív módban arany):

```tsx
              <th
                className={cn(
                  "sticky left-0 z-[2] border-border border-b bg-surface-2 p-0 text-left text-[11px] text-muted-foreground",
                  curated && "top-0",
                )}
              >
                <button
                  type="button"
                  onClick={toggleMode}
                  aria-pressed={mode === "classic"}
                  title={t("modeHint")}
                  className="flex w-full flex-col items-start px-2.5 py-1.5 hover:bg-surface-3"
                >
                  <span>{t("player")}</span>
                  <span
                    className={cn(
                      "mt-1 whitespace-nowrap text-[10px]",
                      mode === "classic" ? "text-gold" : "text-faint",
                    )}
                  >
                    {mode === "classic" ? t("modeClassic") : t("modeToken")}
                  </span>
                </button>
              </th>
```

- [ ] **Step 5: i18n kulcsok**

`messages/hu.json` — a `tipMatrix` objektumhoz:

```json
    "modeToken": "Token",
    "modeClassic": "Klasszikus",
    "modeHint": "Váltás a token- és a klasszikus (tét nélküli, 0–3 pontos) számítás közt"
```

`messages/en.json` — a `tipMatrix` objektumhoz:

```json
    "modeToken": "Token",
    "modeClassic": "Classic",
    "modeHint": "Switch between token and classic (stake-free, 0–3 point) scoring"
```

> Ügyelj a záró vessző helyességére a JSON-ban (a beszúrt kulcsok után legyen a következő kulcs, vagy vessző nélkül záruljon az objektum).

- [ ] **Step 6: Build + lint + tesztek**

Run: `npm run build`
Expected: sikeres build, nincs TS hiba.

Run: `npm run check`
Expected: nincs Biome hiba.

Run: `npm run test`
Expected: minden teszt PASS.

- [ ] **Step 7: Manuális ellenőrzés (dev szerver)**

```bash
npm run dev
```

Majd `beam 3000` (a laptopra), és egy csoport-oldalon a Tipp-tábla tabon:
- A bal-felső cella „Játékos / Token" — kattintásra „Játékos / Klasszikus" (arany).
- Klasszikus módban a lezárt meccsek cellái a tippelt eredmény alatt **0–3 pontot** mutatnak (nem az előjeles token-nettót).
- A Σ oszlop és a sorrend átvált a klasszikus összpontra; a Σ-fejléc `total ↔ forduló` továbbra is működik mindkét módban.
- Oldal-újratöltés után a mód megmarad (localStorage); egy kör-oldalon ugyanaz a mód aktív.

Expected: mind a négy pont teljesül.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-persisted-matrix-mode.ts src/components/tip-matrix.tsx messages/hu.json messages/en.json
git commit -m "feat(tip-matrix): A1 token/klasszikus mód-kapcsoló + klasszikus cella-render"
```

---

## Self-Review

**Spec coverage:**
- Pontlogika 0–3 a tárolt flagekből → Task 1 (`classicPointsFromFlags`). ✔
- Cella al-szám + Σ + sorrend vált mód szerint → Task 2 (`buildMatrixRows` mode) + Task 4 (`renderCell`, A1 toggle). ✔
- Két független kapcsoló (A1 mód ⟂ Σ scope) → Task 4 (a Σ toggle érintetlen; új A1 toggle). ✔
- Total-Σ klasszikus szerver-aggregációból, round/cella kliens-oldalról a flagekből → Task 3 (`getGroupClassicPoints`, propon utaztatva) + Task 2 (round-ág `classicPointsFromFlags`). ✔
- Mód localStorage-ban, közös kulcs; scope komponens-állapot → Task 4 (`usePersistedMatrixMode`, `tipmatrix:mode`). ✔
- Séma-változás nincs; csak meccsek, dobogó nélkül → a query `bets`-flagekből, `finished` meccsekre; podium nincs érintve. ✔
- Ismert korlát (lepontozatlan finished meccs átmenetileg 0/`…`) → a `classicPointsFromFlags` `null`-ág + round-ág skip + query `finished` szűrő ezt tükrözi. ✔

**Placeholder scan:** nincs TBD/„handle edge cases" — minden lépés konkrét kóddal. ✔

**Type consistency:** `MatrixMode` egy helyen (`src/lib/tip-matrix.ts`), a hook és a komponens onnan importálja; `classicPointsFromFlags` szignatúrája azonos Task 1/2/4-ben; `classicPoints?: number` ugyanaz a `TipMatrixLeaderboardRow`, `MatrixRowInput`, a két `LeaderboardRow` és a polling-hook típusán; `getGroupClassicPoints` `Promise<Map<string, number>>` mind a query-ben, mind a page-ekben (`.get(...)`) egyezik. ✔

## Execution Handoff

**Fontos (projekt-konvenció):** ez frontend/adatréteg munka, ami Vercel/Neon preview-val ellenőrizhető → **worktree + PR + squash merge** (nem közvetlen `main`). Az implementáció indításakor előbb a `superpowers:using-git-worktrees` skill hozzon létre izolált worktree-t.
