# Odds Boost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-group configurable odds multiplier that boosts payouts for active bettors, making inactivity a relative disadvantage.

**Architecture:** New `oddsBoost` field on `groups` table (real, default 1.0). Applied in `calculateBetPayout` as `stake × odds × oddsBoost`. Bonuses (goalDiff, exactScore) are not multiplied. UI: new input in group create/edit forms.

**Tech Stack:** Drizzle ORM (schema + migration), Vitest (tests), Next.js Server Actions, React (forms), next-intl (i18n)

**Spec:** `docs/superpowers/specs/2026-04-04-odds-boost-design.md`

---

### Task 1: Update scoring logic with tests (TDD)

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `tests/lib/scoring.test.ts`

- [ ] **Step 1: Add oddsBoost test cases to scoring.test.ts**

Add these tests inside the existing `describe("calculateBetPayout", ...)` block, after the last existing test:

```typescript
it("applies oddsBoost to payout", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 2,
    actualAway: 0,
    stake: 100,
    oddsAtBet: 2.0,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.5 },
  });
  expect(result.payout).toBe(305); // round(100 * 2.0 * 1.5) + 5 (goalDiff)
});

it("oddsBoost 1.0 does not change payout", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 2,
    actualAway: 0,
    stake: 50,
    oddsAtBet: 2.5,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0 },
  });
  expect(result.payout).toBe(130); // 50*2.5*1.0 + 5
});

it("oddsBoost does not multiply bonuses", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 3,
    actualAway: 1,
    stake: 100,
    oddsAtBet: 2.0,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.5 },
  });
  // round(100 * 2.0 * 1.5) = 300, + 5 (goalDiff) + 10 (exactScore) = 315
  expect(result.payout).toBe(315);
});

it("oddsBoost has no effect on wrong prediction", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 0,
    actualAway: 2,
    stake: 100,
    oddsAtBet: 2.0,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 2.0 },
  });
  expect(result.payout).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/scoring.test.ts`
Expected: FAIL — `oddsBoost` property doesn't exist on `groupSettings` type.

- [ ] **Step 3: Update BetPayoutInput interface and payout calculation in scoring.ts**

In `src/lib/scoring.ts`, update the `groupSettings` type inside `BetPayoutInput` to include `oddsBoost`:

```typescript
interface BetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  groupSettings: { bonusGoalDiff: number; bonusExactScore: number; oddsBoost: number };
}
```

Then update the payout calculation line (line 55) from:

```typescript
let payout = Math.round(stake * oddsAtBet);
```

to:

```typescript
let payout = Math.round(stake * oddsAtBet * groupSettings.oddsBoost);
```

- [ ] **Step 4: Update existing test fixture to include oddsBoost**

The existing tests use a shared `groupSettings` constant on line 17. Update it:

```typescript
const groupSettings = { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0 };
```

This ensures existing tests keep passing with the default 1.0 multiplier.

- [ ] **Step 5: Run tests to verify they all pass**

