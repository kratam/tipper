# Tipp-tábla (kompakt mátrix-ranglista) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Új „Tipp-tábla" tab a csoport-oldalon — vízszintesen görgethető mátrix, ahol soronként egy játékos, oszloponként egy meccs (fordulónként), cellánként a tipp + nettó token; a saját sor kiemelve, „ugorj rám" sávval, a még le nem zárult meccsek tippjei szerver-oldalon adatvédelmileg szűrve.

**Architecture:** Nincs séma-változás. Egy pure logikai réteg (`lib/tip-matrix.ts`, tesztelt) végzi a forduló-csoportosítást, alapforduló-választást és az **adatvédelmi szűrést**; egy query (`queries/tip-matrix.ts`) a meglévő `getMatchesForTournament`-re épül és a szűrt forduló-adatot adja; egy szerver-akció (`actions/tip-matrix.ts`) auth + forduló-váltás; egy kliens komponens (`components/tip-matrix.tsx`) rendereli a táblát. A két popup a **meglévő** komponenseket használja (`MatchTipsTab`, `BetDialog`).

**Tech Stack:** Next.js 16 App Router (Server Actions), TypeScript strict, Drizzle ORM (Neon Postgres), next-intl, Tailwind v4 + shadcn, Vitest, Biome.

## Global Constraints

- **Nyelv:** minden UI szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string. Magyar szövegek ékezetekkel.
- **Design system:** csak a meglévő tokenek/utilityk (`bg-surface`, `text-muted-foreground`, `text-win`, `text-loss`, `text-gold`, `border-border`, stb.) — nincs raw hex. Egyetlen tab-rendszer (`ui/tabs.tsx`), egyetlen gomb (`ui/button.tsx`).
- **Server Actions:** `"use server"`, mindig `getCurrentUser()` ellenőrzés.
- **DB:** Drizzle query API, nem raw SQL. Nincs séma-változás → nincs migráció.
- **Adatvédelem (KRITIKUS):** mások jövőbeli (még nem lockolt) tippje soha nem kerülhet a kliensre. A szűrés kizárólag szerver-oldali (`filterRoundBetsForViewer`).
- **Lock definíció:** egy meccs lockolt, ha `status !== "scheduled"` VAGY `scheduledAt <= now` (egyezik a `placeBet` szabályával: `src/actions/bets.ts`).
- **Tesztek:** Vitest, TDD a pure logikára. Lint: `npm run check`. Típus: `npx tsc --noEmit`.
- **Commit:** conventional commits (feat/fix/chore/docs).

---

## File Structure

- Create: `src/lib/tip-matrix.ts` — pure logika (csoportosítás, alapforduló, lock, adatvédelmi szűrés, nettó).
- Create: `tests/lib/tip-matrix.test.ts` — unit tesztek.
- Create: `src/queries/tip-matrix.ts` — `getTipMatrixRound` + típusok.
- Create: `src/actions/tip-matrix.ts` — `getTipMatrixRoundAction` (auth) + `getTipMatrixBetInfoAction` (Phase 2).
- Create: `src/components/tip-matrix.tsx` — a tábla kliens komponense.
- Create: `src/components/tip-matrix-stats-dialog.tsx` — lezárt meccs → `MatchTipsTab` dialogban.
- Create: `src/components/tip-matrix-bet-dialog.tsx` — jövőbeli meccs → `BetDialog` (Phase 2).
- Modify: `src/components/group-detail-tabs.tsx` — új `matrix` tab, default, `TipMatrix` render.
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — kezdeti forduló lekérése + propok.
- Modify: `messages/hu.json`, `messages/en.json` — tab címke + `tipMatrix` namespace.

---

## Task 1: Pure logika + tesztek (`lib/tip-matrix.ts`)

**Files:**
- Create: `src/lib/tip-matrix.ts`
- Test: `tests/lib/tip-matrix.test.ts`

**Interfaces:**
- Produces:
  - `type MatchStatus = "scheduled" | "live" | "finished" | "cancelled"`
  - `interface RoundMatchInput { id: string; round: string; scheduledAt: Date; status: MatchStatus }`
  - `interface RoundGroup { key: string; label: string; matchIds: string[]; minScheduledAt: number }`
  - `groupMatchesIntoRounds(matches: readonly RoundMatchInput[]): RoundGroup[]`
  - `pickDefaultRoundKey(rounds: readonly RoundGroup[], startedMatchIds: ReadonlySet<string>): string | null`
  - `isMatchLocked(status: MatchStatus, scheduledAt: Date, now: Date): boolean`
  - `filterRoundBetsForViewer<T extends { matchId: string; userId: string }>(bets: readonly T[], lockedMatchIds: ReadonlySet<string>, currentUserId: string): T[]`
  - `betNet(payout: number | null, stake: number): number | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/tip-matrix.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  betNet,
  filterRoundBetsForViewer,
  groupMatchesIntoRounds,
  isMatchLocked,
  pickDefaultRoundKey,
  type RoundMatchInput,
} from "@/lib/tip-matrix";

const d = (iso: string) => new Date(iso);

const matches: RoundMatchInput[] = [
  { id: "m3", round: "2. forduló", scheduledAt: d("2026-06-20T18:00:00Z"), status: "scheduled" },
  { id: "m1", round: "1. forduló", scheduledAt: d("2026-06-18T18:00:00Z"), status: "finished" },
  { id: "m2", round: "1. forduló", scheduledAt: d("2026-06-18T20:00:00Z"), status: "finished" },
  { id: "m4", round: "2. forduló", scheduledAt: d("2026-06-20T20:00:00Z"), status: "scheduled" },
];

describe("groupMatchesIntoRounds", () => {
  it("groups by round and orders rounds by earliest match", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(rounds.map((r) => r.key)).toEqual(["1. forduló", "2. forduló"]);
  });

  it("orders matchIds within a round by scheduledAt", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(rounds[0].matchIds).toEqual(["m1", "m2"]);
    expect(rounds[1].matchIds).toEqual(["m3", "m4"]);
  });

  it("returns [] for no matches", () => {
    expect(groupMatchesIntoRounds([])).toEqual([]);
  });
});

describe("pickDefaultRoundKey", () => {
  it("picks the latest round that has a started match", () => {
    const rounds = groupMatchesIntoRounds(matches);
    // only round 1 matches have started
    const started = new Set(["m1", "m2"]);
    expect(pickDefaultRoundKey(rounds, started)).toBe("1. forduló");
  });

  it("picks the latest round when a later round has started", () => {
    const rounds = groupMatchesIntoRounds(matches);
    const started = new Set(["m1", "m2", "m3"]);
    expect(pickDefaultRoundKey(rounds, started)).toBe("2. forduló");
  });

  it("falls back to the earliest round when nothing has started", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(pickDefaultRoundKey(rounds, new Set())).toBe("1. forduló");
  });

  it("returns null when there are no rounds", () => {
    expect(pickDefaultRoundKey([], new Set())).toBeNull();
  });
});

describe("isMatchLocked", () => {
  const now = d("2026-06-20T19:00:00Z");
  it("scheduled & future => not locked", () => {
    expect(isMatchLocked("scheduled", d("2026-06-20T20:00:00Z"), now)).toBe(false);
  });
  it("scheduled but kickoff passed => locked", () => {
    expect(isMatchLocked("scheduled", d("2026-06-20T18:00:00Z"), now)).toBe(true);
  });
  it("finished => locked even if scheduledAt somehow future", () => {
    expect(isMatchLocked("finished", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
  it("cancelled => locked", () => {
    expect(isMatchLocked("cancelled", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
});

describe("filterRoundBetsForViewer", () => {
  const bets = [
    { matchId: "locked1", userId: "u1" },
    { matchId: "locked1", userId: "u2" },
    { matchId: "future1", userId: "u1" }, // me
    { matchId: "future1", userId: "u2" }, // someone else — MUST be hidden
  ];
  const locked = new Set(["locked1"]);

  it("keeps all bets on locked matches", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u1");
    expect(visible.filter((b) => b.matchId === "locked1")).toHaveLength(2);
  });

  it("hides other users' bets on not-yet-locked matches", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u1");
    const future = visible.filter((b) => b.matchId === "future1");
    expect(future).toHaveLength(1);
    expect(future[0].userId).toBe("u1");
  });

  it("keeps the viewer's own bet on a future match", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u2");
    const future = visible.filter((b) => b.matchId === "future1");
    expect(future).toHaveLength(1);
    expect(future[0].userId).toBe("u2");
  });
});

describe("betNet", () => {
  it("returns payout - stake when scored", () => {
    expect(betNet(280, 100)).toBe(180);
  });
  it("returns negative net for a loss", () => {
    expect(betNet(10, 100)).toBe(-90);
  });
  it("returns null when payout is null (not scored)", () => {
    expect(betNet(null, 100)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tip-matrix`
