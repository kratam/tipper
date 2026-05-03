# Match Schedule Override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when api-sports.io returns placeholder dates (all matches on one day), and use manually-populated fallback dates instead.

**Architecture:** New `match_schedule_overrides` table stores correct dates per match. A `useScheduleOverrides` flag on `tournaments` controls whether the cron sync applies overrides. Detection is automatic: >80% matches on same day → enable; ≥90% API dates match overrides ±2h → disable. The sync writes the effective date directly to `matches.scheduledAt`, so no downstream changes needed.

**Tech Stack:** Drizzle ORM, Neon Postgres, Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-schedule-override-design.md`

---

### Task 1: DB schema — add `matchScheduleOverrides` table and `useScheduleOverrides` flag

**Files:**
- Modify: `src/db/schema.ts:43-55` (tournaments table) and append new table + relations
- Create: `drizzle/0003_schedule_overrides.sql`

- [ ] **Step 1: Add `useScheduleOverrides` to `tournaments` table in schema**

In `src/db/schema.ts`, add a new column to the `tournaments` table definition, after `bronzeTeamId`:

```typescript
useScheduleOverrides: boolean("use_schedule_overrides").default(false).notNull(),
```

- [ ] **Step 2: Add `matchScheduleOverrides` table to schema**

Append after the `tokenLedger` table definition (before the `// Relations` comment):

```typescript
export const matchScheduleOverrides = pgTable("match_schedule_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .unique()
    .notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Add relations for `matchScheduleOverrides`**

Append after the existing `betsRelations`:

```typescript
export const matchScheduleOverridesRelations = relations(matchScheduleOverrides, ({ one }) => ({
  match: one(matches, {
    fields: [matchScheduleOverrides.matchId],
    references: [matches.id],
  }),
}));
```

- [ ] **Step 4: Write the SQL migration file**

Create `drizzle/0003_schedule_overrides.sql`:

```sql
-- Schedule override: fallback dates for tournaments with placeholder API schedules
ALTER TABLE "tournaments" ADD COLUMN "use_schedule_overrides" boolean DEFAULT false NOT NULL;

CREATE TABLE "match_schedule_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  "scheduled_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "match_schedule_overrides_match_id_unique" UNIQUE("match_id")
);
```

- [ ] **Step 5: Run migration against the database**

```bash
npx drizzle-kit migrate
```

Expected: Migration applied successfully. Verify in Neon console that `match_schedule_overrides` table exists and `tournaments.use_schedule_overrides` column is present.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/0003_schedule_overrides.sql
git commit -m "feat: add match_schedule_overrides table and useScheduleOverrides flag"
```

---

### Task 2: Pure detection functions (TDD)

**Files:**
- Create: `src/lib/schedule-override.ts`
- Create: `tests/lib/schedule-override.test.ts`

These are pure functions with no DB dependency — easy to test.

- [ ] **Step 1: Write failing tests for `isScheduleBroken`**

Create `tests/lib/schedule-override.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { isScheduleBroken, hasApiScheduleImproved } from "@/lib/schedule-override";

describe("isScheduleBroken", () => {
  it("returns true when >80% of dates fall on the same day", () => {
    // 10 matches, all on 2026-05-15
    const dates = Array.from({ length: 10 }, () => new Date("2026-05-15T16:00:00Z"));
    expect(isScheduleBroken(dates)).toBe(true);
  });

  it("returns true when exactly 81% are on the same day", () => {
    const sameDayDates = Array.from({ length: 9 }, () => new Date("2026-05-15T16:00:00Z"));
    const otherDate = new Date("2026-05-16T16:00:00Z");
    // 9/11 = 81.8%
    const dates = [...sameDayDates, otherDate, new Date("2026-05-17T16:00:00Z")];
    expect(isScheduleBroken(dates)).toBe(true);
  });

  it("returns false when dates are spread across multiple days", () => {
    const dates = [
      new Date("2026-05-15T16:00:00Z"),
      new Date("2026-05-15T20:00:00Z"),
      new Date("2026-05-16T16:00:00Z"),
      new Date("2026-05-16T20:00:00Z"),
      new Date("2026-05-17T16:00:00Z"),
    ];
    // 2/5 = 40% max on one day
    expect(isScheduleBroken(dates)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isScheduleBroken([])).toBe(false);
  });

  it("returns false for single match", () => {
    expect(isScheduleBroken([new Date("2026-05-15T16:00:00Z")])).toBe(false);
  });

  it("groups by UTC date correctly across midnight", () => {
    // Same UTC day despite different times
    const dates = Array.from({ length: 10 }, (_, i) =>
      new Date(`2026-05-15T${String(i + 10).padStart(2, "0")}:00:00Z`),
    );
    expect(isScheduleBroken(dates)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/schedule-override.test.ts
```

