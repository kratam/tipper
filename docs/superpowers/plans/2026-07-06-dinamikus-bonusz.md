# Dinamikus gólkülönbség / pontos eredmény bónusz — Implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fix gólkülönbség/pontos eredmény token-bónuszt csoportonként konfigurálható, pool-alapú (a meccs aktív tippelőinek vagyonából számolt) dinamikus bónuszra cseréljük.

**Architecture:** A pontozás két fázisúra bomlik — tippenkénti pure alap-payout + flagek, majd meccs-szintű pool szétosztása a találók között. A pool-alap az aktív tippelők lifetime budgetje (init + tokenPerMatch × addigi meccsek + rendezett tét-nettók). A `scoreMatch` csoportonként számolja a poolt; a pure matematika tesztelhető, DB-mentes függvényekben él.

**Tech Stack:** TypeScript, Drizzle ORM (Neon Postgres), Vitest, Next.js Server Actions, next-intl.

## Global Constraints

- Séma-változás **kizárólag** `npm run db:generate` → `npm run db:migrate` úton; a migrációt kézzel futtatjuk deploy előtt (a Vercel build nem futtat migrációt). Soha nem `drizzle-kit push` / kézi SQL / Neon MCP.
- `.env.local` → Neon **dev** branch; a prod migráció a `PROD_DATABASE_URL`-lel megy.
- Minden magyar UI-szöveg ékezetesen; nincs hardcoded string — `useTranslations()`/`getTranslations()`.
- Default értékek: `bonus_goal_diff_pct = 2`, `bonus_exact_score_pct = 3` (a % maga, nem tört).
- DB műveletek Drizzle query API-val, nem raw SQL-lel (kivéve a meglévő `sql` aggregátumok mintáját).
- Commit: conventional commits.

---

### Task 1: Pure pontozó függvények (`scoring.ts`)

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts` (create)

**Interfaces:**
- Produces:
  - `calculateBaseBetPayout(input: BaseBetPayoutInput): BaseBetPayoutResult`
  - `computePoolBase(input: { initialTokens: number; tokenPerMatch: number; matchesToDate: number; bettorResolvedNets: number[] }): number`
  - `distributeBonusPools(input: { poolBase: number; goalDiffHitters: number; exactScoreHitters: number; goalDiffPct: number; exactScorePct: number }): { goalDiffPerHitter: number; exactScorePerHitter: number }`
  - Megmarad: `get1X2`, `calculatePodiumPoints`, `classicPointsFromFlags`.
  - Törlendő (Task 3 után): `calculateBetPayout`.

- [ ] **Step 1: Failing tesztek**

Create `src/lib/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateBaseBetPayout,
  computePoolBase,
  distributeBonusPools,
} from "@/lib/scoring";

describe("calculateBaseBetPayout", () => {
  it("void tipp (nincs odds) → partial refund, minden flag false", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2, predictedAway: 1, actualHome: 2, actualAway: 1,
      stake: 100, oddsAtBet: null, oddsBoost: 1.15, lossPercentage: 90,
    });
    expect(r).toEqual({ basePayout: 10, result1x2Correct: false, goalDiffCorrect: false, exactScoreCorrect: false });
  });

  it("1X2 rossz → partial refund, nincs flag", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2, predictedAway: 0, actualHome: 0, actualAway: 1,
      stake: 100, oddsAtBet: 2.0, oddsBoost: 1.0, lossPercentage: 90,
    });
    expect(r.basePayout).toBe(10);
    expect(r.result1x2Correct).toBe(false);
    expect(r.goalDiffCorrect).toBe(false);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("1X2 jó, gólkülönbség rossz → csak result1x2Correct", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 1, predictedAway: 0, actualHome: 3, actualAway: 1,
      stake: 100, oddsAtBet: 2.0, oddsBoost: 1.15, lossPercentage: 90,
    });
    expect(r.basePayout).toBe(230); // round(100 * 2.0 * 1.15)
    expect(r.result1x2Correct).toBe(true);
    expect(r.goalDiffCorrect).toBe(false);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("gólkülönbség jó, de nem pontos → goalDiffCorrect true, exact false", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2, predictedAway: 1, actualHome: 3, actualAway: 2,
      stake: 100, oddsAtBet: 2.0, oddsBoost: 1.0, lossPercentage: 90,
    });
    expect(r.result1x2Correct).toBe(true);
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("pontos eredmény → mindkét flag true", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2, predictedAway: 1, actualHome: 2, actualAway: 1,
      stake: 100, oddsAtBet: 2.0, oddsBoost: 1.0, lossPercentage: 90,
    });
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(true);
  });
});

