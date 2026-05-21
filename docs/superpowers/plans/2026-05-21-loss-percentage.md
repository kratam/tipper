# Loss Percentage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-group `lossPercentage` setting (0–100) that controls how much of the stake a player loses on a wrong 1X2 prediction. Default 90 for new groups; existing groups remain at 100 (current behavior).

**Architecture:** New integer column on `groups`. Scoring math becomes `round(stake × (100 − lossPct) / 100)` on loss instead of hardcoded `0`. Projected-balance math needs no change — it already derives net from `payout − stake`. UI exposes the setting in create/edit forms; match card display switches to net (`stake → ±net`) for both wins and losses, fixing a pre-existing bug that showed the full payout as "+payout".

**Tech Stack:** Drizzle ORM + Neon Postgres, Next.js Server Actions, Vitest for scoring tests, next-intl for translations, Shadcn UI.

**Spec reference:** [docs/superpowers/specs/2026-05-21-loss-percentage-design.md](../specs/2026-05-21-loss-percentage-design.md)

---

## Task 1: DB schema and migration

**Files:**
- Modify: `src/db/schema.ts` (groups table)
- Create: `drizzle/0014_loss_percentage.sql` (or whatever number db:generate picks — confirm and rename if needed)

- [ ] **Step 1.1: Add column to Drizzle schema**