Expected: FAIL — `Cannot find module "@/lib/tip-matrix"` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/tip-matrix.ts`:

```typescript
/**
 * Tipp-tábla (mátrix-ranglista) pure logikája: forduló-csoportosítás,
 * alapforduló-választás, lock-detektálás, adatvédelmi szűrés, nettó számítás.
 * Tesztelve: tests/lib/tip-matrix.test.ts.
 */

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface RoundMatchInput {
  id: string;
  round: string;
  scheduledAt: Date;
  status: MatchStatus;
}

export interface RoundGroup {
  key: string;
  label: string;
  matchIds: string[];
  minScheduledAt: number;
}

/**
 * A meccseket `round` szerint csoportosítja, a fordulókat a bennük lévő
 * legkorábbi `scheduledAt` szerint növekvő sorrendbe rakja, a fordulón belül a
 * meccseket szintén `scheduledAt` szerint rendezi.
 */
export function groupMatchesIntoRounds(matches: readonly RoundMatchInput[]): RoundGroup[] {
  const byRound = new Map<string, RoundMatchInput[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  const rounds: RoundGroup[] = [];
  for (const [key, list] of byRound) {
    const sorted = [...list].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    rounds.push({
      key,
      label: key,
      matchIds: sorted.map((m) => m.id),
      minScheduledAt: sorted[0].scheduledAt.getTime(),
    });
  }

  rounds.sort((a, b) => a.minScheduledAt - b.minScheduledAt);
  return rounds;
}

/**
 * Az alapértelmezett forduló: a legkésőbbi forduló, amelyben már van elkezdődött
 * meccs; ha egyik forduló sem kezdődött el, a legkorábbi forduló. Üres listára null.
 */
export function pickDefaultRoundKey(
  rounds: readonly RoundGroup[],
  startedMatchIds: ReadonlySet<string>,
): string | null {
  if (rounds.length === 0) return null;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matchIds.some((id) => startedMatchIds.has(id))) {
      return rounds[i].key;
    }
  }
  return rounds[0].key;
}

/** Lockolt egy meccs, ha már nem fogadható: nem `scheduled`, vagy a kezdés elmúlt. */
export function isMatchLocked(status: MatchStatus, scheduledAt: Date, now: Date): boolean {
  return status !== "scheduled" || scheduledAt.getTime() <= now.getTime();
}

/**
 * Adatvédelmi szűrés: lockolt meccsen minden tipp látható; még nem lockolt
 * (jövőbeli) meccsen csak a néző saját tippje. Mások jövőbeli tippje SOHA nem
 * kerülhet a kliensre — ezt itt, szerver-oldalon vágjuk le.
 */
export function filterRoundBetsForViewer<T extends { matchId: string; userId: string }>(
  bets: readonly T[],
  lockedMatchIds: ReadonlySet<string>,
  currentUserId: string,
): T[] {
  return bets.filter((b) => lockedMatchIds.has(b.matchId) || b.userId === currentUserId);
}