describe("computePoolBase", () => {
  it("összegzi a tippelők lifetime budgetjét", () => {
    // 3 tippelő, init=200, tpm=100, matchesToDate=5 → 200+500=700 alap fejenként
    // nettók: [0, 300, -50] → 700*3 + 250 = 2350
    const base = computePoolBase({
      initialTokens: 200, tokenPerMatch: 100, matchesToDate: 5,
      bettorResolvedNets: [0, 300, -50],
    });
    expect(base).toBe(2350);
  });

  it("üres tippelő-lista → 0", () => {
    expect(computePoolBase({ initialTokens: 200, tokenPerMatch: 100, matchesToDate: 5, bettorResolvedNets: [] })).toBe(0);
  });
});

describe("distributeBonusPools", () => {
  it("egyenlően oszt és lefelé kerekít", () => {
    // poolBase=100000, gd 2% = 2000 / 3 találó = 666; ex 3% = 3000 / 2 = 1500
    const r = distributeBonusPools({ poolBase: 100000, goalDiffHitters: 3, exactScoreHitters: 2, goalDiffPct: 2, exactScorePct: 3 });
    expect(r.goalDiffPerHitter).toBe(666);
    expect(r.exactScorePerHitter).toBe(1500);
  });

  it("0 találó → 0 bónusz az adott szinten", () => {
    const r = distributeBonusPools({ poolBase: 100000, goalDiffHitters: 0, exactScoreHitters: 1, goalDiffPct: 2, exactScorePct: 3 });
    expect(r.goalDiffPerHitter).toBe(0);
    expect(r.exactScorePerHitter).toBe(3000);
  });

  it("negatív poolBase → 0 (guard)", () => {
    const r = distributeBonusPools({ poolBase: -500, goalDiffHitters: 2, exactScoreHitters: 1, goalDiffPct: 2, exactScorePct: 3 });
    expect(r.goalDiffPerHitter).toBe(0);
    expect(r.exactScorePerHitter).toBe(0);
  });
});
```

- [ ] **Step 2: Tesztek futtatása — FAIL**

Run: `npm run test -- src/lib/scoring.test.ts`
Expected: FAIL (`calculateBaseBetPayout is not a function` stb.)

- [ ] **Step 3: Implementáció**

`src/lib/scoring.ts` — a `get1X2` és `partialRefund` marad. Cseréld le a `BetPayoutInput`/`BetPayoutResult`/`calculateBetPayout` blokkot (NE töröld még a régi `calculateBetPayout`-ot, amíg a sync nem áll át — de az újakat vedd fel):

```ts
export interface BaseBetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  oddsBoost: number;
  lossPercentage: number;
}

export interface BaseBetPayoutResult {
  basePayout: number;
  result1x2Correct: boolean;
  goalDiffCorrect: boolean;
  exactScoreCorrect: boolean;
}

/**
 * Tippenkénti pure alap-payout (bónusz NÉLKÜL) + a három találat-flag.
 * A dinamikus bónusz a meccs összes találójától függ, ezért külön fázisban
 * (distributeBonusPools) adódik hozzá a scoreMatch-ben.
 */
