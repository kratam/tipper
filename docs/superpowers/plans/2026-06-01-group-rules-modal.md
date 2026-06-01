# Csoportszabályok modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egységes, csak-olvasható „Szabályok" modal, ami egy csoport mind a 8 beállítását elmagyarázza, és három helyen elérhető (hivatalos ribbon, normál csoport oldal, fogadási flow).

**Architecture:** Egy pure helper (`src/lib/group-rules.ts`) számolja ki a megjelenítendő szekciókat/sorokat (TDD-vel fedve), egy kliens komponens (`GroupRulesDialog`) rendereli Shadcn `Dialog`-ban. A három integrációs hely a már meglévő group-adatból adja át a `GroupRules` objektumot — query-változás nincs, csak prop-átvezetés.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, next-intl, Shadcn UI (Dialog/Button), Vitest, Biome.

Spec: [docs/superpowers/specs/2026-06-01-group-rules-modal-design.md](../specs/2026-06-01-group-rules-modal-design.md)

---

## File Structure

- **Create:** `src/lib/group-rules.ts` — `GroupRules` típus + `buildRuleSections()` pure helper.
- **Create:** `src/lib/__tests__/group-rules.test.ts` — unit tesztek a helperhez.
- **Create:** `src/components/group-rules-dialog.tsx` — `GroupRulesDialog` kliens komponens.
- **Modify:** `messages/hu.json`, `messages/en.json` — új fordításkulcsok.
- **Modify:** `src/components/official-group-ribbon.tsx` — inline 3-elemű sor → trigger.
- **Modify:** `src/components/tournament-tabs.tsx` — ribbon prop-ok bővítése + bet-dialog típus.
- **Modify:** `src/app/[locale]/tournaments/[slug]/page.tsx` — `officialCard` + `groupBetInfosByMatch` bővítése.
- **Modify:** `src/components/group-page-header.tsx` — opcionális `rules` → trigger a fejlécben.
- **Modify:** `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — `rules` átadása a fejlécnek.
- **Modify:** `src/components/group-detail-tabs.tsx` — lokális `GroupSettings` → megosztott `GroupRules` import.
- **Modify:** `src/components/bet-dialog.tsx`, `src/components/bet-form.tsx` — 4 bónusz mező + trigger.

---

## Task 1: Pure helper — `buildRuleSections`

**Files:**
- Create: `src/lib/group-rules.ts`
- Test: `src/lib/__tests__/group-rules.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/group-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRuleSections, type GroupRules } from "@/lib/group-rules";

const base: GroupRules = {
  tokenPerMatch: 100,
  initialTokens: 200,
  bonusGoalDiff: 30,
  bonusExactScore: 50,
  bonusPodiumMention: 20,
  bonusPodiumExact: 20,
  oddsBoost: 1.15,
  lossPercentage: 90,
};

function findRow(sections: ReturnType<typeof buildRuleSections>, labelKey: string) {
  return sections.flatMap((s) => s.rows).find((r) => r.labelKey === labelKey);
}