/** A cella nettó token-hozama: payout − tét, vagy null, ha még nincs lepontozva. */
export function betNet(payout: number | null, stake: number): number | null {
  return payout == null ? null : payout - stake;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tip-matrix`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run check && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tip-matrix.ts tests/lib/tip-matrix.test.ts
git commit -m "feat(tip-matrix): pure logika (forduló, alapforduló, lock, adatvédelmi szűrés)"
```

---

## Task 2: Query (`queries/tip-matrix.ts`)

**Files:**
- Create: `src/queries/tip-matrix.ts`

**Interfaces:**
- Consumes (Task 1): `MatchStatus`, `RoundMatchInput`, `groupMatchesIntoRounds`, `pickDefaultRoundKey`, `isMatchLocked`, `filterRoundBetsForViewer`.
- Consumes (existing): `getMatchesForTournament(tournamentId, useFlagFallback)` (`@/queries/matches`) → meccsek `homeTeam`/`awayTeam` (display-feloldva), `odds` (legfrissebb, max 1 elem), `homeScore`/`awayScore`/`status`/`scheduledAt`/`round`.
- Produces:
  - `interface TipMatrixMatch { id: string; round: string; homeTeam: { name: string; logoUrl: string | null }; awayTeam: { name: string; logoUrl: string | null }; homeScore: number | null; awayScore: number | null; status: MatchStatus; scheduledAt: string; locked: boolean; odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null }`
  - `interface TipMatrixBet { matchId: string; userId: string; predictedHome: number; predictedAway: number; stake: number; oddsAtBet: string | null; payout: number | null; result1x2Correct: boolean | null; goalDiffCorrect: boolean | null; exactScoreCorrect: boolean | null }`
  - `interface TipMatrixRound { roundKey: string; roundLabel: string; orderedRoundKeys: string[]; matches: TipMatrixMatch[]; bets: TipMatrixBet[] }`
  - `getTipMatrixRound(groupId, tournamentId, useFlagFallback, currentUserId, roundKey): Promise<TipMatrixRound | null>`

- [ ] **Step 1: Write the file**

Create `src/queries/tip-matrix.ts`:

```typescript
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";
import {
  filterRoundBetsForViewer,
  groupMatchesIntoRounds,
  isMatchLocked,
  type MatchStatus,
  pickDefaultRoundKey,
  type RoundMatchInput,
} from "@/lib/tip-matrix";
import { getMatchesForTournament } from "@/queries/matches";

export interface TipMatrixMatch {
  id: string;
  round: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  scheduledAt: string;
  locked: boolean;
  odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null;
}

export interface TipMatrixBet {
  matchId: string;
  userId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  oddsAtBet: string | null;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

export interface TipMatrixRound {
  roundKey: string;
  roundLabel: string;
  orderedRoundKeys: string[];
  matches: TipMatrixMatch[];
  bets: TipMatrixBet[];
}

/**
 * Egy forduló mátrix-adata a megadott csoportra: a forduló meccsei
 * (display-feloldott csapatok, lock-állapot, odds) + a tippek
 * ADATVÉDELMILEG SZŰRVE (jövőbeli meccsen csak a néző saját tippje).
 * `roundKey === null` esetén az alapértelmezett fordulót adja.
 */
export async function getTipMatrixRound(
  groupId: string,
  tournamentId: string,
  useFlagFallback: boolean,
  currentUserId: string,
  roundKey: string | null,
): Promise<TipMatrixRound | null> {
  const now = new Date();
  const allMatches = await getMatchesForTournament(tournamentId, useFlagFallback);

  const roundInputs: RoundMatchInput[] = allMatches.map((m) => ({
    id: m.id,
    round: m.round,
    scheduledAt: m.scheduledAt,
    status: m.status as MatchStatus,
  }));

  const rounds = groupMatchesIntoRounds(roundInputs);
  if (rounds.length === 0) return null;

  const startedMatchIds = new Set(
    roundInputs.filter((m) => m.scheduledAt.getTime() <= now.getTime()).map((m) => m.id),
  );
  const selectedKey = roundKey ?? pickDefaultRoundKey(rounds, startedMatchIds);
  const round = rounds.find((r) => r.key === selectedKey) ?? rounds[0];

  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const roundMatches = round.matchIds
    .map((id) => matchById.get(id))
    .filter((m): m is NonNullable<typeof m> => m != null);

  const tipMatches: TipMatrixMatch[] = roundMatches.map((m) => ({
    id: m.id,
    round: m.round,
    homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
    awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status as MatchStatus,
    scheduledAt: m.scheduledAt.toISOString(),
    locked: isMatchLocked(m.status as MatchStatus, m.scheduledAt, now),
    odds: m.odds[0]
      ? { homeOdds: m.odds[0].homeOdds, drawOdds: m.odds[0].drawOdds, awayOdds: m.odds[0].awayOdds }
      : null,
  }));

  const lockedMatchIds = new Set(tipMatches.filter((m) => m.locked).map((m) => m.id));

  const roundBetRows =
    round.matchIds.length === 0
      ? []
      : await db.query.bets.findMany({
          where: and(eq(bets.groupId, groupId), inArray(bets.matchId, round.matchIds)),
        });

  const allRoundBets: TipMatrixBet[] = roundBetRows.map((b) => ({
    matchId: b.matchId,
    userId: b.userId,
    predictedHome: b.predictedHome,
    predictedAway: b.predictedAway,
    stake: b.stake,
    oddsAtBet: b.oddsAtBet,
    payout: b.payout,
    result1x2Correct: b.result1x2Correct,
    goalDiffCorrect: b.goalDiffCorrect,
    exactScoreCorrect: b.exactScoreCorrect,
  }));

  const visibleBets = filterRoundBetsForViewer(allRoundBets, lockedMatchIds, currentUserId);

  return {
    roundKey: round.key,
    roundLabel: round.label,
    orderedRoundKeys: rounds.map((r) => r.key),
    matches: tipMatches,
    bets: visibleBets,
  };
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npm run check && npx tsc --noEmit`
Expected: no errors. (If `m.status as MatchStatus` complains, the cast is intentional — the DB enum and `MatchStatus` are the same string union.)

- [ ] **Step 3: Commit**

```bash
git add src/queries/tip-matrix.ts
git commit -m "feat(tip-matrix): forduló-szintű, adatvédelmileg szűrt mátrix query"
```

---

## Task 3: Szerver-akció (`actions/tip-matrix.ts`)

**Files:**
- Create: `src/actions/tip-matrix.ts`

**Interfaces:**
- Consumes (Task 2): `TipMatrixRound`, `getTipMatrixRound`.
- Consumes (existing): `getCurrentUser` (`@/lib/auth/user-sync`), `db`, `groups`, `groupMembers` (`@/db/schema`).
- Produces: `getTipMatrixRoundAction(groupId: string, roundKey: string | null): Promise<TipMatrixRound | null>`

- [ ] **Step 1: Write the file**

Create `src/actions/tip-matrix.ts`:

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTipMatrixRound, type TipMatrixRound } from "@/queries/tip-matrix";

/**
 * Forduló-váltás a Tipp-táblán. Auth + jogosultság: a csoport tagja, vagy
 * publikus csoport (pl. a hivatalos Ranglista). Privát csoport tippjei nem
 * tagnak nem szivárognak ki.
 */