export function calculateBaseBetPayout(input: BaseBetPayoutInput): BaseBetPayoutResult {
  const { predictedHome, predictedAway, actualHome, actualAway, stake, oddsAtBet, oddsBoost, lossPercentage } = input;

  if (oddsAtBet === null) {
    return { basePayout: partialRefund(stake, lossPercentage), result1x2Correct: false, goalDiffCorrect: false, exactScoreCorrect: false };
  }

  const result1x2Correct = get1X2(predictedHome, predictedAway) === get1X2(actualHome, actualAway);
  if (!result1x2Correct) {
    return { basePayout: partialRefund(stake, lossPercentage), result1x2Correct: false, goalDiffCorrect: false, exactScoreCorrect: false };
  }

  const goalDiffCorrect = predictedHome - predictedAway === actualHome - actualAway;
  const exactScoreCorrect = predictedHome === actualHome && predictedAway === actualAway;
  const basePayout = Math.round(stake * oddsAtBet * oddsBoost);
  return { basePayout, result1x2Correct, goalDiffCorrect, exactScoreCorrect };
}

/**
 * A meccs aktív tippelőinek összes lifetime budgetje (a "játékban lévő tokenek"):
 * fejenként initialTokens + tokenPerMatch × addigi meccsek + rendezett tét-nettók.
 */
export function computePoolBase(input: {
  initialTokens: number;
  tokenPerMatch: number;
  matchesToDate: number;
  bettorResolvedNets: number[];
}): number {
  const { initialTokens, tokenPerMatch, matchesToDate, bettorResolvedNets } = input;
  const perBettorFloor = initialTokens + tokenPerMatch * matchesToDate;
  return bettorResolvedNets.reduce((sum, net) => sum + perBettorFloor + net, 0);
}

/**
 * A pool a bázis P%-a, egyenlően szétosztva a találók között (lefelé kerekítve).
 * A gólkülönbség- és pontos-eredmény-pool külön és halmozható.
 */
export function distributeBonusPools(input: {
  poolBase: number;
  goalDiffHitters: number;
  exactScoreHitters: number;
  goalDiffPct: number;
  exactScorePct: number;
}): { goalDiffPerHitter: number; exactScorePerHitter: number } {
  const pool = Math.max(0, input.poolBase);
  const goalDiffPerHitter = input.goalDiffHitters > 0 ? Math.floor((pool * input.goalDiffPct) / 100 / input.goalDiffHitters) : 0;
  const exactScorePerHitter = input.exactScoreHitters > 0 ? Math.floor((pool * input.exactScorePct) / 100 / input.exactScoreHitters) : 0;
  return { goalDiffPerHitter, exactScorePerHitter };
}
```

- [ ] **Step 4: Tesztek futtatása — PASS**

Run: `npm run test -- src/lib/scoring.test.ts`
Expected: PASS (minden teszt zöld)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): pure alap-payout + pool-alap + bónusz-szétosztó függvények"
```

---

### Task 2: Séma — pct oszlopok hozzáadása (expand)

**Files:**
- Modify: `src/db/schema.ts:149-150`
- Create: `drizzle/0022_*.sql` (generált)

**Interfaces:**
- Produces: `groups.bonusGoalDiffPct` (real, default 2), `groups.bonusExactScorePct` (real, default 3). A régi `bonusGoalDiff`/`bonusExactScore` oszlopok EGYELŐRE maradnak (drop külön taskban, deploy után).

- [ ] **Step 1: Schema szerkesztés** — `src/db/schema.ts`, a `bonusGoalDiff`/`bonusExactScore` sorok ALÁ (a régieket ne töröld most):

```ts
    bonusGoalDiff: integer("bonus_goal_diff").default(5).notNull(),
    bonusExactScore: integer("bonus_exact_score").default(10).notNull(),
    bonusGoalDiffPct: real("bonus_goal_diff_pct").default(2).notNull(),
    bonusExactScorePct: real("bonus_exact_score_pct").default(3).notNull(),
```

(A `real` már importált — az `oddsBoost` is azt használja.)

- [ ] **Step 2: Migráció generálás**