describe("buildRuleSections", () => {
  it("formats core token and scoring rows", () => {
    const sections = buildRuleSections(base);
    expect(findRow(sections, "initialTokens")?.value).toBe("200");
    expect(findRow(sections, "tokenPerMatch")?.value).toBe("100");
    expect(findRow(sections, "oddsBoost")?.value).toBe("×1.15");
    expect(findRow(sections, "bonusGoalDiff")?.value).toBe("+30");
    expect(findRow(sections, "bonusExactScore")?.value).toBe("+50");
  });

  it("derives refund from lossPercentage (100 - loss)", () => {
    const refund = findRow(buildRuleSections(base), "refund");
    expect(refund?.value).toBe("10%");
    expect(refund?.explainKey).toBe("refundExplain");
    expect(refund?.explainParams).toEqual({ pct: 10 });
  });

  it("uses full-loss explanation when lossPercentage is 100", () => {
    const refund = findRow(buildRuleSections({ ...base, lossPercentage: 100 }), "refund");
    expect(refund?.value).toBe("0%");
    expect(refund?.explainKey).toBe("refundExplainFull");
    expect(refund?.explainParams).toBeUndefined();
  });

  it("adds odds explanation only when boost is above 1", () => {
    const withBoost = findRow(buildRuleSections(base), "oddsBoost");
    expect(withBoost?.explainKey).toBe("oddsBoostExplain");
    expect(withBoost?.explainParams).toEqual({ pct: 15 });

    const noBoost = findRow(buildRuleSections({ ...base, oddsBoost: 1 }), "oddsBoost");
    expect(noBoost?.value).toBe("×1");
    expect(noBoost?.explainKey).toBeUndefined();
  });

  it("hides the podium section when both podium bonuses are 0", () => {
    const sections = buildRuleSections({ ...base, bonusPodiumMention: 0, bonusPodiumExact: 0 });
    expect(sections.find((s) => s.titleKey === "rulesPodium")).toBeUndefined();
  });

  it("hides individual zero-value bonus rows", () => {
    const sections = buildRuleSections({ ...base, bonusGoalDiff: 0 });
    expect(findRow(sections, "bonusGoalDiff")).toBeUndefined();
    expect(findRow(sections, "bonusExactScore")?.value).toBe("+50");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/group-rules.test.ts`
Expected: FAIL — `buildRuleSections` / module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/group-rules.ts`:

```ts
/**
 * Egy csoport csak-olvasható "szabályai" — a groups tábla 8 konfigurálható mezője.
 * Megosztott típus a GroupRulesDialog és minden hívóhely között.
 */
export interface GroupRules {
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
  lossPercentage: number;
}

export interface RuleRow {
  /** next-intl kulcs a "groups" névtérben. */
  labelKey: string;
  /** Már formázott érték (pl. "200", "×1.15", "+30", "10%"). */
  value: string;
  /** Opcionális magyarázat kulcsa. */
  explainKey?: string;
  /** Az explain kulcs paraméterei. */
  explainParams?: Record<string, number>;
}

export interface RuleSection {
  /** next-intl kulcs a szekciócímhez. */
  titleKey: string;
  rows: RuleRow[];
}

/**
 * Felépíti a modalban megjelenítendő szekciókat. 0 értékű bónusz sorok kimaradnak,
 * a teljesen üres dobogó szekció szintén. A token-sorok és a visszatérítés mindig látszanak.
 */
export function buildRuleSections(rules: GroupRules): RuleSection[] {
  const oddsBoostPercent = Math.round((rules.oddsBoost - 1) * 100);
  const refundPercent = 100 - rules.lossPercentage;

  const sections: RuleSection[] = [];

  sections.push({
    titleKey: "rulesTokens",
    rows: [
      { labelKey: "initialTokens", value: String(rules.initialTokens) },
      { labelKey: "tokenPerMatch", value: String(rules.tokenPerMatch) },
    ],
  });

  const scoringRows: RuleRow[] = [
    {
      labelKey: "oddsBoost",
      value: `×${rules.oddsBoost}`,
      ...(oddsBoostPercent !== 0
        ? { explainKey: "oddsBoostExplain", explainParams: { pct: oddsBoostPercent } }
        : {}),
    },
  ];
  if (rules.bonusGoalDiff > 0) {
    scoringRows.push({ labelKey: "bonusGoalDiff", value: `+${rules.bonusGoalDiff}` });
  }
  if (rules.bonusExactScore > 0) {
    scoringRows.push({ labelKey: "bonusExactScore", value: `+${rules.bonusExactScore}` });
  }
  sections.push({ titleKey: "rulesScoring", rows: scoringRows });

  const podiumRows: RuleRow[] = [];
  if (rules.bonusPodiumMention > 0) {
    podiumRows.push({ labelKey: "bonusPodiumMention", value: `+${rules.bonusPodiumMention}` });
  }
  if (rules.bonusPodiumExact > 0) {
    podiumRows.push({ labelKey: "bonusPodiumExact", value: `+${rules.bonusPodiumExact}` });
  }
  if (podiumRows.length > 0) {
    sections.push({ titleKey: "rulesPodium", rows: podiumRows });
  }

  sections.push({
    titleKey: "rulesLoss",
    rows: [
      {
        labelKey: "refund",
        value: `${refundPercent}%`,
        ...(rules.lossPercentage >= 100
          ? { explainKey: "refundExplainFull" }
          : { explainKey: "refundExplain", explainParams: { pct: refundPercent } }),
      },
    ],
  });

  return sections;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/group-rules.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-rules.ts src/lib/__tests__/group-rules.test.ts
git commit -m "feat(group-rules): pure helper to build rule sections"
```

---

## Task 2: i18n kulcsok + `GroupRulesDialog` komponens

**Files:**
- Modify: `messages/hu.json` (a `groups` objektum)
- Modify: `messages/en.json` (a `groups` objektum)
- Create: `src/components/group-rules-dialog.tsx`

- [ ] **Step 1: Add HU translation keys**

A `messages/hu.json` `groups` objektumába (a meglévő `rules` kulcs mellé) vedd fel:

```json
"rulesTokens": "Tokenek",
"rulesScoring": "Pontozás",
"rulesPodium": "Dobogó tipp",
"rulesLoss": "Vesztés",
"oddsBoostExplain": "A nyeremény {pct}%-kal több az eredeti oddsnál.",
"refund": "Visszatérítés",
"refundExplain": "Vesztett meccs után a tét {pct}%-át visszakapod.",
"refundExplainFull": "Bukáskor a teljes tétet elveszíted."
```

- [ ] **Step 2: Add EN translation keys**

A `messages/en.json` `groups` objektumába ugyanezek a kulcsok angolul:

```json
"rulesTokens": "Tokens",
"rulesScoring": "Scoring",
"rulesPodium": "Podium prediction",
"rulesLoss": "Loss",
"oddsBoostExplain": "Winnings are {pct}% higher than the base odds.",
"refund": "Refund",
"refundExplain": "After a lost match you get {pct}% of your stake back.",
"refundExplainFull": "On a loss you lose your entire stake."
```

- [ ] **Step 3: Write the component**

`src/components/group-rules-dialog.tsx`:

```tsx
"use client";

import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildRuleSections, type GroupRules } from "@/lib/group-rules";

export type { GroupRules };

interface GroupRulesDialogProps {
  groupName: string;
  rules: GroupRules;
  /** Szűk fejlécben (mobil) csak ikon, felirat nélkül. */
  iconOnly?: boolean;
}

export function GroupRulesDialog({ groupName, rules, iconOnly = false }: GroupRulesDialogProps) {
  const t = useTranslations("groups");
  const [open, setOpen] = useState(false);
  const sections = buildRuleSections(rules);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("rules")}
        className="gap-1.5 text-muted-foreground"
      >
        <ScrollText className="size-4" />
        {!iconOnly && <span>{t("rules")}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {groupName} · {t("rules")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("rules")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.titleKey} className="flex flex-col gap-1.5">
                <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t(section.titleKey)}
                </h3>
                {section.rows.map((row) => (
                  <div key={row.labelKey} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm">{t(row.labelKey)}</span>
                      <span className="font-mono text-amber-500 text-sm">{row.value}</span>
                    </div>
                    {row.explainKey && (
                      <p className="text-muted-foreground text-xs">
                        {t(row.explainKey, row.explainParams)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Verify build/lint**

Run: `npm run check`
Expected: PASS, no Biome errors a két új/módosított fájlra.

- [ ] **Step 5: Commit**

```bash
git add messages/hu.json messages/en.json src/components/group-rules-dialog.tsx
git commit -m "feat(group-rules): read-only rules dialog component + i18n"
```

---

## Task 3: Integráció — hivatalos ribbon

**Files:**
- Modify: `src/components/official-group-ribbon.tsx`
- Modify: `src/components/tournament-tabs.tsx:265-285`
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx:174-192`

- [ ] **Step 1: Extend `officialCard` with full settings**

`src/app/[locale]/tournaments/[slug]/page.tsx` — az `officialCard` objektum ([174-191](../../../src/app/[locale]/tournaments/[slug]/page.tsx#L174)) bővítése. A `og` (official group) már minden mezőt tartalmaz; add hozzá:

```tsx
        return {
          groupId: og.id,
          groupName: og.name,
          groupSlug: og.slug,
          tournamentSlug: tournament.slug,
          oddsBoost: og.oddsBoost,
          tokenPerMatch: og.tokenPerMatch,
          initialTokens: og.initialTokens,
          bonusGoalDiff: og.bonusGoalDiff,
          bonusExactScore: og.bonusExactScore,
          bonusPodiumMention: og.bonusPodiumMention,
          bonusPodiumExact: og.bonusPodiumExact,
          lossPercentage: og.lossPercentage,
          myProfit: lb?.myProfit ?? 0,
          myRank: lb?.myRank ?? null,
          miniLeaderboard: lb?.miniLeaderboard ?? [],
        };
```

- [ ] **Step 2: Pass new props through `tournament-tabs.tsx`**

`src/components/tournament-tabs.tsx` — az `<OfficialGroupRibbon ... />` blokkban ([274](../../../src/components/tournament-tabs.tsx#L274)) cseréld a `bonusGoalDiff`/`bonusExactScore` propokat egyetlen `rules` propra:

```tsx
          <OfficialGroupRibbon
            groupName={officialCard.groupName}
            groupSlug={officialCard.groupSlug}
            tournamentSlug={officialCard.tournamentSlug}
            rules={{
              tokenPerMatch: officialCard.tokenPerMatch,
              initialTokens: officialCard.initialTokens,
              bonusGoalDiff: officialCard.bonusGoalDiff,
              bonusExactScore: officialCard.bonusExactScore,
              bonusPodiumMention: officialCard.bonusPodiumMention,
              bonusPodiumExact: officialCard.bonusPodiumExact,
              oddsBoost: officialCard.oddsBoost,
              lossPercentage: officialCard.lossPercentage,
            }}
            myProfit={officialCard.myProfit}
            myRank={officialCard.myRank}
            miniLeaderboard={officialCard.miniLeaderboard}
            currentUserId={currentUserId}
            next3Days={officialNext3Days}
          />
```

- [ ] **Step 3: Update the ribbon — props + replace inline settings row with trigger**

`src/components/official-group-ribbon.tsx`:

a) Import a tetejére:

```tsx
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import type { GroupRules } from "@/lib/group-rules";
```

b) A props interface-ben cseréld a három külön mezőt egy `rules`-ra:

```tsx
interface OfficialGroupRibbonProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  rules: GroupRules;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
  next3Days: Next3DaysProgress;
}
```

A függvény destrukturálásában `oddsBoost, bonusGoalDiff, bonusExactScore` helyett `rules`.

c) Az expanded panelben ([126-144](../../../src/components/official-group-ribbon.tsx#L126)) a `<div className="flex flex-wrap ...">` beállítás-sort **cseréld le** erre (a `Link` köré tett megnyitást ne öröklődjön, ezért a triggert tedd a Link elé/föléje, külön sorba):

A jelenlegi szerkezet egy kattintható `Link`-be csomagolja a beállítás-sort + mini-leaderboardot. Bontsd szét: a beállítás-sor helyére kerüljön a `GroupRulesDialog` trigger (NE a Link-en belül, mert a modal-nyitás és a navigáció ütközne). Konkrétan a `{open && ( <Link ...> ... </Link> )}` blokkot alakítsd át:

```tsx
      {open && (
        <div className="flex flex-col gap-3 border-amber-500/20 border-t bg-amber-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">{groupName}</span>
            <GroupRulesDialog groupName={groupName} rules={rules} />
          </div>
          {miniLeaderboard.length > 0 && (
            <Link
              href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
              aria-label={t("viewDetails")}
              className="flex flex-col gap-1 rounded transition-colors hover:bg-amber-500/10"
            >
              {miniLeaderboard.map((row) => {
                const isCurrentUser = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-2 px-2 py-1 text-xs ${
                      isCurrentUser ? "rounded bg-amber-500/10" : ""
                    }`}
                  >
                    <span className="w-6 font-mono">#{row.rank}</span>
                    <Avatar className="size-5">
                      <AvatarImage src={row.userAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {row.userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{row.userName}</span>
                    <span className="font-mono text-amber-500">{row.profit}</span>
                  </div>
                );
              })}
            </Link>
          )}
        </div>
      )}