Expected: FAIL — `isScheduleBroken` not found.

- [ ] **Step 3: Implement `isScheduleBroken`**

Create `src/lib/schedule-override.ts`:

```typescript
/**
 * Returns true if >80% of the provided dates fall on the same UTC day.
 * This indicates the API is returning placeholder dates.
 * Requires at least 2 dates to trigger (single match or empty is never "broken").
 */
export function isScheduleBroken(dates: Date[]): boolean {
  if (dates.length < 2) return false;

  const dayCounts = new Map<string, number>();
  for (const d of dates) {
    const key = d.toISOString().split("T")[0];
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(...dayCounts.values());
  return maxCount / dates.length > 0.8;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/schedule-override.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Write failing tests for `hasApiScheduleImproved`**

Append to `tests/lib/schedule-override.test.ts`:

```typescript
describe("hasApiScheduleImproved", () => {
  it("returns true when >=90% of API dates match overrides within 2h", () => {
    const pairs = [
      { apiDate: new Date("2026-05-15T14:00:00Z"), overrideDate: new Date("2026-05-15T15:00:00Z") },
      { apiDate: new Date("2026-05-16T14:00:00Z"), overrideDate: new Date("2026-05-16T14:30:00Z") },
      { apiDate: new Date("2026-05-17T14:00:00Z"), overrideDate: new Date("2026-05-17T14:00:00Z") },
      { apiDate: new Date("2026-05-18T14:00:00Z"), overrideDate: new Date("2026-05-18T13:00:00Z") },
      { apiDate: new Date("2026-05-19T14:00:00Z"), overrideDate: new Date("2026-05-19T15:30:00Z") },
      { apiDate: new Date("2026-05-20T14:00:00Z"), overrideDate: new Date("2026-05-20T14:00:00Z") },
      { apiDate: new Date("2026-05-21T14:00:00Z"), overrideDate: new Date("2026-05-21T14:00:00Z") },
      { apiDate: new Date("2026-05-22T14:00:00Z"), overrideDate: new Date("2026-05-22T14:00:00Z") },
      { apiDate: new Date("2026-05-23T14:00:00Z"), overrideDate: new Date("2026-05-23T14:00:00Z") },
      { apiDate: new Date("2026-05-24T14:00:00Z"), overrideDate: new Date("2026-05-24T14:00:00Z") },
    ];
    // 10/10 match within 2h → 100%
    expect(hasApiScheduleImproved(pairs)).toBe(true);
  });

  it("returns false when API still has placeholder dates", () => {
    const pairs = [
      { apiDate: new Date("2026-05-15T00:00:00Z"), overrideDate: new Date("2026-05-15T16:00:00Z") },
      { apiDate: new Date("2026-05-15T00:00:00Z"), overrideDate: new Date("2026-05-16T16:00:00Z") },
      { apiDate: new Date("2026-05-15T00:00:00Z"), overrideDate: new Date("2026-05-17T16:00:00Z") },
      { apiDate: new Date("2026-05-15T00:00:00Z"), overrideDate: new Date("2026-05-18T16:00:00Z") },
      { apiDate: new Date("2026-05-15T00:00:00Z"), overrideDate: new Date("2026-05-19T16:00:00Z") },
    ];
    // 0/5 match (all API dates are the same placeholder) → 0%
    expect(hasApiScheduleImproved(pairs)).toBe(false);
  });

  it("returns true at exactly 90% threshold", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => ({
      apiDate: new Date(`2026-05-${String(15 + i).padStart(2, "0")}T14:00:00Z`),
      overrideDate: new Date(`2026-05-${String(15 + i).padStart(2, "0")}T14:00:00Z`),
    }));
    // Make 1 out of 10 not match (>2h diff)
    pairs[0].apiDate = new Date("2026-05-15T00:00:00Z");
    pairs[0].overrideDate = new Date("2026-05-15T16:00:00Z");
    // 9/10 = 90%
    expect(hasApiScheduleImproved(pairs)).toBe(true);
  });

  it("returns false at 89%", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => ({
      apiDate: new Date(`2026-05-${String(15 + i).padStart(2, "0")}T14:00:00Z`),
      overrideDate: new Date(`2026-05-${String(15 + i).padStart(2, "0")}T14:00:00Z`),
    }));
    // Make 2 out of 10 not match
    pairs[0].apiDate = new Date("2026-05-15T00:00:00Z");
    pairs[0].overrideDate = new Date("2026-05-15T16:00:00Z");
    pairs[1].apiDate = new Date("2026-05-16T00:00:00Z");
    pairs[1].overrideDate = new Date("2026-05-16T16:00:00Z");
    // 8/10 = 80%
    expect(hasApiScheduleImproved(pairs)).toBe(false);
  });

  it("handles exactly ±2h boundary as matching", () => {
    const pairs = [
      { apiDate: new Date("2026-05-15T14:00:00Z"), overrideDate: new Date("2026-05-15T16:00:00Z") },
    ];
    // Exactly 2h difference → should count as match
    expect(hasApiScheduleImproved(pairs)).toBe(true);
  });

  it("handles >2h as not matching", () => {
    const pairs = [
      { apiDate: new Date("2026-05-15T14:00:00Z"), overrideDate: new Date("2026-05-15T16:00:01Z") },
    ];
    // 2h + 1s → not a match, 0/1 = 0%
    expect(hasApiScheduleImproved(pairs)).toBe(false);
  });

  it("returns false for empty pairs", () => {
    expect(hasApiScheduleImproved([])).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run tests/lib/schedule-override.test.ts
```

Expected: FAIL — `hasApiScheduleImproved` not found.

- [ ] **Step 7: Implement `hasApiScheduleImproved`**

Append to `src/lib/schedule-override.ts`:

```typescript
interface DatePair {
  apiDate: Date;
  overrideDate: Date;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Returns true if >=90% of API dates match their override dates within ±2 hours.
 * This indicates the API has been updated with real schedule data.
 */
export function hasApiScheduleImproved(pairs: DatePair[]): boolean {
  if (pairs.length === 0) return false;

  const matchingCount = pairs.filter(
    ({ apiDate, overrideDate }) =>
      Math.abs(apiDate.getTime() - overrideDate.getTime()) <= TWO_HOURS_MS,
  ).length;

  return matchingCount / pairs.length >= 0.9;
}
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
npx vitest run tests/lib/schedule-override.test.ts
```

Expected: All 13 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/schedule-override.ts tests/lib/schedule-override.test.ts
git commit -m "feat: add pure schedule override detection functions with tests"
```

---

### Task 3: Sync — update existing matches' `scheduledAt` on every sync

**Files:**
- Modify: `src/app/api/cron/sync/route.ts:129-148` (existing match update block)

Currently the sync only updates `status`, `homeScore`, `awayScore`, `updatedAt` for existing matches. We need to also update `scheduledAt` and `round` so that when overrides are disabled, the API dates take effect.

- [ ] **Step 1: Add `scheduledAt` and `round` to the existing match update**

In `src/app/api/cron/sync/route.ts`, find the existing match update block (around line 133-141) and add the two fields:

```typescript
      await db
        .update(matches)
        .set({
          status: newStatus,
          homeScore: newStatus === "finished" ? regulationScore.home : game.scores.home,
          awayScore: newStatus === "finished" ? regulationScore.away : game.scores.away,
          scheduledAt: new Date(game.date),
          round: new Date(game.date).toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existingMatch.id));
```

- [ ] **Step 2: Verify build passes**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds (or at least no type errors in the modified file).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "fix: update scheduledAt and round for existing matches during sync"
```

---

### Task 4: Sync — schedule override detection and application

**Files:**
- Modify: `src/app/api/cron/sync/route.ts` (add new imports and `handleScheduleOverrides` function, call it from `syncTournament`)

- [ ] **Step 1: Add imports at the top of the sync route**

In `src/app/api/cron/sync/route.ts`, update imports:

Add `matchScheduleOverrides` and `tournaments` to the schema import (line 4):

```typescript
import { bets, groups, matches, matchOdds, matchScheduleOverrides, teams, tokenLedger, tournaments } from "@/db/schema";
```

Add the pure detection functions:

```typescript
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";
```

- [ ] **Step 2: Write the `handleScheduleOverrides` function**

Add this function before `distributeTokensForTournament` (around line 283):

```typescript
/**
 * Detect broken schedules and apply overrides.
 *
 * Flow:
 * 1. Check if overrides exist for this tournament
 * 2. If flag is off: detect broken schedule (>80% on same day) → turn on
 * 3. If flag is on: detect API improvement (≥90% match ±2h) → turn off
 * 4. If flag is on: overwrite matches.scheduledAt + round from overrides
 *
 * @param tournament - must include id and useScheduleOverrides
 * @param apiGameDates - map of apiGameId → API date string, from the just-fetched games
 */
async function handleScheduleOverrides(
  tournament: { id: string; useScheduleOverrides: boolean },
  apiGameDates: Map<number, string>,
): Promise<void> {
  // 1. Load overrides for this tournament's matches
  const overrides = await db
    .select({
      matchId: matchScheduleOverrides.matchId,
      overrideScheduledAt: matchScheduleOverrides.scheduledAt,
      apiGameId: matches.apiGameId,
    })
    .from(matchScheduleOverrides)
    .innerJoin(matches, eq(matchScheduleOverrides.matchId, matches.id))
    .where(eq(matches.tournamentId, tournament.id));

  if (overrides.length === 0) return;

  // 2. Load current match dates for detection
  const tournamentMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournament.id),
  });

  let useOverrides = tournament.useScheduleOverrides;

  if (!useOverrides) {
    // Detect broken schedule: >80% on the same day
    const scheduledDates = tournamentMatches
      .filter((m) => m.status === "scheduled")
      .map((m) => m.scheduledAt);

    if (isScheduleBroken(scheduledDates)) {
      useOverrides = true;
      await db
        .update(tournaments)
        .set({ useScheduleOverrides: true })
        .where(eq(tournaments.id, tournament.id));
    }
  } else {
    // Detect API improvement: ≥90% match within ±2h
    const pairs = overrides
      .filter((o) => apiGameDates.has(o.apiGameId))
      .map((o) => ({
        apiDate: new Date(apiGameDates.get(o.apiGameId)!),
        overrideDate: o.overrideScheduledAt,
      }));

    if (pairs.length > 0 && hasApiScheduleImproved(pairs)) {
      useOverrides = false;
      await db
        .update(tournaments)
        .set({ useScheduleOverrides: false })
        .where(eq(tournaments.id, tournament.id));
    }
  }

  // 4. Apply overrides if flag is on
  if (useOverrides) {
    for (const override of overrides) {
      await db
        .update(matches)
        .set({
          scheduledAt: override.overrideScheduledAt,
          round: override.overrideScheduledAt.toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(matches.id, override.matchId));
    }
  }
}
```

- [ ] **Step 3: Update `Tournament` type, collect API game dates, and call `handleScheduleOverrides`**

First, update the `Tournament` type (line 98-102) to include the new field:

```typescript
type Tournament = {
  id: string;
  apiLeagueId: number;
  apiSeason: number;
  useScheduleOverrides: boolean;
};
```

In `syncTournament`, after `const games = await fetchGames(...)` (line 105), add:

```typescript
  const apiGameDates = new Map<number, string>();
```

Inside the `for (const game of games)` loop, right after `const newStatus = ...` (around line 121), add:

```typescript
    apiGameDates.set(game.id, game.date);
```

At the end of `syncTournament`, after the odds sync loop ends (after line 198), add:

```typescript
  // Schedule override detection and application
  await handleScheduleOverrides(
    { id: tournament.id, useScheduleOverrides: tournament.useScheduleOverrides },
    apiGameDates,
  );
```

- [ ] **Step 4: Verify build passes**

```bash
npx next build 2>&1 | tail -10
```

Expected: No type errors. Build succeeds.

- [ ] **Step 5: Run existing tests to check for regressions**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat: add schedule override detection and application to cron sync"
```

---

### Task 5: Biome lint fix + final verification

**Files:**
- Possibly: any files modified above if biome reports issues

- [ ] **Step 1: Run biome check**

```bash
npx biome check --write src/lib/schedule-override.ts src/app/api/cron/sync/route.ts src/db/schema.ts
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (existing + new schedule-override tests).

- [ ] **Step 3: Run build**

```bash
npx next build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit if biome made changes**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: biome formatting fixes"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `match_schedule_overrides` to the DB séma section in CLAUDE.md**

In the "DB séma (10 tábla)" section, update to "11 tábla" and add the new table:

```
users, tournaments, teams, matches, match_odds, groups, group_members, bets, podium_bets, token_ledger, match_schedule_overrides
```

- [ ] **Step 2: Add a note about schedule overrides to the Cron sync logika section**

After item 5 in the cron sync list, add:

```
6. Schedule override: hibás menetrend detektálás (>80% egy napon → override bekapcsolás), API javulás (≥90% egyezés ±2h → kikapcsolás)
```

- [ ] **Step 3: Add `useScheduleOverrides` to the tournaments schema description if needed**

Add a short section after "Token rendszer":

```
## Schedule Override

Ha az API placeholder dátumokat ad (minden meccs egy napra), a `match_schedule_overrides` tábla tartalmazza a valós dátumokat.
- `tournaments.useScheduleOverrides` flag szabályozza az override alkalmazását
- Detektálás automatikus (cron sync-ben), override-ok kézi feltöltéssel (SQL/Neon MCP)
- Az override a `matches.scheduledAt`-ot írja felül közvetlenül
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add schedule override documentation to CLAUDE.md"
```