Run: `npm run db:generate`
Expected: új `drizzle/0022_*.sql` két `ADD COLUMN`-nal (pct oszlopok, default 2/3).

- [ ] **Step 3: Migráció dev-en**

Run: `npm run db:migrate`
Expected: sikeres (exit 0), az oszlopok felkerülnek a dev branchre.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): bonus_goal_diff_pct / bonus_exact_score_pct oszlopok (expand)"
```

---

### Task 3: `scoreMatch` átállítása pool-alapú bónuszra (`sync.ts`)

**Files:**
- Modify: `src/lib/sync.ts` (import + `scoreMatch`, ~441-500)
- Modify: `src/lib/scoring.ts` (a régi `calculateBetPayout` törlése)

**Interfaces:**
- Consumes: `calculateBaseBetPayout`, `computePoolBase`, `distributeBonusPools` (Task 1); `dateToDateNum` (`@/lib/tokens`).

- [ ] **Step 1: Importok** — `src/lib/sync.ts` tetején cseréld:

```ts
import { calculateBaseBetPayout, computePoolBase, distributeBonusPools } from "@/lib/scoring";
import { dateToDateNum, getRelevantOdds } from "@/lib/tokens";
```

- [ ] **Step 2: Új `scoreMatch`** — cseréld a teljes `scoreMatch` függvényt:

```ts
async function scoreMatch(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  const pendingBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), isNull(bets.payout)),
    with: { group: true },
  });

  if (pendingBets.length > 0) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: { tournament: true },
    });
    if (match) {
      const timeZone = match.tournament.timezone;
      const matchDateNum = dateToDateNum(match.scheduledAt, timeZone);
      const tournamentMatches = await db.query.matches.findMany({
        where: eq(matches.tournamentId, match.tournamentId),
        columns: { scheduledAt: true, status: true },
      });
      const matchesToDate = tournamentMatches.filter(
        (m) => m.status !== "cancelled" && dateToDateNum(m.scheduledAt, timeZone) <= matchDateNum,
      ).length;

      // Pending tippek csoportonként — a token/pool csoport-szintű.
      const byGroup = new Map<string, typeof pendingBets>();
      for (const bet of pendingBets) {
        const arr = byGroup.get(bet.groupId);
        if (arr) arr.push(bet);
        else byGroup.set(bet.groupId, [bet]);
      }

      for (const [groupId, groupBets] of byGroup) {
        const group = groupBets[0].group;

        const baseResults = groupBets.map((bet) => ({
          bet,
          base: calculateBaseBetPayout({
            predictedHome: bet.predictedHome,
            predictedAway: bet.predictedAway,
            actualHome: homeScore,
            actualAway: awayScore,
            stake: bet.stake,
            oddsAtBet: bet.oddsAtBet ? Number.parseFloat(bet.oddsAtBet) : null,
            oddsBoost: group.oddsBoost,
            lossPercentage: group.lossPercentage,
          }),
        }));

        const goalDiffHitters = baseResults.filter((r) => r.base.goalDiffCorrect).length;
        const exactScoreHitters = baseResults.filter((r) => r.base.exactScoreCorrect).length;

        const bettorIds = [...new Set(groupBets.map((b) => b.userId))];
        const netsByUser = await getBettorResolvedNets(groupId, bettorIds, timeZone, matchDateNum);
        const poolBase = computePoolBase({
          initialTokens: group.initialTokens,
          tokenPerMatch: group.tokenPerMatch,
          matchesToDate,
          bettorResolvedNets: bettorIds.map((id) => netsByUser.get(id) ?? 0),
        });

        const { goalDiffPerHitter, exactScorePerHitter } = distributeBonusPools({
          poolBase,
          goalDiffHitters,
          exactScoreHitters,
          goalDiffPct: group.bonusGoalDiffPct,
          exactScorePct: group.bonusExactScorePct,
        });

        for (const { bet, base } of baseResults) {
          const payout =
            base.basePayout +
            (base.goalDiffCorrect ? goalDiffPerHitter : 0) +
            (base.exactScoreCorrect ? exactScorePerHitter : 0);

          // Atomikus claim: csak az a futás írhat `win` sort, amelyik a payout-ot
          // NULL-ról billenti át. Párhuzamos scoreMatch-ek közül pontosan egy nyer.
          const claimed = await db
            .update(bets)
            .set({
              payout,
              result1x2Correct: base.result1x2Correct,
              goalDiffCorrect: base.goalDiffCorrect,
              exactScoreCorrect: base.exactScoreCorrect,
              updatedAt: new Date(),
            })
            .where(and(eq(bets.id, bet.id), isNull(bets.payout)))
            .returning({ id: bets.id });

          if (claimed.length === 0) continue;

          if (payout > 0) {
            await db.insert(tokenLedger).values({
              userId: bet.userId,
              groupId: bet.groupId,
              tournamentId: group.tournamentId,
              amount: payout,
              type: "win",
              referenceId: bet.id,
            });
          }
        }
      }
    }
  }
  await evaluateMatchBadges(matchId);
}