Modify [src/db/schema.ts:128](src/db/schema.ts#L128) area (right after `oddsBoost` in the `groups` table definition). Add this line before `isPublic`:

```ts
    oddsBoost: real("odds_boost").default(1.0).notNull(),
    lossPercentage: integer("loss_percentage").default(90).notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
```

- [ ] **Step 1.2: Generate migration**

Run: `npm run db:generate`

Expected: A new SQL file appears under `drizzle/` (e.g. `drizzle/0014_<random_name>.sql`) containing roughly:
```sql
ALTER TABLE "groups" ADD COLUMN "loss_percentage" integer DEFAULT 90 NOT NULL;
```

- [ ] **Step 1.3: Rewrite the generated migration to two-step form**

Open the newly generated SQL file. Replace its contents with:

```sql
ALTER TABLE "groups" ADD COLUMN "loss_percentage" integer DEFAULT 100 NOT NULL;
ALTER TABLE "groups" ALTER COLUMN "loss_percentage" SET DEFAULT 90;
```

Rationale: the first statement backfills every existing row with 100 (the current behavior). The second statement makes future inserts default to 90. If we left the generated `DEFAULT 90`, existing groups would silently start refunding 10% of losses — which contradicts the requirement.

Rename the file to `drizzle/0014_loss_percentage.sql` for clarity (and update any matching entry in `drizzle/meta/_journal.json` if the rename causes it to mismatch — Drizzle keys by tag, not filename, so usually fine, but verify).

- [ ] **Step 1.4: Apply migration locally**

Run: `npm run db:migrate`

Expected: completes with no errors. `drizzle.__drizzle_migrations` gains a new row.

Verify with: `psql "$DATABASE_URL" -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name='groups' AND column_name='loss_percentage';"`

Expected: `column_default = 90`. Then: `psql "$DATABASE_URL" -c "SELECT name, loss_percentage FROM groups LIMIT 5;"` → every existing row shows 100.

- [ ] **Step 1.5: Commit**

```bash
git add src/db/schema.ts drizzle/0014_loss_percentage.sql drizzle/meta/
git commit -m "feat(db): add groups.loss_percentage column (existing rows backfilled to 100, default 90)"
```

---

## Task 2: Scoring logic (TDD)

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `tests/lib/scoring.test.ts`

- [ ] **Step 2.1: Update existing test fixture and add new failing tests**

Edit [tests/lib/scoring.test.ts:17](tests/lib/scoring.test.ts#L17) — change the shared `groupSettings` constant so it explicitly carries `lossPercentage: 100` (preserves today's behavior for all existing assertions):

```ts
const groupSettings = { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 100 };
```

Then in the `calculateBetPayout` describe block, add these new test cases (anywhere inside the block):

```ts
it("partial refund: lossPercentage=90 returns 10% of stake when 1X2 is wrong", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 0,
    actualAway: 2,
    stake: 100,
    oddsAtBet: 2.5,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
  });
  expect(result.payout).toBe(10);
  expect(result.result1x2Correct).toBe(false);
  expect(result.goalDiffCorrect).toBe(false);
  expect(result.exactScoreCorrect).toBe(false);
});

it("partial refund: rounds to nearest integer", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 0,
    actualAway: 2,
    stake: 33,
    oddsAtBet: 2.5,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
  });
  // round(33 * 10 / 100) = round(3.3) = 3
  expect(result.payout).toBe(3);
});

it("partial refund: lossPercentage=0 returns full stake on loss (full refund)", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 0,
    actualAway: 2,
    stake: 100,
    oddsAtBet: 2.5,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 0 },
  });
  expect(result.payout).toBe(100);
});

it("partial refund: oddsAtBet null applies the same refund as a regular loss", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 3,
    actualAway: 1,
    stake: 100,
    oddsAtBet: null,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
  });
  // even though the prediction is exact, oddsAtBet=null still counts as loss
  expect(result.payout).toBe(10);
  expect(result.result1x2Correct).toBe(false);
});

it("partial refund: correct 1X2 ignores lossPercentage entirely", () => {
  const result = calculateBetPayout({
    predictedHome: 3,
    predictedAway: 1,
    actualHome: 3,
    actualAway: 1,
    stake: 50,
    oddsAtBet: 2.5,
    groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
  });
  // 50 * 2.5 + 5 (goalDiff) + 10 (exactScore) = 140
  expect(result.payout).toBe(140);
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `npm test -- scoring`

Expected: New tests FAIL (because `lossPercentage` field isn't accepted by the implementation yet — TypeScript may also complain). Existing tests should still pass because we updated the shared `groupSettings` literal.

If TypeScript blocks the test run entirely, that's the expected "red" state. Move on.

- [ ] **Step 2.3: Implement partial refund in scoring**

Replace the entire [src/lib/scoring.ts](src/lib/scoring.ts) `calculateBetPayout` function (lines 26–60) and its `BetPayoutInput` interface (lines 9–17) with:

```ts
interface BetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  groupSettings: {
    bonusGoalDiff: number;
    bonusExactScore: number;
    oddsBoost: number;
    lossPercentage: number;
  };
}

interface BetPayoutResult {
  payout: number;
  result1x2Correct: boolean;
  goalDiffCorrect: boolean;
  exactScoreCorrect: boolean;
}

function partialRefund(stake: number, lossPercentage: number): number {
  return Math.round((stake * (100 - lossPercentage)) / 100);
}

export function calculateBetPayout(input: BetPayoutInput): BetPayoutResult {
  const { predictedHome, predictedAway, actualHome, actualAway, stake, oddsAtBet, groupSettings } =
    input;

  if (oddsAtBet === null) {
    return {
      payout: partialRefund(stake, groupSettings.lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const predicted1X2 = get1X2(predictedHome, predictedAway);
  const actual1X2 = get1X2(actualHome, actualAway);
  const result1x2Correct = predicted1X2 === actual1X2;

  if (!result1x2Correct) {
    return {
      payout: partialRefund(stake, groupSettings.lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const goalDiffCorrect = predictedHome - predictedAway === actualHome - actualAway;
  const exactScoreCorrect = predictedHome === actualHome && predictedAway === actualAway;

  let payout = Math.round(stake * oddsAtBet * groupSettings.oddsBoost);
  if (goalDiffCorrect) payout += groupSettings.bonusGoalDiff;
  if (exactScoreCorrect) payout += groupSettings.bonusExactScore;

  return { payout, result1x2Correct, goalDiffCorrect, exactScoreCorrect };
}
```

- [ ] **Step 2.4: Also update the legacy "returns 0" tests to assert the new explicit value**

In [tests/lib/scoring.test.ts](tests/lib/scoring.test.ts), the existing two tests below still assert `payout === 0`. They will keep passing because the shared `groupSettings` now has `lossPercentage: 100` (`round(stake * 0 / 100) = 0`), but rename them so future readers don't get confused:

- `"returns 0 when 1X2 is wrong"` → `"loss with lossPercentage=100 returns 0 (full loss)"`
- `"returns 0 when oddsAtBet is null"` → `"oddsAtBet null with lossPercentage=100 returns 0"`

This is text-only — leave the test bodies as they are.

- [ ] **Step 2.5: Run tests to verify they pass**

Run: `npm test -- scoring`

Expected: All `calculateBetPayout` tests pass (10 originally + 5 new = 15 in that describe; plus the 4 `calculatePodiumPoints` tests).

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "feat(scoring): partial refund on loss based on lossPercentage"
```

---

## Task 3: Pass lossPercentage from sync to scoring

**Files:**
- Modify: `src/lib/sync.ts` (around line 313)

- [ ] **Step 3.1: Add lossPercentage to the scoring call**

In [src/lib/sync.ts:313-317](src/lib/sync.ts#L313-L317), extend the `groupSettings` object:

```ts
      groupSettings: {
        bonusGoalDiff: bet.group.bonusGoalDiff,
        bonusExactScore: bet.group.bonusExactScore,
        oddsBoost: bet.group.oddsBoost,
        lossPercentage: bet.group.lossPercentage,
      },
```

`bet.group` is a full Drizzle row from `with: { group: true }`, so `lossPercentage` is already on it once the schema column exists — no query change needed.

- [ ] **Step 3.2: TypeScript compile check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(sync): pass lossPercentage to bet payout calculation"
```

---

## Task 4: Server actions accept lossPercentage

**Files:**
- Modify: `src/actions/groups.ts`

- [ ] **Step 4.1: Add to CreateGroupInput**

In [src/actions/groups.ts:13-25](src/actions/groups.ts#L13-L25), extend `CreateGroupInput`:

```ts
interface CreateGroupInput {
  name: string;
  tournamentId: string;
  isPublic?: boolean;
  description?: string;
  tokenPerMatch?: number;
  initialTokens?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
  lossPercentage?: number;
}
```

- [ ] **Step 4.2: Wire lossPercentage into the createGroup INSERT**

In [src/actions/groups.ts:46-64](src/actions/groups.ts#L46-L64), inside the `db.insert(groups).values({...})` block, after the `oddsBoost` line, add:

```ts
      ...(input.oddsBoost != null && { oddsBoost: input.oddsBoost }),
      ...(input.lossPercentage != null && { lossPercentage: input.lossPercentage }),
      ...(input.isPublic != null && { isPublic: input.isPublic }),
```

- [ ] **Step 4.3: Add to GroupSettings (updateGroupSettings input)**

In [src/actions/groups.ts:145-155](src/actions/groups.ts#L145-L155), extend `GroupSettings`:

```ts
interface GroupSettings {
  isPublic?: boolean;
  description?: string | null;
  tokenPerMatch?: number;
  initialTokens?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
  lossPercentage?: number;
}
```

No code change needed to the function body — `lossPercentage` automatically participates in the `...gameSettings` spread, and the "only during upcoming" gate covers it the same as the bonus fields.

- [ ] **Step 4.4: TypeScript check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4.5: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat(actions): accept lossPercentage in createGroup and updateGroupSettings"
```

---

## Task 5: Translations

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

- [ ] **Step 5.1: Add Hungarian strings**

In [messages/hu.json](messages/hu.json), inside the `groups` namespace (right after the line containing `"oddsBoost": "Odds szorzó",` — line 145), insert:

```json
    "lossPercentage": "Vesztési %",
    "lossPercentageDescription": "Bukáskor a tét hány %-át veszíti el a játékos. 100% = teljes veszteség (klasszikus), 90% = 10%-ot visszakap.",
```

- [ ] **Step 5.2: Add English strings**

In [messages/en.json](messages/en.json), inside the `groups` namespace, find the matching `oddsBoost` line and insert below it:

```json
    "lossPercentage": "Loss %",
    "lossPercentageDescription": "On loss, what percentage of the stake the player loses. 100% = full loss (classic), 90% = 10% refunded.",
```

- [ ] **Step 5.3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/hu.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))"`

Expected: no output, exit code 0.

- [ ] **Step 5.4: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "i18n(groups): add lossPercentage labels"
```

---

## Task 6: Create-group form UI

**Files:**
- Modify: `src/components/create-group-form.tsx`

- [ ] **Step 6.1: Add lossPercentage to default settings state**

In [src/components/create-group-form.tsx:41-49](src/components/create-group-form.tsx#L41-L49), extend the `useState` defaults:

```ts
  const [settings, setSettings] = useState({
    tokenPerMatch: 100,
    initialTokens: 200,
    bonusGoalDiff: 5,
    bonusExactScore: 10,
    bonusPodiumMention: 20,
    bonusPodiumExact: 20,
    oddsBoost: 1.0,
    lossPercentage: 90,
  });
```

- [ ] **Step 6.2: Add the input field**

Find the `oddsBoost` `NumericInput` block (around [src/components/create-group-form.tsx:214-218](src/components/create-group-form.tsx#L214-L218)). Immediately after that `</div>` closing, add:

```tsx
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("lossPercentage")}</Label>
                  <NumericInput
                    value={settings.lossPercentage}
                    onChange={(val) => setSettings({ ...settings, lossPercentage: val })}
                    min={0}
                    max={100}
                    className="font-mono"
                  />
                </div>
```

(The grid layout already wraps — no extra container needed. If the visual rhythm needs adjusting, that's a follow-up.)

- [ ] **Step 6.3: Manual smoke test**

Run: `npm run dev`. Open `/groups` (or whatever the create-group route is), click "Új csoport", expand "Haladó beállítások". Verify the new "Vesztési %" field shows 90 and the value is editable. Submit and confirm the created group's `loss_percentage` column has the chosen value via:

```sql
SELECT name, loss_percentage FROM groups ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 6.4: Commit**

```bash
git add src/components/create-group-form.tsx
git commit -m "feat(create-group): add lossPercentage input (default 90)"
```

---

## Task 7: Group settings tab UI (edit)

**Files:**
- Modify: `src/components/group-detail-tabs.tsx`

- [ ] **Step 7.1: Extend the GroupSettings interface**

In [src/components/group-detail-tabs.tsx:37-45](src/components/group-detail-tabs.tsx#L37-L45):

```ts
interface GroupSettings {
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
  lossPercentage: number;
}
```

- [ ] **Step 7.2: Add the input field**

Find the `oddsBoost` `NumericInput` block around [src/components/group-detail-tabs.tsx:302-312](src/components/group-detail-tabs.tsx#L302-L312). Immediately after its closing `</div>` (before `</div>` of the grid), add:

```tsx
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{t("lossPercentage")}</Label>
                      <NumericInput
                        value={settings.lossPercentage}
                        onChange={(val) => setSettings({ ...settings, lossPercentage: val })}
                        min={0}
                        max={100}
                        className="font-mono"
                      />
                    </div>
```

- [ ] **Step 7.3: Verify the prop chain compiles**

Run: `npx tsc --noEmit`

Expected: no errors. If the parent (`group-detail-tabs.tsx`'s caller) wasn't updated to pass `lossPercentage` in the settings prop, this is where it surfaces — handle it in Task 9 if so. (Confirm now: search for `<GroupDetailTabs` callers — if any caller spreads `group.{...}` directly it'll already include `lossPercentage`; if there's an explicit settings literal, that one needs updating.)

```bash
grep -rn "GroupDetailTabs" /Users/kratam/dev/tipper/src --include="*.tsx"
```

- [ ] **Step 7.4: Commit**

```bash
git add src/components/group-detail-tabs.tsx
git commit -m "feat(group-settings): add lossPercentage input to edit tab"
```

---

## Task 8: Type bubble-up and display passthrough

This task wires `lossPercentage` through the read path so the create/edit forms have the value to display and so the public dialog can show it.

**Files:**
- Modify: `src/queries/groups.ts` (GroupSettings-like return types)
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx`
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`
- Modify: `src/components/tournament-tabs.tsx`
- Modify: `src/components/public-groups-section.tsx`
- Modify: `src/components/public-group-dialog.tsx`
- Modify: `src/components/bet-dialog.tsx` (if it surfaces group settings — verify)

- [ ] **Step 8.1: Add lossPercentage to queries/groups.ts return types**

In [src/queries/groups.ts:488-547](src/queries/groups.ts#L488-L547) (the type and the assembled return), wherever the existing fields `bonusGoalDiff`, `bonusExactScore`, `oddsBoost` are declared and returned, add `lossPercentage: number` next to them in the type, and `lossPercentage: g.lossPercentage` in the object literal.

If multiple return-shapes carry these fields in the file, do the same for each one (search the file for `oddsBoost:` to find every site).

- [ ] **Step 8.2: Update tournament page passthrough**

In [src/app/[locale]/tournaments/[slug]/page.tsx](src/app/[locale]/tournaments/[slug]/page.tsx):
- Find the `oddsBoost: ...` keys in the object literals (lines 128/155/177–180).
- Beside each one, add a `lossPercentage` line that mirrors the source (e.g. `lossPercentage: gm.group.lossPercentage` near line 155, and `lossPercentage: og.lossPercentage` near line 177).
- If a TypeScript prop type at the top of the file lists `oddsBoost: number;`, add `lossPercentage: number;` to the same interface.

- [ ] **Step 8.3: Update group detail page passthrough**

In [src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx](src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx) around lines 86–90:

```ts
          bonusGoalDiff: group.bonusGoalDiff,
          bonusExactScore: group.bonusExactScore,
          oddsBoost: group.oddsBoost,
          lossPercentage: group.lossPercentage,
```

(plus any prop-type interface in the same file).

- [ ] **Step 8.4: Update tournament-tabs.tsx prop types**

In [src/components/tournament-tabs.tsx](src/components/tournament-tabs.tsx) around lines 32 and 77–80, add `lossPercentage: number;` to each interface that already has `oddsBoost: number;`. Do **not** pass `lossPercentage` down to `<OfficialGroupRibbon>` — Step 8.5 keeps the ribbon untouched.

- [ ] **Step 8.5: Skip official-group-ribbon for now**

`official-group-ribbon.tsx` shows a curated subset of rules and is space-constrained. Leave its props and JSX as-is for this iteration. (If we want to surface lossPercentage there later, that's a small follow-up.)

- [ ] **Step 8.6: Update public-groups-section.tsx and public-group-dialog.tsx**

In [src/components/public-groups-section.tsx:16-19](src/components/public-groups-section.tsx#L16-L19), add `lossPercentage: number;` to the group prop type.

In [src/components/public-group-dialog.tsx:22-25](src/components/public-group-dialog.tsx#L22-L25), do the same. Then in the JSX where `RuleBox` for `oddsBoostLabel` is rendered (around line 128), add a new RuleBox after it:

```tsx
                <RuleBox label={t("oddsBoostLabel")} value={`${group.oddsBoost}x`} />
                <RuleBox label={t("lossPercentage")} value={`${group.lossPercentage}%`} />
```

- [ ] **Step 8.7: Verify bet-dialog.tsx**

In [src/components/bet-dialog.tsx:39](src/components/bet-dialog.tsx#L39) the interface lists `oddsBoost: number;`. Since the bet dialog only uses these settings for display, only add `lossPercentage: number;` to the interface — no display change required for this iteration (the dialog's "potential gain" calculator does not need to model loss; the match-card already shows resolved loss visually).

- [ ] **Step 8.8: TypeScript compile**

Run: `npx tsc --noEmit`

Expected: no errors. If something complains, the file probably has another `oddsBoost: number;` site that wasn't extended — find it and add `lossPercentage`.

- [ ] **Step 8.9: Manual smoke test**

Run: `npm run dev`. Open a public group dialog (from `/groups` or the public listing) and verify the "Vesztési %" rule box appears with the correct value.

- [ ] **Step 8.10: Commit**

```bash
git add src/queries/groups.ts src/app/[locale]/tournaments src/components
git commit -m "feat(ui): surface lossPercentage in read paths and public group dialog"
```

---

## Task 9: Official group default

**Files:**
- Modify: `src/lib/official-group.ts`

- [ ] **Step 9.1: Set lossPercentage explicitly on the official group**

In [src/lib/official-group.ts:60-75](src/lib/official-group.ts#L60-L75), inside the `db.insert(groups).values({...})` block, after the `oddsBoost: 1.1,` line, add:

```ts
      oddsBoost: 1.1,
      lossPercentage: 90,
      isPublic: true,
```

This affects **newly created** official groups (created via `createOfficialGroup`). Existing official groups in production already have `loss_percentage = 100` from the migration backfill — leave them. If we want to flip existing official groups to 90, that's a separate manual SQL update outside this plan.

- [ ] **Step 9.2: Check the official-group test (if it asserts the values)**

```bash
grep -n "loss\|oddsBoost" /Users/kratam/dev/tipper/tests/lib/official-group.test.ts
```

If a test asserts `oddsBoost: 1.1` literally, it may also need `lossPercentage: 90` added. (Most likely the test doesn't go that deep — it's about slug reservation and the system user.)

- [ ] **Step 9.3: Run tests**

Run: `npm test`

Expected: all green.

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/official-group.ts tests/lib/official-group.test.ts
git commit -m "feat(official-group): default lossPercentage to 90 for new official groups"
```

---

## Task 10: Match-card net display (fix existing bug + reflect partial refund)

**Files:**
- Modify: `src/components/match-card.tsx`

- [ ] **Step 10.1: Rewrite the StakePill rendering**

Replace the JSX block in [src/components/match-card.tsx:122-138](src/components/match-card.tsx#L122-L138) with a net-based renderer. The current code shows `{stake}→+{payout}` on a win (which displays the full payout, including the returned stake — a bug) and a strikethrough stake on a loss.

New implementation:

```tsx
function StakePill({ bet, isFinished }: { bet: UserBet; isFinished: boolean }) {
  const isResolved = isFinished && bet.payout != null;
  const net = isResolved ? bet.payout! - bet.stake : null;

  const pillStyle = isResolved
    ? net! > 0
      ? "bg-emerald-500/10 text-emerald-600"
      : net! < 0
        ? "bg-destructive/8 text-destructive"
        : "bg-muted text-muted-foreground"
    : "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${pillStyle}`}
    >
      <span className="font-medium">{bet.groupName}</span>
      {isResolved ? (
        <span className="font-bold">
          {bet.stake}→{net! > 0 ? `+${net}` : net! < 0 ? `${net}` : "±0"}
        </span>
      ) : (
        <span>{bet.stake}</span>
      )}
      <TokenIcon size={10} />
    </span>
  );
}
```

Notes:
- `net!` is safe because the surrounding `isResolved` already implies `bet.payout != null`.
- Negative numbers stringify with their own `-` sign, so we don't prepend one.
- We drop the existing `isWin` / `isLoss` derivation; the function no longer needs `result1x2Correct` to decide color — net direction is the new source of truth (and correctly handles "partial-refund loss" and "full-refund tie at exact stake" without special-casing).
- If `result1x2Correct` is referenced elsewhere in the file (above the function), leave that alone — it likely controls other elements like the prediction badge.

- [ ] **Step 10.2: Clean up now-unused locals**

After the rewrite, search the file for the variables `isWin`/`isLoss` that lived inside the original `StakePill`. They're gone. If `result1x2Correct` is accessed elsewhere in the file and shouldn't be removed, that's fine — only delete what's now unreferenced.

- [ ] **Step 10.3: Manual smoke test**

Run: `npm run dev`. Find a tournament with finished matches that include:
- A win (any group): pill should show `{stake}→+{net}`, green.
- A loss in a group with `lossPercentage=100`: `{stake}→-{stake}`, red.
- (Optional, if you have test data with `lossPercentage<100`): `{stake}→-{stake-payout}`, red but a smaller negative.

If you don't have partial-refund test data yet, manually update one group's `loss_percentage` and re-run the cron's scoring on a finished match to produce one. (Skip if too much friction — the unit tests already cover the math.)

- [ ] **Step 10.4: Commit**

```bash
git add src/components/match-card.tsx
git commit -m "fix(match-card): show net (stake → ±net) instead of full payout; supports partial refunds"
```

---

## Task 11: Final verification

- [ ] **Step 11.1: Run the full test suite**

Run: `npm test`

Expected: all tests green.

- [ ] **Step 11.2: Lint**

Run: `npm run lint`

Expected: no errors. Fix any Biome complaints inline.

- [ ] **Step 11.3: Production build**

Run: `npm run build`

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 11.4: Spot-check tokens math**

Open `psql` and run a sanity query against a group with `loss_percentage = 90` (you may need to flip one in dev first). Place a losing bet (or rely on existing test data), let scoring run, and confirm:

```sql
SELECT stake, payout, payout - stake AS net
FROM bets
WHERE group_id = '<id>'
  AND result_1x2_correct = false
ORDER BY updated_at DESC
LIMIT 5;
```

`net` should be `-stake * 0.9` (rounded). The projected-balance query (no code change in this plan) should reflect this — verify by opening the group page in `npm run dev` and confirming the displayed available tokens after a finished losing match are higher than they would have been at `lossPercentage=100` (by `payout` tokens).

- [ ] **Step 11.5: Deploy checklist**

Document for the deploy runner (no code change — just a note for whoever deploys):

1. Apply migration to **production** Neon: `0014_loss_percentage.sql` via Neon MCP `run_sql`.
2. Verify `SELECT loss_percentage FROM groups LIMIT 5;` returns 100 for all rows.
3. Deploy code to Vercel (push to main).

If steps 1 and 3 are reversed, the deployed code will reference a column that doesn't exist yet and 500 on every group-related page.

---

## Files Created/Modified Summary

| Path | Change |
|------|--------|
| `src/db/schema.ts` | + `lossPercentage` column |
| `drizzle/0014_loss_percentage.sql` | new migration (two-step ALTER) |
| `src/lib/scoring.ts` | partial refund branch |
| `tests/lib/scoring.test.ts` | 5 new tests + fixture update |
| `src/lib/sync.ts` | pass `lossPercentage` to scoring |
| `src/actions/groups.ts` | accept `lossPercentage` in 2 input types |
| `src/queries/groups.ts` | return type bubble-up |
| `src/components/create-group-form.tsx` | new input (default 90) |
| `src/components/group-detail-tabs.tsx` | new input on settings tab |
| `src/components/public-group-dialog.tsx` | new RuleBox |
| `src/components/public-groups-section.tsx` | prop type |
| `src/components/tournament-tabs.tsx` | prop type forward |
| `src/components/bet-dialog.tsx` | prop type only |
| `src/components/match-card.tsx` | net (`stake→±net`) display |
| `src/app/[locale]/tournaments/[slug]/page.tsx` | passthrough |
| `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` | passthrough |
| `src/lib/official-group.ts` | default 90 for new official groups |
| `messages/hu.json` | `lossPercentage`, `lossPercentageDescription` |
| `messages/en.json` | `lossPercentage`, `lossPercentageDescription` |