Run: `npx vitest run tests/lib/scoring.test.ts`
Expected: ALL PASS (existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "feat: add oddsBoost to scoring logic with tests"
```

---

### Task 2: Add oddsBoost column to DB schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add oddsBoost column to groups table**

In `src/db/schema.ts`, first add `real` to the import from `drizzle-orm/pg-core` (line 2-12):

```typescript
import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
```

Then add after `bonusPodiumExact` (line 116):

```typescript
oddsBoost: real("odds_boost").default(1.0).notNull(),
```

- [ ] **Step 2: Generate Drizzle migration**

Run: `npx drizzle-kit generate`
Expected: A new migration file in `drizzle/` directory with `ALTER TABLE groups ADD COLUMN odds_boost real DEFAULT 1.0 NOT NULL`.

- [ ] **Step 3: Run migration against Neon**

Run: `npx drizzle-kit migrate`
Expected: Migration applied successfully.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add odds_boost column to groups table"
```

---

### Task 3: Update cron sync to pass oddsBoost

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Update scoreMatch to pass oddsBoost to calculateBetPayout**

In `src/app/api/cron/sync/route.ts`, find the `scoreMatch` function (~line 344) where `calculateBetPayout` is called. Update the `groupSettings` object:

From:

```typescript
groupSettings: {
  bonusGoalDiff: bet.group.bonusGoalDiff,
  bonusExactScore: bet.group.bonusExactScore,
},
```

To:

```typescript
groupSettings: {
  bonusGoalDiff: bet.group.bonusGoalDiff,
  bonusExactScore: bet.group.bonusExactScore,
  oddsBoost: bet.group.oddsBoost,
},
```

No other changes needed — `bet.group` already includes all `groups` columns via the Drizzle relation.

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat: pass oddsBoost to scoring in cron sync"
```

---

### Task 4: Update server actions

**Files:**
- Modify: `src/actions/groups.ts`

- [ ] **Step 1: Add oddsBoost to CreateGroupInput interface**

In `src/actions/groups.ts`, add to `CreateGroupInput` (after `bonusPodiumExact`, ~line 20):

```typescript
oddsBoost?: number;
```

- [ ] **Step 2: Add oddsBoost to createGroup values spread**

In the `createGroup` function, add after the `bonusPodiumExact` spread (~line 55):

```typescript
...(input.oddsBoost != null && { oddsBoost: input.oddsBoost }),
```

- [ ] **Step 3: Add oddsBoost to GroupSettings interface**

In `GroupSettings` interface (~line 114), add:

```typescript
oddsBoost?: number;
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No type errors. The `updateGroupSettings` function already spreads the settings object directly, so `oddsBoost` will be included automatically.

- [ ] **Step 5: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat: add oddsBoost to group create/update actions"
```

---

### Task 5: Update group detail page to pass oddsBoost

**Files:**
- Modify: `src/app/[locale]/groups/[slug]/page.tsx`

- [ ] **Step 1: Add oddsBoost to settings prop**

In the group page (~line 62-69), where settings are passed to `GroupDetailTabs`, add `oddsBoost`:

```typescript
settings={{
  tokenPerMatch: group.tokenPerMatch,
  initialTokens: group.initialTokens,
  distributionDaysBefore: group.distributionDaysBefore,
  bonusGoalDiff: group.bonusGoalDiff,
  bonusExactScore: group.bonusExactScore,
  bonusPodiumMention: group.bonusPodiumMention,
  bonusPodiumExact: group.bonusPodiumExact,
  oddsBoost: group.oddsBoost,
}}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/groups/[slug]/page.tsx
git commit -m "feat: pass oddsBoost setting to group detail tabs"
```

---

### Task 6: Update UI components

**Files:**
- Modify: `src/components/group-detail-tabs.tsx`
- Modify: `src/components/create-group-form.tsx`

- [ ] **Step 1: Add oddsBoost to GroupSettings interface in group-detail-tabs.tsx**

In `src/components/group-detail-tabs.tsx`, add to the `GroupSettings` interface (~line 40):

```typescript
oddsBoost: number;
```

- [ ] **Step 2: Add oddsBoost input to settings tab in group-detail-tabs.tsx**

Find the settings grid (the `<div className="grid grid-cols-2 gap-4">` block, ~line 232). Add a new input field after the last existing setting input (bonusPodiumExact), inside the grid:

```tsx
<div className="flex flex-col gap-1">
  <Label className="text-xs">{t("oddsBoost")}</Label>
  <Input
    type="number"
    min={1.0}
    max={3.0}
    step={0.1}
    value={settings.oddsBoost}
    onChange={(e) =>
      setSettings({
        ...settings,
        oddsBoost: Number(e.target.value),
      })
    }
    className="font-mono"
  />
</div>
```

- [ ] **Step 3: Add oddsBoost to create-group-form.tsx state**

In `src/components/create-group-form.tsx`, add `oddsBoost` to the default settings state (~line 39):

```typescript
const [settings, setSettings] = useState({
  tokenPerMatch: 100,
  initialTokens: 200,
  distributionDaysBefore: 3,
  bonusGoalDiff: 5,
  bonusExactScore: 10,
  bonusPodiumMention: 20,
  bonusPodiumExact: 20,
  oddsBoost: 1.0,
});
```

- [ ] **Step 4: Add oddsBoost input to create-group-form.tsx**

Add a new input field after the last setting input (bonusPodiumExact) inside the advanced settings `<Card>` grid:

```tsx
<div className="flex flex-col gap-1">
  <Label className="text-xs">{t("oddsBoost")}</Label>
  <Input
    type="number"
    min={1.0}
    max={3.0}
    step={0.1}
    value={settings.oddsBoost}
    onChange={(e) =>
      setSettings({ ...settings, oddsBoost: Number(e.target.value) })
    }
    className="font-mono"
  />
</div>
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/group-detail-tabs.tsx src/components/create-group-form.tsx
git commit -m "feat: add oddsBoost input to group create and settings UI"
```

---

### Task 7: Add i18n translations

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add oddsBoost key to hu.json**

In `messages/hu.json`, inside the `"groups"` section, add after `"bonusPodiumExact"` (~line 100):

```json
"oddsBoost": "Odds szorzó",
```

- [ ] **Step 2: Add oddsBoost key to en.json**

In `messages/en.json`, inside the `"groups"` section, add after `"bonusPodiumExact"` (~line 100):

```json
"oddsBoost": "Odds boost",
```

- [ ] **Step 3: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat: add oddsBoost i18n translations"
```

---

### Task 8: Update CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update DB schema section**

In `CLAUDE.md`, find the "Token rendszer" section. Add `oddsBoost` info. After "Carryover nincs..." add:

```markdown
- `groups.odds_boost` — odds szorzó (real, default 1.0), payout = stake × odds × oddsBoost
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add oddsBoost to CLAUDE.md"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run linter**

Run: `npx biome check src/`
Expected: No errors (or only pre-existing ones).

- [ ] **Step 4: Run dev server and verify manually**

Run: `npm run dev`
Verify:
1. Create group form → advanced settings → "Odds szorzó" input visible, default 1.0
2. Group settings tab → "Odds szorzó" input visible
3. No console errors