/**
 * Tippelőnként a rendezett tét-nettók (payout − stake) összege az M-nél KORÁBBI
 * dátumú, már lepontozott tippjeikből ebben a csoportban. Dátum-alapú (nem M
 * saját állapotától függ) → a pool-alap idempotens újrapontozásra is.
 */
async function getBettorResolvedNets(
  groupId: string,
  bettorIds: string[],
  timeZone: string,
  matchDateNum: number,
): Promise<Map<string, number>> {
  const nets = new Map<string, number>();
  if (bettorIds.length === 0) return nets;

  const resolved = await db.query.bets.findMany({
    where: and(eq(bets.groupId, groupId), inArray(bets.userId, bettorIds), isNotNull(bets.payout)),
    columns: { userId: true, stake: true, payout: true },
    with: { match: { columns: { scheduledAt: true } } },
  });

  for (const b of resolved) {
    if (b.payout == null) continue;
    if (dateToDateNum(b.match.scheduledAt, timeZone) >= matchDateNum) continue;
    nets.set(b.userId, (nets.get(b.userId) ?? 0) + (b.payout - b.stake));
  }
  return nets;
}
```

- [ ] **Step 3: Régi `calculateBetPayout` törlése** — `src/lib/scoring.ts`-ből töröld a `BetPayoutInput`, `BetPayoutResult` interfészeket és a `calculateBetPayout` függvényt (Task 1 után már csak a sync használta).

- [ ] **Step 4: `bets.match` reláció ellenőrzése** — a `getBettorResolvedNets` a `with: { match: ... }`-et használ. Ellenőrizd, hogy a `betsRelations` tartalmaz `match`-et:

Run: `grep -n "match:" src/db/schema.ts`
Ha a `betsRelations`-ben nincs `match: one(matches ...)`, add hozzá a meglévő `group`/`user` relációk mintájára. (Valószínűleg már megvan.)

- [ ] **Step 5: Typecheck + teljes teszt + build**

Run: `npm run check && npm run test && npm run build`
Expected: nincs TS hiba, tesztek zöldek, build sikeres.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync.ts src/lib/scoring.ts
git commit -m "feat(scoring): scoreMatch pool-alapú dinamikus bónusz, csoportonként"
```

---

### Task 4: Szabály-megjelenítés — pct (`group-rules.ts`)

