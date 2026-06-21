# Torna-landing: tabos, összecsukható kurált tip-mátrix board — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A torna-landingen (`/tournaments/[slug]`) a hivatalos ribbon + „Csoportok és körök" szekciót egy összecsukható blokk váltja: tabok (hivatalos + saját csoportok + körök), alattuk egy kurált, vízszintesen görgethető tip-mátrix (leaderek + a user ±1 környezete, kibontható réssel).

**Architecture:** A meglévő `TipMatrix` komponenst egészítjük ki `curated` móddal (leaderek + rés + ±1, max-magasságú kibontás), egy új `TournamentBoardPanel` fogja össze a koronás fejlécet, a tabokat és az aktív tab lustán betöltött mátrixát. A sor-kuráció egy új pure függvény (`splitCuratedRows`), ami teljesen tesztelt.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, next-intl, Radix Tabs (`ui/tabs.tsx`), Vitest, Biome.

## Global Constraints

- Magyar UI szövegek **ékezetekkel**; minden szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string. Minden új kulcs `messages/hu.json` ÉS `messages/en.json` alá.
- Design tokenek a `globals.css @theme`-ből (`text-gold`, `bg-surface`, `bg-gold-soft`, `border-border`, `text-faint` stb.) — nincs raw hex. **Egyetlen** Tabs (`ui/tabs.tsx`) és Button (`ui/button.tsx`) rendszer.
- Server Actions: `"use server"` + `getCurrentUser()` ellenőrzés (a meglévő `getTipMatrixRoundAction` ezt már teljesíti).
- DB műveletek Drizzle query API-val (e tervben nincs séma-változás, nincs migráció).
- Adatvédelmi invariáns: mások jövőbeli tippje sosem kerül kliensre — ezt a meglévő `filterRoundBetsForViewer` adja a query rétegben; ne kerüljük meg.
- Commit: conventional commits (`feat`/`refactor`/`chore`).

---

## Task 1: `splitCuratedRows` pure függvény

Tiszta, tesztelhető sor-kuráló: a teljes rendezett sorlistából kiveszi a leadereket és a user ±N környezetét, és megmondja, hány sor marad rejtve (a rés mérete).

**Files:**
- Modify: `src/lib/leaderboard-utils.ts` (új export a fájl végére)
- Test: `tests/lib/leaderboard-utils.test.ts` (új `describe` blokk a fájl végére, a meglévő `pickMiniLeaderboard` describe után)

**Interfaces:**
- Consumes: semmit (csak a bemeneti tömböt).
- Produces:
  ```ts
  export interface CuratedRows<T> {
    leaders: T[];
    around: T[];
    hiddenCount: number;
  }
  export function splitCuratedRows<T extends { userId: string }>(
    rows: readonly T[],
    currentUserId: string,
    opts?: { leaders?: number; neighbors?: number },
  ): CuratedRows<T>;
  ```
  Szemantika (alap `leaders=3`, `neighbors=1`):
  - `leaders` = az első `leaders` sor.
  - Ha a user a leaderek között van vagy nincs a listában: `around = []`, `hiddenCount = rows.length - leaders.length`.
  - Egyébként `around` = a `[userIndex-neighbors … userIndex+neighbors]` sorok, a `[leaders.length … rows.length-1]` tartományra vágva (a leaderekkel nincs átfedés); `hiddenCount = rows.length - leaders.length - around.length`.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `tests/lib/leaderboard-utils.test.ts` végére (a fájl már importálja a `LeaderboardEntry`/`makeEntry` segédet):