export async function getTipMatrixRoundAction(
  groupId: string,
  roundKey: string | null,
): Promise<TipMatrixRound | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) return null;

  if (!group.isPublic) {
    const membership = await db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    });
    if (!membership) return null;
  }

  return getTipMatrixRound(
    groupId,
    group.tournamentId,
    group.tournament.useFlagFallback,
    user.id,
    roundKey,
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npm run check && npx tsc --noEmit`
Expected: no errors. (If `with: { tournament: true }` errors, confirm the `groups → tournament` relation name in `src/db/schema.ts` relations and adjust; the group detail page already reads `group.tournament`, so the relation exists.)

- [ ] **Step 3: Commit**

```bash
git add src/actions/tip-matrix.ts
git commit -m "feat(tip-matrix): forduló-váltó szerver-akció auth-tal"
```

---

## Task 4: Statisztika dialog (`components/tip-matrix-stats-dialog.tsx`)

Lezárt meccsre kattintva a meglévő `MatchTipsTab` nyílik dialogban. Az adatot a meglévő `getMatchGroupBets` akció adja (a néző csoportjaira), amiből kiválasztjuk a saját csoportunkat.

**Files:**
- Create: `src/components/tip-matrix-stats-dialog.tsx`

**Interfaces:**
- Consumes (existing): `getMatchGroupBets` (`@/actions/live`) → `GroupBetsForMatch[]`; `MatchTipsTab` (`@/components/match-tips-tab`); `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` (`@/components/ui/dialog`).
- Produces: `TipMatrixStatsDialog({ groupId, matchId, title, isFinished, oddsBoost, open, onOpenChange })`

- [ ] **Step 1: Write the file**

Create `src/components/tip-matrix-stats-dialog.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { getMatchGroupBets } from "@/actions/live";
import { MatchTipsTab } from "@/components/match-tips-tab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TipMatrixStatsDialogProps {
  groupId: string;
  matchId: string;
  title: string;
  isFinished: boolean;
  oddsBoost: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipMatrixStatsDialog({
  groupId,
  matchId,
  title,
  isFinished,
  oddsBoost,
  open,
  onOpenChange,
}: TipMatrixStatsDialogProps) {
  const t = useTranslations("tipMatrix");
  const tm = useTranslations("matches");

  const { data, isLoading } = useSWR(
    open ? ["tip-matrix-stats", groupId, matchId] : null,
    () => getMatchGroupBets(matchId),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const group = data?.find((g) => g.groupId === groupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-[14px]">{title}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
        {!isLoading && !group && (
          <p className="text-muted-foreground text-sm">{t("noTips")}</p>
        )}
        {group && (
          <MatchTipsTab
            bets={group.bets}
            currentUserId=""
            isFinished={isFinished}
            youLabel={tm("youLabel")}
            oddsBoost={group.oddsBoost}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

> Megjegyzés: a `currentUserId` üres stringként megy — a `MatchTipsTab` ezt csak a saját sor megjelölésére használja; a Tipp-táblán a saját sor a mátrixban már kiemelt. Ha kell a kiemelés a dialogban is, a `TipMatrix` továbbadhatja a valós `currentUserId`-t (Step a Task 5-ben már átadja propként; ott beköthető). Egyelőre üres string, a buborék konzisztens marad.

- [ ] **Step 2: Lint + typecheck**

Run: `npm run check && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tip-matrix-stats-dialog.tsx
git commit -m "feat(tip-matrix): statisztika dialog a meglévő MatchTipsTab-bal"
```

---

## Task 5: A tábla komponens (`components/tip-matrix.tsx`)

A fő kliens komponens: sticky név-oszlop (mobilon csak avatar), `Σ`, fordulónkénti meccs-oszlopok, B-variáns cellák (tipp + nettó, tónus), saját-sor kiemelés, „ugorj rám" sáv, forduló-nav (← →) a `getTipMatrixRoundAction`-nel, lezárt meccs kattintás → `TipMatrixStatsDialog`. (A jövőbeli meccs kattintás Phase 2 — Task 8; addig no-op.)

**Files:**
- Create: `src/components/tip-matrix.tsx`

**Interfaces:**
- Consumes (Task 1): `betNet` (`@/lib/tip-matrix`).
- Consumes (Task 2): `TipMatrixRound`, `TipMatrixBet`, `TipMatrixMatch`.
- Consumes (Task 3): `getTipMatrixRoundAction`.
- Consumes (Task 4): `TipMatrixStatsDialog`.
- Consumes (existing): `predictionToneClass` (`@/lib/bet-display`); `Avatar`, `AvatarFallback`, `AvatarImage` (`@/components/ui/avatar`); `Button` (`@/components/ui/button`); `cn` (`@/lib/utils`); `useTranslations`, `useFormatter` (next-intl).
- Produces:
  - `interface TipMatrixLeaderboardRow { rank: number; userId: string; userName: string; userAvatarUrl: string | null; profit: number }`
  - `TipMatrix({ groupId, currentUserId, oddsBoost, timeZone, leaderboard, initialRound, readOnly }: TipMatrixProps)`

- [ ] **Step 1: Write the file**

Create `src/components/tip-matrix.tsx`:

```typescript
"use client";

import { ArrowDownToLine, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { TipMatrixStatsDialog } from "@/components/tip-matrix-stats-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { predictionToneClass } from "@/lib/bet-display";
import { betNet } from "@/lib/tip-matrix";
import type { TipMatrixBet, TipMatrixMatch, TipMatrixRound } from "@/queries/tip-matrix";
import { cn } from "@/lib/utils";

export interface TipMatrixLeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface TipMatrixProps {
  groupId: string;
  currentUserId: string;
  oddsBoost: number;
  timeZone: string;
  leaderboard: TipMatrixLeaderboardRow[];
  initialRound: TipMatrixRound | null;
  readOnly?: boolean;
}

const cellKey = (userId: string, matchId: string) => `${userId}__${matchId}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function TipMatrix({
  groupId,
  currentUserId,
  oddsBoost,
  timeZone,
  leaderboard,
  initialRound,
  readOnly = false,
}: TipMatrixProps) {
  const t = useTranslations("tipMatrix");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [cache, setCache] = useState<Record<string, TipMatrixRound>>(
    initialRound ? { [initialRound.roundKey]: initialRound } : {},
  );
  const [roundKey, setRoundKey] = useState<string | null>(initialRound?.roundKey ?? null);

  const round = roundKey ? cache[roundKey] : null;

  const [stats, setStats] = useState<{ matchId: string; title: string; isFinished: boolean } | null>(
    null,
  );

  const meRowRef = useRef<HTMLTableRowElement | null>(null);

  const betByCell = useMemo(() => {
    const map = new Map<string, TipMatrixBet>();
    for (const b of round?.bets ?? []) map.set(cellKey(b.userId, b.matchId), b);
    return map;
  }, [round]);

  if (!round) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  const keys = round.orderedRoundKeys;
  const idx = keys.indexOf(round.roundKey);
  const prevKey = idx > 0 ? keys[idx - 1] : null;
  const nextKey = idx >= 0 && idx < keys.length - 1 ? keys[idx + 1] : null;

  function goToRound(key: string | null) {
    if (!key) return;
    if (cache[key]) {
      setRoundKey(key);
      return;
    }
    startTransition(async () => {
      const data = await getTipMatrixRoundAction(groupId, key);
      if (data) {
        setCache((c) => ({ ...c, [data.roundKey]: data }));
        setRoundKey(data.roundKey);
      }
    });
  }

  const meRow = leaderboard.find((r) => r.userId === currentUserId);

  function headerResult(m: TipMatrixMatch) {
    if (m.status === "finished" && m.homeScore != null && m.awayScore != null) {
      return <span className="font-bold text-[13px] text-gold">{`${m.homeScore}:${m.awayScore}`}</span>;
    }
    if (m.status === "cancelled") {
      return <span className="text-[11px] text-muted-foreground">{t("cancelled")}</span>;
    }
    if (m.locked) {
      return (
        <span className="rounded-[3px] bg-loss px-[4px] py-px text-[8px] text-loss-foreground tracking-wide">
          {t("live")}
        </span>
      );
    }
    return (
      <span className="text-[11px] text-faint">
        {format.dateTime(new Date(m.scheduledAt), { timeZone, hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  function renderCell(row: TipMatrixLeaderboardRow, m: TipMatrixMatch) {
    const bet = betByCell.get(cellKey(row.userId, m.id));
    const isMe = row.userId === currentUserId;

    if (!bet) {
      if (m.locked) {
        return <span className="text-faint">–</span>;
      }
      // not locked, no bet: own row may bet (Phase 2), others see lock
      if (isMe && !readOnly) {
        return <span className="text-faint">+</span>;
      }
      return <Lock className="mx-auto size-3 text-faint" aria-label={t("hidden")} />;
    }

    const pred = `${bet.predictedHome}:${bet.predictedAway}`;

    if (!m.locked) {
      // own future tip
      return (
        <span className="inline-block rounded-[6px] px-[6px] py-px outline outline-[1.5px] outline-gold-line">
          <span className="block font-semibold text-gold">{pred}</span>
        </span>
      );
    }

    const tone = predictionToneClass({
      result1x2Correct: bet.result1x2Correct,
      goalDiffCorrect: bet.goalDiffCorrect,
      exactScoreCorrect: bet.exactScoreCorrect,
      payout: bet.payout,
      stake: bet.stake,
      oddsAtBet: bet.oddsAtBet,
    });
    const net = betNet(bet.payout, bet.stake);

    return (
      <span className="flex flex-col items-center leading-tight">
        <span className={cn("text-[13px]", tone)}>{pred}</span>
        {net == null ? (
          <span className="text-[10px] text-faint">…</span>
        ) : (
          <span className={cn("text-[10px]", net >= 0 ? "text-win" : "text-loss")}>{signed(net)}</span>
        )}
      </span>
    );
  }

  function onMatchClick(m: TipMatrixMatch) {
    const title = `${m.homeTeam.name} – ${m.awayTeam.name}`;
    if (m.locked) {
      setStats({ matchId: m.id, title, isFinished: m.status === "finished" });
    }
    // Phase 2 (Task 8): not-locked → bet dialog
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface">
      {/* Round nav */}
      <div className="flex items-center justify-between border-border border-b bg-surface-2 px-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToRound(prevKey)}
          disabled={!prevKey || isPending}
          aria-label={t("prevRound")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-semibold text-[13px] text-foreground">{round.roundLabel}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToRound(nextKey)}
          disabled={!nextKey || isPending}
          aria-label={t("nextRound")}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] border-border border-b bg-surface-2 px-2.5 py-2 text-left text-[11px] text-muted-foreground">
                {t("player")}
              </th>
              <th className="border-border border-b bg-surface-2 px-2.5 py-2 text-[11px] text-muted-foreground">
                Σ
              </th>
              {round.matches.map((m) => (
                <th
                  key={m.id}
                  className="cursor-pointer border-border border-b bg-surface-2 px-2.5 py-2 align-bottom hover:bg-surface-3"
                  onClick={() => onMatchClick(m)}
                >
                  <span className="flex justify-center gap-[5px] text-[15px] leading-none">
                    <FlagOrLogo team={m.homeTeam} />
                    <FlagOrLogo team={m.awayTeam} />
                  </span>
                  <span className="mt-1 block">{headerResult(m)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row) => {
              const isMe = row.userId === currentUserId;
              return (
                <tr
                  key={row.userId}
                  ref={isMe ? meRowRef : undefined}
                  className={cn(isMe && "bg-gold-soft")}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-[1] border-border border-b px-2.5 py-2 text-left",
                      isMe ? "bg-[#2a2a1c]" : "bg-surface",
                    )}
                  >
                    <span className={cn("flex items-center gap-2", isMe && "font-bold text-gold")}>
                      <span className="w-4 text-right text-muted-foreground">{row.rank}.</span>
                      <Avatar className="size-[22px]">
                        <AvatarImage src={row.userAvatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{row.userName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="max-[560px]:hidden">{row.userName}</span>
                    </span>
                  </td>
                  <td className="border-border border-b px-2.5 py-2 text-center font-bold text-[14px] text-gold">
                    {signed(row.profit)}
                  </td>
                  {round.matches.map((m) => (
                    <td
                      key={m.id}
                      className="cursor-pointer border-border border-b px-2.5 py-2 text-center hover:bg-surface-3"
                      onClick={() => onMatchClick(m)}
                    >
                      {renderCell(row, m)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Jump-to-me bar */}
      {meRow && !readOnly && (
        <div className="flex items-center gap-2.5 border-gold border-t bg-surface-2 px-3 py-2">
          <span className="font-bold text-gold">{meRow.rank}.</span>
          <span className="font-bold">{t("youName", { name: meRow.userName })}</span>
          <span className="ml-auto font-bold text-gold">{signed(meRow.profit)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("jumpToMe")}
            onClick={() => meRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <ArrowDownToLine className="size-4 text-gold" />
          </Button>
        </div>
      )}

      {stats && (
        <TipMatrixStatsDialog
          groupId={groupId}
          matchId={stats.matchId}
          title={stats.title}
          isFinished={stats.isFinished}
          oddsBoost={oddsBoost}
          open={!!stats}
          onOpenChange={(o) => !o && setStats(null)}
        />
      )}
    </div>
  );
}

function FlagOrLogo({ team }: { team: { name: string; logoUrl: string | null } }) {
  if (team.logoUrl) {
    // biome-ignore lint/performance/noImgElement: small inline flag/logo, no Next/Image needed
    return <img src={team.logoUrl} alt={team.name} className="h-4 w-4 rounded-[2px] object-contain" />;
  }
  return <span className="text-[10px] text-muted-foreground">{team.name.slice(0, 3).toUpperCase()}</span>;
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npm run check && npx tsc --noEmit`
Expected: no errors. (If Biome flags the `<img>`, the inline `biome-ignore` comment is already present; if a different rule name applies, adjust the comment to match the reported rule.)

- [ ] **Step 3: Commit**

```bash
git add src/components/tip-matrix.tsx
git commit -m "feat(tip-matrix): tábla komponens (forduló-nav, cellák, saját-sor, ugorj-rám, stats dialog)"
```

---

## Task 6: i18n szövegek (`messages/hu.json`, `messages/en.json`)

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

**Interfaces:**
- Produces: `groups.tipMatrix` (tab címke) + a teljes `tipMatrix` namespace, amit a Task 4–5 komponensek olvasnak: `player`, `live`, `cancelled`, `hidden`, `empty`, `noTips`, `loading`, `prevRound`, `nextRound`, `jumpToMe`, `youName`.

- [ ] **Step 1: Add the tab label to the `groups` namespace (hu.json)**

A `messages/hu.json` `groups` objektumába, a `"results": "Eredmények"` mellé:

```json
    "results": "Eredmények",
    "tipMatrix": "Tipp-tábla"
```

- [ ] **Step 2: Add the `tipMatrix` namespace (hu.json)**

A `messages/hu.json` gyökerébe egy új top-level namespace (a meglévő namespace-ek mellé):

```json
  "tipMatrix": {
    "player": "Játékos",
    "live": "ÉLŐ",
    "cancelled": "törölve",
    "hidden": "Rejtett tipp (kezdésig)",
    "empty": "Nincs megjeleníthető forduló.",
    "noTips": "Ebben a csoportban nincs tipp erre a meccsre.",
    "loading": "Betöltés…",
    "prevRound": "Előző forduló",
    "nextRound": "Következő forduló",
    "jumpToMe": "Ugorj a soromra",
    "youName": "{name} (te)"
  }
```

- [ ] **Step 3: Mirror into `messages/en.json`**

`groups`-ba: `"tipMatrix": "Tip table"`. Új namespace:

```json
  "tipMatrix": {
    "player": "Player",
    "live": "LIVE",
    "cancelled": "cancelled",
    "hidden": "Hidden tip (until kickoff)",
    "empty": "No round to display.",
    "noTips": "No tips for this match in this group.",
    "loading": "Loading…",
    "prevRound": "Previous round",
    "nextRound": "Next round",
    "jumpToMe": "Jump to my row",
    "youName": "{name} (you)"
  }
```

- [ ] **Step 4: Verify JSON validity + lint**

Run: `npm run check`
Expected: no errors (Biome formats/validates JSON). If a comma/brace is off, fix it.

- [ ] **Step 5: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat(tip-matrix): i18n szövegek (hu/en)"
```

---

## Task 7: Oldal + tab integráció (default tab)

A csoport-oldal szerver-komponense lekéri a kezdeti fordulót, és átadja; a `GroupDetailTabs` új `matrix` tabot kap, ami az alapértelmezett, és rendereli a `TipMatrix`-ot.

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`
- Modify: `src/components/group-detail-tabs.tsx`

**Interfaces:**
- Consumes (Task 2): `getTipMatrixRound`, `TipMatrixRound`.
- Consumes (Task 5): `TipMatrix`.

- [ ] **Step 1: Page — import the query**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` importjaihoz add:

```typescript
import { getTipMatrixRound } from "@/queries/tip-matrix";
```

- [ ] **Step 2: Page — fetch the initial round in the existing Promise.all**

A meglévő `Promise.all([...])` tömbbe (ahol `getGroupLeaderboard(group.id)` stb. van) vegyél fel egy hatodik elemet, és a destrukturálást is bővítsd:

```typescript
  const [leaderboard, finishedMatches, groupBetsRaw, upcomingDays, matchTimes, initialMatrixRound] =
    await Promise.all([
      getGroupLeaderboard(group.id),
      getFinishedMatchesForTournament(group.tournamentId, group.tournament.useFlagFallback),
      getGroupBetsForFinishedMatches(group.id),
      getUpcomingBetSummary(
        group.tournamentId,
        group.id,
        user.id,
        group.tournament.timezone,
        locale,
        group.tournament.useFlagFallback,
      ),
      getTournamentMatchTimes(group.tournamentId),
      getTipMatrixRound(
        group.id,
        group.tournamentId,
        group.tournament.useFlagFallback,
        user.id,
        null,
      ),
    ]);
```

- [ ] **Step 3: Page — pass new props to `<GroupDetailTabs />`**

A `<GroupDetailTabs ... />` JSX-be (a meglévő propok mellé) add:

```tsx
        timeZone={group.tournament.timezone}
        initialMatrixRound={initialMatrixRound}
```

- [ ] **Step 4: Tabs — imports + props type**

`src/components/group-detail-tabs.tsx`:

Importokhoz:

```typescript
import { TipMatrix } from "@/components/tip-matrix";
import type { TipMatrixRound } from "@/queries/tip-matrix";
```

A `GroupDetailTabsProps` interfészbe (a meglévő mezők mellé):

```typescript
  timeZone: string;
  initialMatrixRound: TipMatrixRound | null;
```

A komponens paraméter-destrukturálásába:

```typescript
  timeZone,
  initialMatrixRound,
```

- [ ] **Step 5: Tabs — make `matrix` the default tab and render it**

A `return (<Tabs defaultValue="leaderboard">` sort cseréld:

```tsx
    <Tabs defaultValue="matrix">
      <TabsList className="w-full">
        <TabsTrigger value="matrix">{t("tipMatrix")}</TabsTrigger>
        <TabsTrigger value="leaderboard">{t("leaderboard")}</TabsTrigger>
        <TabsTrigger value="results">{t("results")}</TabsTrigger>
        {canEditSettings && <TabsTrigger value="settings">{t("settings")}</TabsTrigger>}
      </TabsList>

      {/* Tipp-tábla */}
      <TabsContent value="matrix" className="mt-4">
        <TipMatrix
          groupId={groupId}
          currentUserId={currentUserId}
          oddsBoost={settings.oddsBoost}
          timeZone={timeZone}
          leaderboard={liveLeaderboard}
          initialRound={initialMatrixRound}
        />
      </TabsContent>
```

(A meglévő `leaderboard`/`results`/`settings` `TabsContent` blokkok változatlanok maradnak utána.)

- [ ] **Step 6: Lint + typecheck + build**

Run: `npm run check && npx tsc --noEmit && npm run build`
Expected: no errors; a build sikeres.

- [ ] **Step 7: Manual smoke test**

Indítsd: `npm run dev`, nyiss meg egy csoport-oldalt (`/tournaments/<slug>/groups/<gSlug>`). Ellenőrizd:
- A **Tipp-tábla** tab az alapértelmezett (ez nyílik).
- A tábla a legkésőbbi elkezdődött fordulót mutatja; ← → vált.
- A név-oszlop ragad balra; vízszintes görgetésnél a `Σ` és a meccs-oszlopok görögnek.
- A saját sor arany; az „ugorj rám" gomb a sorra görget.
- Befejezett meccsre kattintva nyílik a statisztika dialog.
- Jövőbeli meccsen mások cellája 🔒, a sajátod arany kerettel.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx" src/components/group-detail-tabs.tsx
git commit -m "feat(tip-matrix): Tipp-tábla tab a csoport-oldalon (alapértelmezett)"
```

---

## Task 8 (Phase 2): Jövőbeli meccs → tipplap dialog

A jövőbeli meccs cellájára/fejlécére kattintva a meglévő `BetDialog` nyílik, hogy a néző leadhassa/módosíthassa a tippjét. A `BetDialog` `groups: GroupBetInfo[]` és `match: MatchCardData` adatát egy új akció állítja össze a meglévő `getBatchProjectedBalances`-ből (egy csoportra, egy meccsre szűkítve).

**Files:**
- Modify: `src/actions/tip-matrix.ts` — `getTipMatrixBetInfoAction`.
- Create: `src/components/tip-matrix-bet-dialog.tsx`.
- Modify: `src/components/tip-matrix.tsx` — jövőbeli kattintás → bet dialog.

**Interfaces:**
- Consumes (existing): `getBatchProjectedBalances`, `ProjectedBalanceResult` (`@/queries/groups`); `getMatchesForTournament`, `getLatestOdds` (`@/queries/matches`); `getUserBetsForMatch` (`@/queries/bets`); `BetDialog`, `GroupBetInfo`-szerű alak (`@/components/bet-dialog`/`bet-form`); `MatchCardData` (`@/components/match-card`).
- Produces:
  - `interface TipMatrixBetInfo { match: MatchCardData; group: GroupBetInfo }`
  - `getTipMatrixBetInfoAction(groupId: string, matchId: string): Promise<TipMatrixBetInfo | null>`
  - `TipMatrixBetDialog({ groupId, matchId, currentUserId, timeZone, open, onOpenChange })`

- [ ] **Step 1: Verify the reusable helpers (read-only)**

Olvasd el `src/queries/groups.ts`-ben a `getBatchProjectedBalances` és `ProjectedBalanceResult` pontos szignatúráját, valamint `src/app/[locale]/tournaments/[slug]/page.tsx:152-186` blokkot (a `GroupBetInfo` összeállítás mintáját), hogy a mezőnevek 1:1 egyezzenek. A `MatchCardData` típus: `src/components/match-card.tsx:27-40`. A `bet-form.tsx` `GroupBetInfo` alakja: `src/components/bet-form.tsx:17-43`.

- [ ] **Step 2: Add `getTipMatrixBetInfoAction` to `src/actions/tip-matrix.ts`**

Add a fájlhoz (a Task 3 tartalom mellé) — a mezőket pontosan a `bet-form.tsx` `GroupBetInfo` és a `match-card.tsx` `MatchCardData` szerint töltsd, a tournament-oldal `groupBetInfosByMatch` mintáját követve:

```typescript
import { getBatchProjectedBalances } from "@/queries/groups";
import { getMatchesForTournament, getLatestOdds } from "@/queries/matches";
import { getUserBetsForMatch } from "@/queries/bets";
import { matchParticipantsKnown } from "@/queries/team-display";
// + a meglévő importok (db, groups, groupMembers, getCurrentUser)

export interface TipMatrixBetInfo {
  match: import("@/components/match-card").MatchCardData;
  group: import("@/components/bet-form").GroupBetInfo;
}

export async function getTipMatrixBetInfoAction(
  groupId: string,
  matchId: string,
): Promise<TipMatrixBetInfo | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) return null;

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (!membership) return null;

  const [allMatches, odds, myBets] = await Promise.all([
    getMatchesForTournament(group.tournamentId, group.tournament.useFlagFallback),
    getLatestOdds(matchId),
    getUserBetsForMatch(user.id, matchId),
  ]);

  const m = allMatches.find((x) => x.id === matchId);
  if (!m) return null;

  const balances = await getBatchProjectedBalances(
    user.id,
    [{ id: group.id, initialTokens: group.initialTokens, tokenPerMatch: group.tokenPerMatch }],
    allMatches.map((x) => ({ id: x.id, scheduledAt: x.scheduledAt, status: x.status })),
    group.tournament.timezone,
  );
  const bal = balances[matchId]?.[group.id];
  const existing = myBets.find((b) => b.groupId === group.id);

  const matchCard: TipMatrixBetInfo["match"] = {
    id: m.id,
    homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
    awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    scheduledAt: m.scheduledAt.toISOString(),
    round: m.round,
    participantsKnown: matchParticipantsKnown(m.homeTeam.name, m.awayTeam.name),
    odds: odds ? { homeOdds: odds.homeOdds, drawOdds: odds.drawOdds, awayOdds: odds.awayOdds } : null,
    userBets: [],
  };

  const groupInfo: TipMatrixBetInfo["group"] = {
    groupId: group.id,
    groupName: group.name,
    balance: bal?.actual ?? 0,
    projectedBalance: bal?.projected ?? 0,
    pendingDistributions: bal?.pending ?? 0,
    tokenPerMatch: bal?.tokenPerMatch ?? group.tokenPerMatch,
    initialTokens: bal?.initialTokens ?? group.initialTokens,
    eligibleMatchCount: bal?.eligibleMatchCount ?? 0,
    winnings: bal?.winnings ?? 0,
    losses: bal?.losses ?? 0,
    otherActiveStakes: bal?.otherActiveStakes ?? 0,
    oddsBoost: group.oddsBoost,
    lossPercentage: group.lossPercentage,
    bonusGoalDiff: group.bonusGoalDiff,
    bonusExactScore: group.bonusExactScore,
    bonusPodiumMention: group.bonusPodiumMention,
    bonusPodiumExact: group.bonusPodiumExact,
    existingBet: existing
      ? {
          id: existing.id,
          predictedHome: existing.predictedHome,
          predictedAway: existing.predictedAway,
          stake: existing.stake,
          oddsAtBet: existing.oddsAtBet,
        }
      : null,
    unbettedMatchCountOnDay: 1,
  };

  return { match: matchCard, group: groupInfo };
}
```

> Megjegyzés: ha a `MatchCardData` vagy `GroupBetInfo` nem exportált (`bet-form.tsx`-ben `interface GroupBetInfo` jelenleg nem `export`), Step 2a: tedd `export`-tá ezeket a típusokat a forrásfájlokban (`export interface GroupBetInfo` / `export interface MatchCardData`), hogy importálhatók legyenek. Ellenőrizd a `getUserBetsForMatch` visszatérési mezőit (`id`, `groupId`, `predictedHome`, `predictedAway`, `stake`, `oddsAtBet`) — ha eltér, igazítsd.

- [ ] **Step 3: Create `src/components/tip-matrix-bet-dialog.tsx`**

```typescript
"use client";

import useSWR from "swr";
import { getTipMatrixBetInfoAction } from "@/actions/tip-matrix";
import { BetDialog } from "@/components/bet-dialog";

interface TipMatrixBetDialogProps {
  groupId: string;
  matchId: string;
  currentUserId: string;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipMatrixBetDialog({
  groupId,
  matchId,
  currentUserId,
  timeZone,
  open,
  onOpenChange,
}: TipMatrixBetDialogProps) {
  const { data } = useSWR(
    open ? ["tip-matrix-bet", groupId, matchId] : null,
    () => getTipMatrixBetInfoAction(groupId, matchId),
    { revalidateOnFocus: false },
  );

  return (
    <BetDialog
      match={data?.match ?? null}
      groups={data ? [data.group] : []}
      open={open}
      onOpenChange={onOpenChange}
      currentUserId={currentUserId}
      timeZone={timeZone}
    />
  );
}
```

- [ ] **Step 4: Wire the future-match click in `src/components/tip-matrix.tsx`**

Add egy `bet` state-et és nyisd a not-locked ágon:

```typescript
  const [bet, setBet] = useState<{ matchId: string } | null>(null);
```

`onMatchClick`-ben a not-locked ágat:

```typescript
    if (m.locked) {
      setStats({ matchId: m.id, title, isFinished: m.status === "finished" });
    } else if (!readOnly) {
      setBet({ matchId: m.id });
    }
```

És a render végére (a `stats` dialog mellé):

```tsx
      {bet && (
        <TipMatrixBetDialog
          groupId={groupId}
          matchId={bet.matchId}
          currentUserId={currentUserId}
          timeZone={timeZone}
          open={!!bet}
          onOpenChange={(o) => !o && setBet(null)}
        />
      )}
```

Plusz az import: `import { TipMatrixBetDialog } from "@/components/tip-matrix-bet-dialog";`

- [ ] **Step 5: Lint + typecheck + build**

Run: `npm run check && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

`npm run dev` → csoport-oldal → Tipp-tábla. Egy **jövőbeli** meccs cellájára/fejlécére kattintva nyíljon a tipplap (a saját, meglévő tippeddel, ha van). Tipp leadása után a tábla frissül (navigálj a fordulóra újra / reload).

- [ ] **Step 7: Commit**

```bash
git add src/actions/tip-matrix.ts src/components/tip-matrix-bet-dialog.tsx src/components/tip-matrix.tsx src/components/bet-form.tsx src/components/match-card.tsx
git commit -m "feat(tip-matrix): jövőbeli meccs → tipplap dialog (meglévő BetDialog újrahasználat)"
```

---

## Task 9 (opcionális): Kör read-only integráció

A kör-detail oldalon (`tournaments/[slug]/circles/[circleSlug]`) jelenjen meg a `TipMatrix` `readOnly` módban, a körre szűrt + újrarangsorolt sorokkal.

**Files:**
- Modify: a kör-detail oldal komponense (keresd: `GroupLeaderboardContent` használat a circle nézetben) + a hozzá tartozó page.
- Reuse: `filterAndRerankLeaderboard` (`@/lib/circle-leaderboard`), `getTipMatrixRound`.

- [ ] **Step 1:** A kör-detail page-ben kérd le `getTipMatrixRound(officialGroupId, tournamentId, useFlagFallback, user.id, null)`-t, és a sorokat a `filterAndRerankLeaderboard(officialLeaderboard, new Set(circleMemberIds))`-szel állítsd elő.
- [ ] **Step 2:** Renderelj `<TipMatrix ... readOnly leaderboard={circleRows} initialRound={...} />`-t. `readOnly` módban nincs tipplap-dialog és nincs „ugorj rám" sáv (a komponens már ezt csinálja).
- [ ] **Step 3:** `npm run check && npx tsc --noEmit && npm run build`, majd manuális smoke a kör-oldalon.
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(tip-matrix): kör read-only Tipp-tábla"
```

---

## Final verification

- [ ] `npm run test` — minden zöld (a `tip-matrix` tesztekkel együtt).
- [ ] `npm run check` — Biome tiszta.
- [ ] `npx tsc --noEmit` — nincs típushiba.
- [ ] `npm run build` — sikeres prod build.
- [ ] Manuális: a `beam`/companion helyett a `run`/dev szerveren végignézni a 7. és 8. task smoke-listáját desktopon és keskeny (mobil) ablakban is.

---

## Self-Review jegyzet

- **Spec-lefedettség:** 2. (tab default) → Task 7; 4. (tábla/cella/sticky/mobil/jump) → Task 5; 5. (forduló-nav, alapforduló) → Task 1+5; 6. (lock/adatvédelem szerver-oldal) → Task 1+2; 7. (kattintás → meglévő komponensek) → Task 4 (stats) + Task 8 (bet); 8. (élő/jövőbeli/törölt) → Task 5 `headerResult`/`renderCell`; 9.1–9.4 (architektúra) → Task 1–7; 10. (i18n) → Task 6; 11. (tesztek) → Task 1; kör → Task 9.
- **Élő gólszám / rang-mozgás nyilak / live polling / virtualizáció:** szándékosan kívül (spec 12.).
- **Type-konzisztencia:** `TipMatrixRound`/`TipMatrixBet`/`TipMatrixMatch` egységesen a Task 2-ből; a komponens cellatónusa a meglévő `predictionToneClass` `BetOutcome` alakját kapja (mezők egyeznek: `result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect`, `payout`, `stake`, `oddsAtBet`).