**Files:**
- Modify: `src/lib/group-rules.ts` (`GroupRules` típus + `buildRuleSections`)
- Test: `src/lib/group-rules.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `GroupRules.bonusGoalDiffPct: number`, `GroupRules.bonusExactScorePct: number` (a `bonusGoalDiff`/`bonusExactScore` mezők helyett).

- [ ] **Step 1: Teszt frissítés** — `src/lib/group-rules.test.ts`:
  - a `base` objektumban `bonusGoalDiff: 30` → `bonusGoalDiffPct: 2`, `bonusExactScore: 50` → `bonusExactScorePct: 3`.
  - az assert: `expect(findRow(sections, "bonusGoalDiff")?.value).toBe("+30")` → `.toBe("2%")`; és add hozzá `expect(findRow(sections, "bonusExactScore")?.value).toBe("3%")`.

- [ ] **Step 2: Teszt — FAIL**

Run: `npm run test -- src/lib/group-rules.test.ts`
Expected: FAIL (a típus és a formázás még a régi).

- [ ] **Step 3: Implementáció** — `src/lib/group-rules.ts`:
  - a `GroupRules` interfészben `bonusGoalDiff: number;` → `bonusGoalDiffPct: number;`, `bonusExactScore: number;` → `bonusExactScorePct: number;`.
  - `buildRuleSections`-ben:

```ts
  if (rules.bonusGoalDiffPct > 0) {
    scoringRows.push({ labelKey: "bonusGoalDiff", value: `${rules.bonusGoalDiffPct}%` });
  }
  if (rules.bonusExactScorePct > 0) {
    scoringRows.push({ labelKey: "bonusExactScore", value: `${rules.bonusExactScorePct}%` });
  }
```

- [ ] **Step 4: Teszt — PASS**

Run: `npm run test -- src/lib/group-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-rules.ts src/lib/group-rules.test.ts
git commit -m "feat(group-rules): gólkülönbség/pontos eredmény bónusz %-ban"
```

---

### Task 5: Actions, seed és UI komponensek átállítása pct-re

**Files:**
- Modify: `src/actions/groups.ts` (`CreateGroupInput`, `createGroup`, `GroupSettings`, `updateGroupSettings`)
- Modify: `src/lib/official-group.ts:68-69`
- Modify: `src/components/group-detail-tabs.tsx` (settings input-ok)
- Modify: `src/components/create-group-form.tsx`
- Modify: `src/components/tournament-tabs.tsx` (típusok)
- Modify: `src/components/public-groups-section.tsx` (típusok)
- Modify: `src/components/public-group-dialog.tsx` (típus + megjelenítés)
- Modify: `src/queries/groups.ts` (típus/komment)

**Interfaces:**
- Consumes: `groups.bonusGoalDiffPct/bonusExactScorePct` (Task 2), `GroupRules` (Task 4).

- [ ] **Step 1: `src/actions/groups.ts`** — a `CreateGroupInput` és `GroupSettings` interfészekben, valamint a `createGroup` spread-ekben cseréld:
  - `bonusGoalDiff?: number;` → `bonusGoalDiffPct?: number;`
  - `bonusExactScore?: number;` → `bonusExactScorePct?: number;`
  - `createGroup`: `...(input.bonusGoalDiff != null && { bonusGoalDiff: input.bonusGoalDiff }),` → `...(input.bonusGoalDiffPct != null && { bonusGoalDiffPct: input.bonusGoalDiffPct }),` (és ugyanígy exact). A `updateGroupSettings` a `gameSettings`-et közvetlenül spreadeli, így logika-változás nem kell, csak a mezőnevek.

- [ ] **Step 2: `src/lib/official-group.ts`** — sor 68-69:

```ts
      bonusGoalDiffPct: 2,
      bonusExactScorePct: 3,
```

- [ ] **Step 3: `src/components/group-detail-tabs.tsx`** — a két bónusz `NumericInput` blokk (301-319):

```tsx
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("bonusGoalDiff")}
                      </Label>
                      <NumericInput
                        value={settings.bonusGoalDiffPct}
                        onChange={(val) => setSettings({ ...settings, bonusGoalDiffPct: val })}
                        min={0}
                        className="font-mono"
                      />