```ts
import { /* meglévők */ splitCuratedRows } from "@/lib/leaderboard-utils";

describe("splitCuratedRows", () => {
  const board: LeaderboardEntry[] = [
    makeEntry(1, "a", 300),
    makeEntry(2, "b", 200),
    makeEntry(3, "c", 100),
    makeEntry(4, "d", 50),
    makeEntry(5, "e", 20),
    makeEntry(6, "f", -10),
  ];

  it("user a dobogón: nincs around, a többi rejtett", () => {
    const r = splitCuratedRows(board, "b");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(3);
  });

  it("user #4: around = [me, mögötte], az ahead leaderként látszik", () => {
    const r = splitCuratedRows(board, "d");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around.map((x) => x.userId)).toEqual(["d", "e"]);
    expect(r.hiddenCount).toBe(1); // csak "f"
  });

  it("user #5: around = ±1, nincs rejtett (mindenki látszik)", () => {
    const r = splitCuratedRows(board, "e");
    expect(r.around.map((x) => x.userId)).toEqual(["d", "e", "f"]);
    expect(r.hiddenCount).toBe(0);
  });

  it("user az utolsó: around = [előtte, me]", () => {
    const r = splitCuratedRows(board, "f");
    expect(r.around.map((x) => x.userId)).toEqual(["e", "f"]);
    expect(r.hiddenCount).toBe(1); // "d"
  });

  it("user nincs a listában: csak leaderek", () => {
    const r = splitCuratedRows(board, "x");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(3);
  });

  it("kevés játékos (< leaders): mindenki leader, nincs rejtett", () => {
    const small = [makeEntry(1, "a", 100), makeEntry(2, "b", 50)];
    const r = splitCuratedRows(small, "b");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(0);
  });

  it("üres lista", () => {
    const r = splitCuratedRows([], "a");
    expect(r).toEqual({ leaders: [], around: [], hiddenCount: 0 });
  });

  it("nagy mezőny, user a középmezőnyben: rés a leaderek és az around közt + az around alatt", () => {
    const big: LeaderboardEntry[] = Array.from({ length: 10 }, (_, i) =>
      makeEntry(i + 1, `u${i + 1}`, 100 - i),
    );
    const r = splitCuratedRows(big, "u6"); // index 5
    expect(r.leaders.map((x) => x.userId)).toEqual(["u1", "u2", "u3"]);
    expect(r.around.map((x) => x.userId)).toEqual(["u5", "u6", "u7"]);
    expect(r.hiddenCount).toBe(4); // u4 + u8,u9,u10
  });
});
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts`
Expected: FAIL — `splitCuratedRows is not exported` / `is not a function`.

- [ ] **Step 3: Implementáld a függvényt**

A `src/lib/leaderboard-utils.ts` végére:

```ts
export interface CuratedRows<T> {
  leaders: T[];
  around: T[];
  hiddenCount: number;
}

/**
 * Kurált sorok a landing tip-mátrixhoz: leaderek (top N) + a user ±M környezete.
 * A `hiddenCount` a rés mérete (a leaderek és az around közt + az around alatt rejtett sorok).
 */
export function splitCuratedRows<T extends { userId: string }>(
  rows: readonly T[],
  currentUserId: string,
  opts: { leaders?: number; neighbors?: number } = {},
): CuratedRows<T> {
  const leaderCount = opts.leaders ?? 3;
  const neighbors = opts.neighbors ?? 1;
  const leaders = rows.slice(0, leaderCount);

  const userIndex = rows.findIndex((r) => r.userId === currentUserId);
  if (userIndex === -1 || userIndex < leaderCount) {
    return { leaders, around: [], hiddenCount: Math.max(0, rows.length - leaders.length) };
  }

  const start = Math.max(leaderCount, userIndex - neighbors);
  const end = Math.min(rows.length - 1, userIndex + neighbors);
  const around = rows.slice(start, end + 1);
  return { leaders, around, hiddenCount: rows.length - leaders.length - around.length };
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts`
Expected: PASS (az összes `splitCuratedRows` + a meglévő `pickMiniLeaderboard` teszt).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard-utils.ts tests/lib/leaderboard-utils.test.ts
git commit -m "feat(leaderboard): splitCuratedRows pure helper a kurált tip-mátrixhoz"
```

---

## Task 2: `TipMatrix` `curated` mód

A meglévő mátrixhoz `curated` prop: leaderek fent, kibontható rés (`▾ N további játékos`), a user ±1 lent; kibontva a teljes mezőny egy max-magasságú, függőlegesen görgethető területen, sticky oszlopfejléccel. A sor-render kiemelése egy helyi `renderRow` függvénybe, hogy mindkét mód ossza.

**Files:**
- Modify: `src/components/tip-matrix.tsx`
- Modify: `messages/hu.json`, `messages/en.json` (új `tipMatrix.showMore` / `tipMatrix.showLess`)

**Interfaces:**
- Consumes: `splitCuratedRows` (Task 1), `MatrixRowDisplay` (`@/lib/tip-matrix`).
- Produces: a `TipMatrix` új opcionális propja: `curated?: boolean` (alap `false` = a mai teljes nézet).

- [ ] **Step 1: i18n kulcsok**

`messages/hu.json` → `tipMatrix` objektumba:
```json
"showMore": "{count} további játékos",
"showLess": "Kevesebb"
```
`messages/en.json` → `tipMatrix` objektumba:
```json
"showMore": "{count} more players",
"showLess": "Show less"
```

- [ ] **Step 2: Új import + prop + state**

`src/components/tip-matrix.tsx` tetején az import bővítése (a meglévő `@/lib/tip-matrix` import mellé):
```ts
import { splitCuratedRows } from "@/lib/leaderboard-utils";
```
A `TipMatrixProps` interfész bővítése (a `readOnly?` után):
```ts
  curated?: boolean;