```

- [ ] **Step 4: Verify build/lint**

Run: `npm run check && npm run build`
Expected: PASS, nincs típushiba (a `rules` prop végigér page → tabs → ribbon).

- [ ] **Step 5: Commit**

```bash
git add src/components/official-group-ribbon.tsx src/components/tournament-tabs.tsx "src/app/[locale]/tournaments/[slug]/page.tsx"
git commit -m "feat(group-rules): use rules dialog in official group ribbon"
```

---

## Task 4: Integráció — normál csoport oldal

**Files:**
- Modify: `src/components/group-detail-tabs.tsx:37-46`
- Modify: `src/components/group-page-header.tsx`
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx:51-89`

- [ ] **Step 1: Share the `GroupRules` type in group-detail-tabs**

`src/components/group-detail-tabs.tsx` — a lokális `GroupSettings` interface ([37-46](../../../src/components/group-detail-tabs.tsx#L37)) törlése helyett importáld a megosztott típust, és aliasold, hogy a fájl többi része ne változzon:

A fájl tetejéhez:

```tsx
import type { GroupRules } from "@/lib/group-rules";
```

A `interface GroupSettings { ... }` blokkot töröld, és helyette:

```tsx
type GroupSettings = GroupRules;
```

(A mezők azonosak, így a `settings` használat máshol változatlan marad.)

- [ ] **Step 2: Add an optional `rules` trigger slot to GroupPageHeader**

`src/components/group-page-header.tsx`:

a) Importok:

```tsx
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import type { GroupRules } from "@/lib/group-rules";
```

b) A props bővítése:

```tsx
interface GroupPageHeaderProps {
  tournamentName: string;
  tournamentSlug: string;
  tournamentLogoUrl: string | null;
  groupName: string;
  days: UpcomingDaySummary[];
  rules: GroupRules;
}
```

c) A függvény szignatúrája vegye át a `rules`-t, és a jobb oldali blokk ([a `<div className="pt-2">` rész]) egészüljön ki a triggerrel. Cseréld a jobb oldali `<div>`-et:

```tsx
      <div className="flex shrink-0 items-center gap-1 pt-2">
        <MissingTipsLink tournamentSlug={tournamentSlug} days={days} />
        <GroupRulesDialog groupName={groupName} rules={rules} iconOnly />
      </div>
```

(A fejlécben `iconOnly` — kompakt marad mobilon és desktopon is; a teljes felirat a modalban.)

- [ ] **Step 3: Pass `rules` from the group detail page**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — a `<GroupPageHeader ... />` ([54-60](../../../src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx#L54)) kapjon `rules` propot. A page már építi ezt az objektumot a `GroupDetailTabs settings`-éhez ([90-98](../../../src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx#L90)) — emeld ki egy közös konstansba a `return` előtt:

```tsx
  const groupRules = {
    tokenPerMatch: group.tokenPerMatch,
    initialTokens: group.initialTokens,
    bonusGoalDiff: group.bonusGoalDiff,
    bonusExactScore: group.bonusExactScore,
    bonusPodiumMention: group.bonusPodiumMention,
    bonusPodiumExact: group.bonusPodiumExact,
    oddsBoost: group.oddsBoost,
    lossPercentage: group.lossPercentage,
  };
```

Majd a fejlécnek:

```tsx
        <GroupPageHeader
          tournamentName={group.tournament.name}
          tournamentSlug={group.tournament.slug}
          tournamentLogoUrl={group.tournament.logoUrl}
          groupName={group.name}
          days={upcomingDays}
          rules={groupRules}
        />
```

És a `GroupDetailTabs settings={...}` propnál használd ugyanezt: `settings={groupRules}`.

- [ ] **Step 4: Verify build/lint**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/group-detail-tabs.tsx src/components/group-page-header.tsx "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx"
git commit -m "feat(group-rules): show rules dialog on group detail page"
```

---

## Task 5: Integráció — fogadási flow

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx:115-172`
- Modify: `src/components/bet-dialog.tsx:28-50`
- Modify: `src/components/bet-form.tsx:17-38, render`

- [ ] **Step 1: Add the 4 bonus fields to `groupBetInfosByMatch`**

`src/app/[locale]/tournaments/[slug]/page.tsx`:

a) A `groupBetInfosByMatch` inline típusába ([118-139](../../../src/app/[locale]/tournaments/[slug]/page.tsx#L118)), az `oddsBoost`/`lossPercentage` mellé:

```tsx
      oddsBoost: number;
      lossPercentage: number;
      bonusGoalDiff: number;
      bonusExactScore: number;
      bonusPodiumMention: number;
      bonusPodiumExact: number;
```

b) A `.map((gm) => { ... return { ... } })` objektumába ([147-170](../../../src/app/[locale]/tournaments/[slug]/page.tsx#L147)), az `oddsBoost`/`lossPercentage` mellé:

```tsx
        oddsBoost: gm.group.oddsBoost,
        lossPercentage: gm.group.lossPercentage,
        bonusGoalDiff: gm.group.bonusGoalDiff,
        bonusExactScore: gm.group.bonusExactScore,
        bonusPodiumMention: gm.group.bonusPodiumMention,
        bonusPodiumExact: gm.group.bonusPodiumExact,
```

- [ ] **Step 2: Extend `GroupBetInfo` in bet-dialog.tsx**

`src/components/bet-dialog.tsx` — a `GroupBetInfo` interface-ben ([40-41](../../../src/components/bet-dialog.tsx#L40)) az `oddsBoost`/`lossPercentage` mellé:

```tsx
  oddsBoost: number;
  lossPercentage: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
```

- [ ] **Step 3: Extend `GroupBetInfo` in bet-form.tsx and render the trigger**

`src/components/bet-form.tsx`:

a) Importok a tetejére:

```tsx
import { GroupRulesDialog } from "@/components/group-rules-dialog";
```

b) A `GroupBetInfo` interface-ben ([29-30](../../../src/components/bet-form.tsx#L29)) — cseréld a meglévő `oddsBoost` sort + a `// lossPercentage is not needed here` kommentet erre:

```tsx
  oddsBoost: number;
  lossPercentage: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
```

c) A render-ben, ahol a csoportnév látszik ([262](../../../src/components/bet-form.tsx#L262), `<span className="truncate font-medium text-sm">{group.groupName}</span>`), tedd a nevet és a triggert egy sorba. Cseréld a `{group.groupName}` span-t tartalmazó sort:

```tsx
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-medium text-sm">{group.groupName}</span>
                    <GroupRulesDialog
                      groupName={group.groupName}
                      rules={{
                        tokenPerMatch: group.tokenPerMatch,
                        initialTokens: group.initialTokens,
                        bonusGoalDiff: group.bonusGoalDiff,
                        bonusExactScore: group.bonusExactScore,
                        bonusPodiumMention: group.bonusPodiumMention,
                        bonusPodiumExact: group.bonusPodiumExact,
                        oddsBoost: group.oddsBoost,
                        lossPercentage: group.lossPercentage,
                      }}
                      iconOnly
                    />
                  </div>
```

> Megjegyzés: ellenőrizd a [bet-form.tsx:262](../../../src/components/bet-form.tsx#L262) körüli pontos JSX-szerkezetet, és a `{group.groupName}` span-t cseréld a fenti `div`-re úgy, hogy a környező flex-elrendezés ne törjön el.

- [ ] **Step 4: Verify build/lint**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/tournaments/[slug]/page.tsx" src/components/bet-dialog.tsx src/components/bet-form.tsx
git commit -m "feat(group-rules): show rules dialog in bet form"
```

---

## Task 6: Teljes verifikáció + manuális ellenőrzés

**Files:** nincs új; végső ellenőrzés.

- [ ] **Step 1: Full check + test + build**

Run: `npm run check && npm run test && npm run build`
Expected: minden PASS.

- [ ] **Step 2: Manual smoke (dev szerver)**

Run: `npm run dev`, majd ellenőrizd:
- Tournament oldal → hivatalos „Ranglista" ribbon kinyitása → „Szabályok" gomb → modal mind a 8 (releváns) beállítással, helyes visszatérítés %-kal.
- Normál csoport oldal fejléce → szabály-ikon → modal.
- Fogadás (jövőbeli meccs, van csoport) → a csoportnév mellett ikon → modal.
- Ellenőrizd: `oddsBoost === 1` esetén nincs odds-magyarázat; 0 bónusz sorok nem látszanak.

- [ ] **Step 3: Final commit (ha maradt formázás)**

```bash
git add -A
git commit -m "chore(group-rules): final verification tweaks" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage:** Egységes komponens (Task 2) ✓; csoportosított layout + magyarázatok (Task 1 helper + Task 2 render) ✓; Dialog konténer (Task 2) ✓; trigger szöveg+ikon / iconOnly (Task 2) ✓; 3 integráció (Task 3/4/5) ✓; visszatérítés = 100 − lossPercentage (Task 1) ✓; 0-bónusz kiszűrés (Task 1) ✓; i18n hu+en (Task 2) ✓; TDD pure helper (Task 1) ✓.
- **Placeholder scan:** Minden lépés konkrét kódot tartalmaz; nincs TBD/TODO. A bet-form.tsx render-csere egy „ellenőrizd a pontos JSX-et" megjegyzést kapott, mert a környező sor a meglévő fájltól függ — a csere tartalma teljes.
- **Type consistency:** `GroupRules` egy helyen definiált (`src/lib/group-rules.ts`), mindenhol onnan importálva (ribbon, group-detail-tabs alias, bet flow inline objektumok ugyanazokat a mezőket adják). `buildRuleSections` / `RuleSection` / `RuleRow` nevek a teszt és a komponens közt egyeznek. A `GroupRulesDialog` props (`groupName`, `rules`, `iconOnly`) minden hívóhelyen konzisztens.