```

és ugyanígy `bonusExactScore` → `settings.bonusExactScorePct` / `bonusExactScorePct: val`. (A `GroupSettings = GroupRules` típus a Task 4-gyel már a pct mezőket tartalmazza.)

- [ ] **Step 4: `create-group-form.tsx`** — keresd meg a `bonusGoalDiff`/`bonusExactScore` hivatkozásokat és cseréld pct-re (mezőnév + state kulcs + default érték, ha van: 2 / 3).

Run: `grep -n "bonusGoalDiff\|bonusExactScore" src/components/create-group-form.tsx`

- [ ] **Step 5: `tournament-tabs.tsx`, `public-groups-section.tsx`, `public-group-dialog.tsx`, `queries/groups.ts`** — cseréld a `bonusGoalDiff: number` / `bonusExactScore: number` típusmezőket és minden hivatkozást a pct-változatra. A `public-group-dialog.tsx` megjelenítésénél a `value={... bonusGoalDiff}` → `${... bonusGoalDiffPct}%` (a `group-rules` mintájára `%`-kal).

Run minden fájlra: `grep -n "bonusGoalDiff\|bonusExactScore" src/components/tournament-tabs.tsx src/components/public-groups-section.tsx src/components/public-group-dialog.tsx src/queries/groups.ts`

- [ ] **Step 6: Typecheck** — minden hivatkozás átállt:

Run: `npm run check`
Expected: 0 hiba. Ha marad `bonusGoalDiff`/`bonusExactScore` (nem-pct) hivatkozás, a TS jelzi — javítsd.

Ellenőrző kereső:
Run: `grep -rn "bonusGoalDiff\b\|bonusExactScore\b" src --include="*.ts" --include="*.tsx" | grep -v Pct`
Expected: üres (a `bonusGoalDiff`/`bonusExactScore` **labelKey**-k a `group-rules.ts`-ben és az i18n kulcsokban maradhatnak — azok stringek, nem mezők; a fenti grep csak azonosítókra fut).

- [ ] **Step 7: Commit**

```bash
git add src/actions/groups.ts src/lib/official-group.ts src/components/ src/queries/groups.ts
git commit -m "feat(groups): actions/seed/UI átállítása %-alapú bónuszra"
```

---

### Task 6: i18n szövegek

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

**Interfaces:** —

- [ ] **Step 1: hu.json** — a `groups` névtérben:
  - `"bonusGoalDiff": "Gólkülönbség bónusz"` → `"bonusGoalDiff": "Gólkülönbség bónusz (a kör vagyonának %-a)"`
  - `"bonusExactScore": "Pontos eredmény bónusz"` → `"bonusExactScore": "Pontos eredmény bónusz (a kör vagyonának %-a)"`
  - A `howToPlayScoringDesc` végét egészítsd ki, hogy a bónusz a meccsre tippelők tokenállományából, dinamikusan számolódik (ékezetesen).

- [ ] **Step 2: en.json** — ugyanezek angolul:
  - `"bonusGoalDiff": "Goal difference bonus (% of circle's tokens)"`
  - `"bonusExactScore": "Exact score bonus (% of circle's tokens)"`
  - `howToPlayScoringDesc` megfelelő kiegészítése.

- [ ] **Step 3: Ellenőrzés + build**

Run: `npm run check && npm run build`
Expected: sikeres (a next-intl kulcsok megvannak mindkét nyelven).

- [ ] **Step 4: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "i18n: dinamikus %-alapú bónusz szövegek (hu/en)"
```

---

### Task 7: Teljes verifikáció

**Files:** —

- [ ] **Step 1: Lint + teszt + build együtt**

Run: `npm run check && npm run test && npm run build`
Expected: mind zöld.

- [ ] **Step 2: Scoring smoke a dev branchen (opcionális, ha van dev adat)** — futtass egy read-only ellenőrzést, hogy a `groups` táblán léteznek a pct oszlopok default 2/3-mal:

Run:
```bash
node -e "const {neon}=require('@neondatabase/serverless');const u=require('fs').readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/[\"']/g,'');neon(u)\`SELECT bonus_goal_diff_pct, bonus_exact_score_pct FROM groups LIMIT 3\`.then(r=>{console.log(r);process.exit(0)})"
```
Expected: sorok `2`/`3` (vagy csoport-specifikus) értékekkel.