```
A komponens szignatúra bővítése (a `readOnly = false,` után):
```ts
  curated = false,
```
A state-ek közé (a `scope` state után, ~52. sor):
```ts
  const [gapOpen, setGapOpen] = useState(false);
```

- [ ] **Step 3: `renderRow` kiemelése**

A jelenlegi `<tbody>`-ban (281–319. sor) a `displayRows.map((row) => { … return <tr …> … </tr>; })` belsejét emeld ki egy helyi függvénybe, a `renderCell` után (a `return (` JSX előtt):

```tsx
  function renderRow(row: MatrixRowDisplay) {
    const isMe = row.userId === currentUserId;
    return (
      <tr key={row.userId} ref={isMe ? meRowRef : undefined} className={cn(isMe && "bg-gold-soft")}>
        <td
          className={cn(
            "sticky left-0 z-[1] border-border border-b px-2.5 py-2 text-left",
            isMe ? "bg-surface-2" : "bg-surface",
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
          {signed(row.value)}
        </td>
        {round.matches.map((m) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: table cell click is a supplemental interaction; keyboard users navigate via the stats dialog
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
  }
```

- [ ] **Step 4: Kurált tbody + rés-vezérlő sor + sticky/max-h**

Számold ki a kurációt a `displayRows` után, a `renderRow` közelében:
```tsx
  const curatedSplit = curated
    ? splitCuratedRows(displayRows, currentUserId, { leaders: 3, neighbors: 1 })
    : null;
  const colCount = 2 + round.matches.length;
```

A táblát körülvevő `<div className="overflow-x-auto">` (240. sor) cseréje, hogy kibontott kurált módban függőlegesen is görgessen:
```tsx
      <div className={cn("overflow-x-auto", curated && gapOpen && "max-h-[60vh] overflow-y-auto")}>
```

A `thead` oszlopfejlécei kapjanak sticky-top-ot kurált módban, hogy függőleges görgetéskor látszódjanak. A három `<th>` `className`-jébe told be `curated && "top-0"`-t a meglévő osztályok mellé (a player-`th` már `sticky left-0 z-[2]`, így sarok lesz; a `Σ` és a meccs-`th`-k `sticky top-0`-t kapnak). Pl. a player fejléc:
```tsx
              <th
                className={cn(
                  "sticky left-0 z-[2] border-border border-b bg-surface-2 px-2.5 py-2 text-left text-[11px] text-muted-foreground",
                  curated && "top-0",
                )}
              >
```
a `Σ` fejléc és a meccs-fejléc `<th>`-ekre pedig told a `cn(...)`-be a `curated && "sticky top-0 z-[1]"`-et (a meglévő `bg-surface-2`-vel együtt, hogy görgetéskor ne látszódjon át).

A `<tbody>` cseréje:
```tsx
          <tbody>
            {!curatedSplit ? (
              displayRows.map((row) => renderRow(row))
            ) : gapOpen ? (
              <>
                {displayRows.map((row) => renderRow(row))}
                {curatedSplit.hiddenCount > 0 && (
                  <tr>
                    <td colSpan={colCount} className="border-border border-b p-0">
                      <button
                        type="button"
                        onClick={() => setGapOpen(false)}
                        className="flex w-full items-center justify-center gap-1.5 bg-surface-2 py-2 text-[12.5px] text-muted-foreground hover:bg-surface-3"
                      >
                        <ChevronUp className="size-3.5" />
                        {t("showLess")}
                      </button>
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {curatedSplit.leaders.map((row) => renderRow(row))}
                {curatedSplit.hiddenCount > 0 && (
                  <tr>
                    <td colSpan={colCount} className="border-border border-b p-0">
                      <button
                        type="button"
                        onClick={() => setGapOpen(true)}
                        className="flex w-full items-center justify-center gap-1.5 bg-surface-2 py-2 text-[12.5px] text-faint hover:bg-surface-3"
                      >
                        <ChevronDown className="size-3.5" />
                        {t("showMore", { count: curatedSplit.hiddenCount })}
                      </button>
                    </td>
                  </tr>
                )}
                {curatedSplit.around.map((row) => renderRow(row))}
              </>
            )}
          </tbody>
```

Egészítsd ki az import sort a `lucide-react`-ből a `ChevronDown, ChevronUp`-pal (a meglévő `ChevronLeft, ChevronRight, Lock` mellé):
```ts
import { ArrowDownToLine, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lock } from "lucide-react";
```

- [ ] **Step 5: Biome + típusellenőrzés**

Run: `npm run check`
Expected: nincs hiba (a `tip-matrix.tsx` és a két JSON formázott).

Run: `npx tsc --noEmit`
Expected: nincs típushiba.

- [ ] **Step 6: Manuális ellenőrzés (a panel beépítése után teljes; itt smoke)**

A `curated` mód önmagában még nincs beillesztve; a teljes vizuális ellenőrzés a Task 4 után történik. Itt elég: `npm run build` sikeres.

Run: `npm run build`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add src/components/tip-matrix.tsx messages/hu.json messages/en.json
git commit -m "feat(tip-matrix): curated mód (leaderek + kibontható rés + ±1, max-height)"
```

---

## Task 3: `TournamentBoardPanel` komponens

Összecsukható blokk: koronás fejléc (hivatalos rang/profit + köv. 3 nap, chevron) → tab-sor (csak ha 2+ tab) → az aktív tab lustán betöltött kurált `TipMatrix`-a → lábléc (Részletek + Szabályok).

**Files:**
- Create: `src/components/tournament-board-panel.tsx`

**Interfaces:**
- Consumes: `TipMatrix` + `TipMatrixLeaderboardRow` (`@/components/tip-matrix`), `getTipMatrixRoundAction` (`@/actions/tip-matrix`), `TipMatrixRound` (`@/queries/tip-matrix`), `usePersistedDisclosure`, `Tabs/TabsList/TabsTrigger` (`@/components/ui/tabs`), `GroupRulesDialog` (`@/components/group-rules-dialog`), `GroupRules` (`@/lib/group-rules`), `Link` (`@/i18n/navigation`).
- Produces:
  ```ts
  export interface BoardTab {
    key: string;            // "official" | `group-${id}` | `circle-${id}`
    label: string;
    groupId: string;        // a mátrix adatforrása (köröknél a hivatalos csoport id-je)
    leaderboard: TipMatrixLeaderboardRow[];
    detailHref: string;
    readOnly: boolean;
    rules: GroupRules | null;   // a Szabályok dialóghoz (köröknél null)
    rulesGroupName: string | null;
  }
  export interface TournamentBoardPanelProps {
    currentUserId: string;
    timeZone: string;
    officialRank: number | null;
    officialProfit: number;
    next3Days: { total: number; withBet: number };
    tabs: BoardTab[];                          // a hivatalos az első
    officialInitialRound: TipMatrixRound | null;
  }
  export function TournamentBoardPanel(props: TournamentBoardPanelProps): JSX.Element | null;
  ```

- [ ] **Step 1: Komponens váz + koronás fejléc + collapse**

Hozd létre `src/components/tournament-board-panel.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import { TipMatrix, type TipMatrixLeaderboardRow } from "@/components/tip-matrix";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedDisclosure } from "@/hooks/use-persisted-disclosure";
import { Link } from "@/i18n/navigation";
import type { GroupRules } from "@/lib/group-rules";
import type { TipMatrixRound } from "@/queries/tip-matrix";

const STORAGE_KEY = "tipper:landingBoard:open";

export interface BoardTab {
  key: string;
  label: string;
  groupId: string;
  leaderboard: TipMatrixLeaderboardRow[];
  detailHref: string;
  readOnly: boolean;
  rules: GroupRules | null;
  rulesGroupName: string | null;
}

export interface TournamentBoardPanelProps {
  currentUserId: string;
  timeZone: string;
  officialRank: number | null;
  officialProfit: number;
  next3Days: { total: number; withBet: number };
  tabs: BoardTab[];
  officialInitialRound: TipMatrixRound | null;
}

export function TournamentBoardPanel({
  currentUserId,
  timeZone,
  officialRank,
  officialProfit,
  next3Days,
  tabs,
  officialInitialRound,
}: TournamentBoardPanelProps) {
  const t = useTranslations("tipMatrix");
  const tGroups = useTranslations("groups");
  const tTournaments = useTranslations("tournaments");

  const [open, , toggle] = usePersistedDisclosure(STORAGE_KEY, true);
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "official");
  const [roundByTab, setRoundByTab] = useState<Record<string, TipMatrixRound | null>>(
    tabs[0] ? { [tabs[0].key]: officialInitialRound } : {},
  );
  const [isPending, startTransition] = useTransition();

  // Lusta forduló-betöltés az aktív tabhoz (a hivatalos elő van töltve).
  useEffect(() => {
    if (activeKey in roundByTab) return;
    const tab = tabs.find((x) => x.key === activeKey);
    if (!tab) return;
    let cancelled = false;
    startTransition(async () => {
      const r = await getTipMatrixRoundAction(tab.groupId, null);
      if (!cancelled) setRoundByTab((prev) => ({ ...prev, [activeKey]: r }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeKey, roundByTab, tabs]);

  if (tabs.length === 0) return null;

  const rankDisplay = officialRank ? `#${officialRank}` : "—";
  const activeTab = tabs.find((x) => x.key === activeKey) ?? tabs[0];
  const activeRound = activeTab.key in roundByTab ? roundByTab[activeTab.key] : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-gold-line bg-card shadow-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          open ? tTournaments("officialRibbon.collapse") : tTournaments("officialRibbon.expand")
        }
        className="flex w-full items-center gap-3 bg-linear-to-r from-gold-soft to-transparent px-4 py-3 text-left"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-linear-to-br from-gold to-gold-2 text-gold-ink">
          <Crown className="size-4" />
        </span>
        <span className="font-mono text-[13.5px]">
          <span className="font-bold">{rankDisplay}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold text-gold">{officialProfit}</span>
        </span>
        {next3Days.total === 0 ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.none")}
          </span>
        ) : next3Days.withBet === next3Days.total ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-win">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.progress", { total: next3Days.total, withBet: next3Days.withBet })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-gold">
            <CircleAlert className="size-3.5" />
            {tTournaments("next3Days.progress", { total: next3Days.total, withBet: next3Days.withBet })}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-gold-line border-t px-3 py-3.5">
          {tabs.length > 1 && (
            <Tabs value={activeKey} onValueChange={setActiveKey}>
              <TabsList className="w-full">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {activeRound === undefined || isPending ? (
            <p className="py-6 text-center text-muted-foreground text-sm">{t("loading")}</p>
          ) : (
            <TipMatrix
              key={activeTab.key}
              curated
              groupId={activeTab.groupId}
              currentUserId={currentUserId}
              timeZone={timeZone}
              leaderboard={activeTab.leaderboard}
              initialRound={activeRound}
              readOnly={activeTab.readOnly}
            />
          )}

          <div className="flex items-center justify-between px-1">
            <Link
              href={activeTab.detailHref}
              className="font-medium font-mono text-[12.5px] text-gold hover:underline"
            >
              {tGroups("viewDetails")} →
            </Link>
            {activeTab.rules && activeTab.rulesGroupName && (
              <GroupRulesDialog groupName={activeTab.rulesGroupName} rules={activeTab.rules} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

> Megjegyzés: a `groups.viewDetails` és a `tournaments.officialRibbon.collapse/expand` kulcsok már léteznek (a mai `OfficialGroupRibbon` használja őket).

- [ ] **Step 2: Biome + típusellenőrzés**

Run: `npm run check`
Expected: nincs hiba.

Run: `npx tsc --noEmit`
Expected: nincs típushiba (a `BoardTab`/props illeszkedik a `TipMatrix` propjaihoz).

- [ ] **Step 3: Commit**

```bash
git add src/components/tournament-board-panel.tsx
git commit -m "feat(landing): TournamentBoardPanel (koronás fejléc + tabok + lusta kurált mátrix)"
```

---

## Task 4: Beépítés a torna-oldalba (page.tsx + tournament-tabs.tsx)

A panel adatainak előállítása szerver oldalon (teljes ranglisták + hivatalos kezdő forduló + `BoardTab[]`), és a régi ribbon + accordion lecserélése a panelre.

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx`
- Modify: `src/components/tournament-tabs.tsx`

**Interfaces:**
- Consumes: `getTipMatrixRound` (`@/queries/tip-matrix`), `getGroupLeaderboard` (`@/queries/leaderboard`), `filterAndRerankLeaderboard` (`@/lib/circle-leaderboard`), `TournamentBoardPanel` + `BoardTab` (Task 3), `TipMatrixRound`.
- Produces: két új `TournamentTabs` prop: `boardTabs: BoardTab[]` és `officialInitialRound: TipMatrixRound | null`.

- [ ] **Step 1: page.tsx — teljes ranglisták + hivatalos kezdő forduló**

A `page.tsx` Phase 3 leaderboard-map (90–112. sor) bővítése: a visszaadott objektumba vedd fel a teljes ranglistát is mátrix-sor formában (a `leaderboard` változó már megvan a `map`-en belül):
```ts
        return {
          groupId: gm.group.id,
          groupName: gm.group.name,
          groupSlug: gm.group.slug,
          tournamentSlug: tournament.slug,
          isOfficial: gm.group.isOfficial,
          myProfit: myEntry?.profit ?? 0,
          myRank: myEntry?.rank ?? null,
          fullLeaderboard: leaderboard.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            profit: e.profit,
          })),
          miniLeaderboard: mini.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            profit: e.profit,
          })),
        };
```

A `import` blokkba (a meglévő `@/queries/tip-matrix` még nincs importálva itt) vedd fel:
```ts
import { getTipMatrixRound, type TipMatrixRound } from "@/queries/tip-matrix";
```
Az `officialCard` blokk után (210. sor után) töltsd elő a hivatalos kezdő fordulót:
```ts
  const officialInitialRound: TipMatrixRound | null = officialGroup
    ? await getTipMatrixRound(
        officialGroup.id,
        tournament.id,
        tournament.useFlagFallback,
        user.id,
        null,
      )
    : null;
```
(`officialGroup` már létezik a 214. sorban.)

- [ ] **Step 2: page.tsx — `boardTabs` összeállítása**

A `circleCards` blokk után (240. sor után) építsd fel a tabokat (hivatalos → saját csoportok → körök). A `groupLeaderboards` most már tartalmazza a `fullLeaderboard`-ot és az `isOfficial`-t:
```ts
  const groupTabs: BoardTab[] = [];
  // Hivatalos elsőként
  if (officialGroup) {
    const og = groupLeaderboards.find((l) => l.groupId === officialGroup.id);
    groupTabs.push({
      key: "official",
      label: officialGroup.name,
      groupId: officialGroup.id,
      leaderboard: og?.fullLeaderboard ?? [],
      detailHref: `/tournaments/${tournament.slug}/groups/${officialGroup.slug}`,
      readOnly: false,
      rules: {
        tokenPerMatch: officialGroup.tokenPerMatch,
        initialTokens: officialGroup.initialTokens,
        bonusGoalDiff: officialGroup.bonusGoalDiff,
        bonusExactScore: officialGroup.bonusExactScore,
        bonusPodiumMention: officialGroup.bonusPodiumMention,
        bonusPodiumExact: officialGroup.bonusPodiumExact,
        oddsBoost: officialGroup.oddsBoost,
        lossPercentage: officialGroup.lossPercentage,
      },
      rulesGroupName: officialGroup.name,
    });
  }
  // Saját csoportok
  for (const gm of userOnlyGroupMemberships) {
    const gl = groupLeaderboards.find((l) => l.groupId === gm.group.id);
    groupTabs.push({
      key: `group-${gm.group.id}`,
      label: gm.group.name,
      groupId: gm.group.id,
      leaderboard: gl?.fullLeaderboard ?? [],
      detailHref: `/tournaments/${tournament.slug}/groups/${gm.group.slug}`,
      readOnly: false,
      rules: {
        tokenPerMatch: gm.group.tokenPerMatch,
        initialTokens: gm.group.initialTokens,
        bonusGoalDiff: gm.group.bonusGoalDiff,
        bonusExactScore: gm.group.bonusExactScore,
        bonusPodiumMention: gm.group.bonusPodiumMention,
        bonusPodiumExact: gm.group.bonusPodiumExact,
        oddsBoost: gm.group.oddsBoost,
        lossPercentage: gm.group.lossPercentage,
      },
      rulesGroupName: gm.group.name,
    });
  }
  // Körök (a hivatalos csoport tippjeire épülnek, read-only)
  if (officialGroup) {
    for (const circle of userCircles) {
      const memberIds = new Set(circle.members.map((m) => m.userId));
      const filtered = filterAndRerankLeaderboard(officialFullLeaderboard, memberIds);
      groupTabs.push({
        key: `circle-${circle.id}`,
        label: circle.name,
        groupId: officialGroup.id,
        leaderboard: filtered.map((e) => ({
          rank: e.rank,
          userId: e.userId,
          userName: e.userName,
          userAvatarUrl: e.userAvatarUrl,
          profit: e.profit,
        })),
        detailHref: `/tournaments/${tournament.slug}/circles/${circle.slug}`,
        readOnly: true,
        rules: null,
        rulesGroupName: null,
      });
    }
  }
```
A `BoardTab` típus importja a fájl tetejére:
```ts
import type { BoardTab } from "@/components/tournament-board-panel";
```
(`officialFullLeaderboard` már létezik a 215–216. sorban; körök esetén nem üres.)

- [ ] **Step 3: page.tsx — új propok átadása**

A `<TournamentTabs ... />` (293–306. sor) bővítése két új proppal:
```tsx
        boardTabs={groupTabs}
        officialInitialRound={officialInitialRound}
```

- [ ] **Step 4: tournament-tabs.tsx — propok + a régi blokk cseréje**

A `TournamentTabsProps` interfész bővítése (a `circleCards` után):
```ts
  boardTabs: import("@/components/tournament-board-panel").BoardTab[];
  officialInitialRound: import("@/queries/tip-matrix").TipMatrixRound | null;
```
A komponens-paraméterek közé (a `circleCards,` után):
```ts
  boardTabs,
  officialInitialRound,
```
Import a fájl tetejére:
```ts
import { TournamentBoardPanel } from "@/components/tournament-board-panel";
```
A render-ben a `{officialCard && <OfficialGroupRibbon … />}` (303–324. sor) ÉS a `{(groupCardData.length > 0 || circleCards.length > 0) && <Accordion …>…</Accordion>}` (330–354. sor) blokk **cseréje** erre:
```tsx
        {officialCard && (
          <TournamentBoardPanel
            currentUserId={currentUserId}
            timeZone={timezone}
            officialRank={officialCard.myRank}
            officialProfit={officialCard.myProfit}
            next3Days={officialNext3Days}
            tabs={boardTabs}
            officialInitialRound={officialInitialRound}
          />
        )}

        {groupCardData.length === 0 && (
          <GroupTokenSummary topPublicGroups={topPublicGroups} hasOfficialGroup={!!officialCard} />
        )}
```
(A `groupCardData.length === 0 → GroupTokenSummary` blokk a 326–328. sorból ide kerül; töröld az eredeti különálló példányát, hogy ne duplikálódjon.)

- [ ] **Step 5: Használaton kívüli importok eltakarítása a tournament-tabs.tsx-ben**

Töröld a már nem használt importokat: `OfficialGroupRibbon`, `CircleSummaryCard`, `GroupSummaryCard`, és az `Accordion, AccordionContent, AccordionItem, AccordionTrigger` (ha a fájlban máshol nincs `Accordion` használat — a meccs-napok accordionja a 391. sorban MARAD, tehát az `Accordion`-családot NE töröld). Konkrétan csak ezeket töröld:
```ts
import { CircleSummaryCard } from "@/components/circle-summary-card";
import { GroupSummaryCard } from "@/components/group-summary-card";
import { OfficialGroupRibbon } from "@/components/official-group-ribbon";
```
A `cardsOpen` state (184. sor) és a hozzá tartozó `usePersistedDisclosure("tipper:groupCards:open", true)` már nem kell (csak az accordionhoz kellett) — töröld a sort. A `groupCardData` továbbra is kell (a `GroupTokenSummary` feltételéhez és az `officialNext3Days`-hez), ezért a `useMemo`-t (205–232. sor) HAGYD meg.

- [ ] **Step 6: Típus + lint + build**

Run: `npx tsc --noEmit`
Expected: nincs hiba (az új propok átmennek; nincs használaton kívüli import).

Run: `npm run check`
Expected: nincs hiba.

Run: `npm run build`
Expected: build OK.

- [ ] **Step 7: Manuális vizuális ellenőrzés (dev szerver)**

```bash
npm run dev
```
A laptopról a `beam`-mel oszd meg (HTTPS, secure context): `beam 3000` → nyisd a kiírt URL-t, és nyiss egy tornát több csoporttal/körrel. Ellenőrizd:
- A koronás fejléc látszik, a chevron nyit/zár; reload után megmarad az állapot.
- A tab-sor csak akkor van, ha 2+ tab; váltáskor a board cserélődik, a többi tab első aktiváláskor „Betöltés…", majd megjelenik.
- A board kurált: 3 leader, `▾ N további játékos` rés, alatta te ±1; a rés kibont → max-magasságú görgethető teljes mezőny + `Kevesebb`; a meccs-oszlopok vízszintesen görgethetők.
- `<560px` (DevTools mobil): a játékos-oszlopban csak rang + avatar.
- Kör-tabon nincs `+`/tippelés (read-only); a lábléc `Részletek →` a megfelelő oldalra visz.

- [ ] **Step 8: Commit**

```bash
git add src/app/\[locale\]/tournaments/\[slug\]/page.tsx src/components/tournament-tabs.tsx
git commit -m "feat(landing): TournamentBoardPanel beépítése, ribbon+accordion lecserélése"
```

---

## Task 5: Használaton kívüli komponensek eltakarítása + záró ellenőrzés

A landingről kikerült komponensek törlése, ha sehol máshol nincs rájuk hivatkozás.

**Files:**
- Delete (feltételesen): `src/components/official-group-ribbon.tsx`, `src/components/group-summary-card.tsx`, `src/components/circle-summary-card.tsx`

- [ ] **Step 1: Hivatkozások ellenőrzése**

Run:
```bash
rg -l "official-group-ribbon|OfficialGroupRibbon|group-summary-card|GroupSummaryCard|circle-summary-card|CircleSummaryCard" src
```
Expected: csak maguk a komponens-fájlok jelennek meg (más fájl nem hivatkozik rájuk). Ha bármelyikre máshol is van hivatkozás, azt a fájlt NE töröld — hagyd meg, és jegyezd fel a commit üzenetben.

- [ ] **Step 2: Törlés**

A csak önmagukat tartalmazó (nem hivatkozott) fájlok törlése, pl.:
```bash
git rm src/components/official-group-ribbon.tsx src/components/group-summary-card.tsx src/components/circle-summary-card.tsx
```

- [ ] **Step 3: Záró ellenőrzés**

Run: `npx tsc --noEmit && npm run check && npm run test && npm run build`
Expected: minden zöld (típus OK, lint OK, Vitest PASS, build OK).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(landing): használaton kívüli ribbon/summary-card komponensek törlése"
```

---

## Önellenőrzés (a terv kész)

- **Spec-lefedettség:** Tab-összetétel (Task 4 §2), „2+" feltétel (Task 3 `tabs.length > 1`), kurált board + rés + ±1 (Task 1–2), mobil csak-avatar (Task 2 a meglévő `max-[560px]:hidden`-nel), összecsukás persistálva (Task 3 `usePersistedDisclosure` `defaultOpen=true`), kör read-only + `filterAndRerankLeaderboard` (Task 4 §2), lusta tab-betöltés (Task 3 `useEffect`), forduló-nav/Σ-toggle öröklés (Task 2 a meglévő mátrixból), detail oldalak érintetlenek (nincs rájuk task). ✔
- **Placeholder-ek:** nincs „TBD"/„később"; minden lépésnél valódi kód és parancs.
- **Típus-konzisztencia:** `BoardTab.leaderboard: TipMatrixLeaderboardRow[]` = `{rank,userId,userName,userAvatarUrl,profit}` (egyezik a `TipMatrix` propjával és a `LeaderboardEntry`/`CircleLeaderboardRow` mezőkkel); `splitCuratedRows` generikus `T extends {userId}` → `MatrixRowDisplay`-re alkalmazva (Task 2) helyes. `getTipMatrixRoundAction(groupId, null)` a Task 3 lusta betöltésében = a meglévő action szignatúra.
- **Kockázat (jelzett):** a kibontott kurált nézet kétirányú görgetése (sticky-left oszlop + sticky-top fejléc + max-height függőleges) — Task 2 §4-ben egyetlen sticky fejléc-sorral oldjuk meg (robusztus); a „leaderek/me végig ragad görgetés közben" finomítás külön v2 polish, nem blokkolja a v1-et.