---

### Task 8: Deploy — prod migráció + push

**Files:** —

> **FONTOS (irreverzibilis, éles):** a prod migráció (0022) csak oszlopot AD HOZZÁ (default 2/3), a régi oszlopokat NEM bántja → a jelenleg élő (régi) kód sértetlen marad. Ezért biztonságos a kód-deploy ELŐTT lefuttatni.

- [ ] **Step 1: Prod migráció (0022 add-columns)**

Run:
```bash
DATABASE_URL="$(grep -E '^PROD_DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"'"'"'')" npm run db:migrate
```
Expected: exit 0; a prod `groups` táblán megjelenik a két pct oszlop default 2/3-mal.

- [ ] **Step 2: Merge main + push (Vercel prod deploy)**

```bash
git checkout main && git merge --no-ff <feature-branch> -m "feat: dinamikus %-alapú gólkülönbség/pontos eredmény bónusz"
git push origin main
```
(Ha végig main-en dolgoztál, csak `git push origin main`.)

- [ ] **Step 3: Deploy verifikáció** — a Vercel build zöld, a prod betölt:
  - Nyisd meg a csoport szabály-modalt → a bónusz `2%` / `3%` formában látszik.
  - Ellenőrizd a Vercel runtime logot hibára (nincs `bonus_goal_diff_pct`/oszlop-hiba).

---

### Task 9: Cleanup — régi oszlopok eldobása (deploy után)

> Csak akkor, ha a Task 8 deploy egészséges (az új kód már NEM olvassa a régi oszlopokat).

**Files:**
- Modify: `src/db/schema.ts` (régi `bonusGoalDiff`/`bonusExactScore` oszlopok törlése)
- Create: `drizzle/0023_*.sql`

- [ ] **Step 1: Schema — töröld** a `bonusGoalDiff` és `bonusExactScore` oszlop-definíciókat a `groups` táblából.

- [ ] **Step 2: Generálás**

Run: `npm run db:generate`
Expected: `drizzle/0023_*.sql` két `DROP COLUMN`-nal.

- [ ] **Step 3: Migráció dev + prod**

Run: `npm run db:migrate`
Run: `DATABASE_URL="$(grep -E '^PROD_DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"'"'"'')" npm run db:migrate`
Expected: mindkettő exit 0.

- [ ] **Step 4: Build + commit + push**

```bash
npm run check && npm run build
git add src/db/schema.ts drizzle/
git commit -m "chore(db): régi fix bonus oszlopok eldobása (contract)"
git push origin main
```

---

## Self-Review

**Spec-lefedettség:**
- Adatmodell (pct oszlopok, dobogó érintetlen) → Task 2 (+ Task 9 drop).
- Két fázisú pontozás (pure fv-ek) → Task 1.
- Pool-alap definíció (lifetime budget, idempotens) → Task 1 (`computePoolBase`) + Task 3 (`getBettorResolvedNets`, dátum-alapú).
- Kerekítés/edge case-ek → Task 1 (`distributeBonusPools`, guard, 0 találó).
- Migráció + mid-VB (régi bónusz marad) → Task 8 (add-only, deploy után drop); a `payout IS NULL` szűrő a meglévő `scoreMatch`-ből megmarad.
- Klasszikus pontozás érintetlen → `classicPointsFromFlags` marad (Task 1 nem nyúl hozzá).
- UI/i18n → Task 4, 5, 6.
- Tesztek → Task 1, 4 (+ Task 3/7 build+suite).

**Placeholder-scan:** nincs TBD/„handle edge cases" — minden lépésnél konkrét kód vagy pontos `grep`/parancs.

**Típus-konzisztencia:** `bonusGoalDiffPct`/`bonusExactScorePct` végig egységes; `calculateBaseBetPayout`/`computePoolBase`/`distributeBonusPools` szignatúrái Task 1-ben definiáltak, Task 3-ban azonosan hívva.
