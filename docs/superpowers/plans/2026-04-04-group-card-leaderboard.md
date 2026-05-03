# Csoportkártya mini rangsor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tournament oldalon a csoportkártyákon megjelenik a user profitja, mini rangsor (max 3 fő), és link a csoport oldalra.

**Architecture:** Server-side fetch a `getGroupLeaderboard` query-vel csoportonként, `pickMiniLeaderboard` pure function kiválasztja a releváns 3 sort, az adat a `TournamentTabs` client componentbe megy, az újraírt `GroupTokenSummary` rendereli a gazdagabb kártyákat.

**Tech Stack:** Next.js App Router, Drizzle ORM, next-intl, Shadcn UI, Vitest

---

### Task 1: `pickMiniLeaderboard` pure function + tesztek

**Files:**
- Create: `src/lib/leaderboard-utils.ts`
- Create: `tests/lib/leaderboard-utils.test.ts`

- [ ] **Step 1: Hozd létre a type-ot és a function signatúrát**

Create `src/lib/leaderboard-utils.ts`:

```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

export function pickMiniLeaderboard(
  leaderboard: LeaderboardEntry[],
  currentUserId: string,
): LeaderboardEntry[] {
  return [];
}
```

- [ ] **Step 2: Írd meg a teszteket**

Create `tests/lib/leaderboard-utils.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { pickMiniLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard-utils";

function makeEntry(rank: number, userId: string, profit: number): LeaderboardEntry {
  return { rank, userId, userName: `User ${userId}`, userAvatarUrl: null, profit };
}

describe("pickMiniLeaderboard", () => {
  const board: LeaderboardEntry[] = [
    makeEntry(1, "a", 300),
    makeEntry(2, "b", 200),
    makeEntry(3, "c", 100),
    makeEntry(4, "d", 50),
    makeEntry(5, "e", 20),
    makeEntry(6, "f", -10),
  ];

  it("returns top 3 when current user is 1st", () => {
    const result = pickMiniLeaderboard(board, "a");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns top 3 when current user is 2nd", () => {
    const result = pickMiniLeaderboard(board, "b");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns top 3 when current user is 3rd", () => {
    const result = pickMiniLeaderboard(board, "c");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns [1st, person ahead, me] when current user is 4th", () => {
    const result = pickMiniLeaderboard(board, "d");
    expect(result.map((r) => r.userId)).toEqual(["a", "c", "d"]);
  });

  it("returns [1st, person ahead, me] when current user is 6th", () => {
    const result = pickMiniLeaderboard(board, "f");
    expect(result.map((r) => r.userId)).toEqual(["a", "e", "f"]);
  });

  it("returns top 3 when current user is not in the leaderboard", () => {
    const result = pickMiniLeaderboard(board, "unknown");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns all entries when leaderboard has fewer than 3", () => {
    const small = [makeEntry(1, "a", 100), makeEntry(2, "b", 50)];
    const result = pickMiniLeaderboard(small, "b");
    expect(result.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("returns empty array for empty leaderboard", () => {
    const result = pickMiniLeaderboard([], "a");
    expect(result).toEqual([]);
  });

  it("deduplicates when 1st and person-ahead are the same (user is 2nd in 2-person board)", () => {
    const two = [makeEntry(1, "a", 100), makeEntry(2, "b", 50)];
    const result = pickMiniLeaderboard(two, "b");
    expect(result.map((r) => r.userId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 3: Futtasd a teszteket — FAIL-t kell látnod**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts`
Expected: FAIL — `pickMiniLeaderboard` returns `[]`

- [ ] **Step 4: Implementáld a `pickMiniLeaderboard` logikát**

Update `src/lib/leaderboard-utils.ts`:

```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

export function pickMiniLeaderboard(
  leaderboard: LeaderboardEntry[],
  currentUserId: string,
): LeaderboardEntry[] {
  if (leaderboard.length === 0) return [];

  const userIndex = leaderboard.findIndex((e) => e.userId === currentUserId);

  // User not found or in top 3 → return top 3
  if (userIndex === -1 || userIndex < 3) {
    return leaderboard.slice(0, 3);
  }

  // User is 4th or lower → [1st, person ahead, me]
  const first = leaderboard[0];
  const ahead = leaderboard[userIndex - 1];
  const me = leaderboard[userIndex];

  // Deduplicate if 1st === person ahead (user is 2nd in a small board)
  if (first.userId === ahead.userId) {
    return [first, me];
  }

  return [first, ahead, me];
}
```

- [ ] **Step 5: Futtasd a teszteket — PASS-t kell látnod**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/leaderboard-utils.ts tests/lib/leaderboard-utils.test.ts
git commit -m "feat: add pickMiniLeaderboard utility with tests"
```

---

### Task 2: i18n kulcsok hozzáadása

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Adj hozzá i18n kulcsokat a `tournaments` szekciókhoz**

In `messages/hu.json`, add to the `"tournaments"` object (after `"allBetsPlaced"`):

```json
"groupProfit": "Profit: {profit}",
"viewGroup": "Csoport megtekintése"
```

In `messages/en.json`, add to the `"tournaments"` object (after `"allBetsPlaced"`):

```json
"groupProfit": "Profit: {profit}",
"viewGroup": "View group"
```

- [ ] **Step 2: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat: add group card leaderboard i18n keys"
```

---

### Task 3: Server-side leaderboard fetch a tournament page-ben

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx`

- [ ] **Step 1: Importáld a leaderboard queryt és a pickMiniLeaderboard-ot**

In `src/app/[locale]/tournaments/[slug]/page.tsx`, add imports at the top (after existing imports):

```typescript
import { pickMiniLeaderboard } from "@/lib/leaderboard-utils";
import { getGroupLeaderboard } from "@/queries/leaderboard";
```

- [ ] **Step 2: Fetch leaderboard data csoportonként és építsd meg a mini leaderboard-ot**

In `src/app/[locale]/tournaments/[slug]/page.tsx`, after the `// Podium data` section (line 94) and its `podiumData` block, add:

```typescript
  // Mini leaderboard per group
  const groupLeaderboards = await Promise.all(
    relevantGroups.map(async (gm) => {
      const leaderboard = await getGroupLeaderboard(gm.group.id);
      const mini = pickMiniLeaderboard(leaderboard, user.id);
      const myEntry = leaderboard.find((e) => e.userId === user.id);
      return {
        groupId: gm.group.id,
        groupName: gm.group.name,
        groupSlug: gm.group.slug,
        myProfit: myEntry?.profit ?? 0,
        myRank: myEntry?.rank ?? null,
        miniLeaderboard: mini.map((e) => ({
          rank: e.rank,
          userId: e.userId,
          userName: e.userName,
          profit: e.profit,
        })),
      };
    }),
  );
```

- [ ] **Step 3: Add hozzá az új propot a TournamentTabs-hoz**

In the same file, update the `<TournamentTabs>` JSX (around line 163) to pass the new prop:

```tsx
      <TournamentTabs
        matches={matchesData}
        tournamentId={tournament.id}
        podiumLockDate={tournament.podiumLockDate.toISOString()}
        teams={tournamentTeams}
        podiumGroups={podiumData}
        groupBetInfosByMatch={groupBetInfosByMatch}
        groupLeaderboards={groupLeaderboards}
        currentUserId={user.id}
      />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/tournaments/[slug]/page.tsx
git commit -m "feat: fetch mini leaderboard data for group cards on tournament page"
```

---

### Task 4: TournamentTabs — új prop fogadása és átadása

**Files:**
- Modify: `src/components/tournament-tabs.tsx`

- [ ] **Step 1: Bővítsd a TournamentTabs props interface-t**

In `src/components/tournament-tabs.tsx`, add a new interface and update the props. After the `PodiumGroupData` interface (line 47), add:

```typescript
interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface GroupLeaderboardData {
  groupId: string;
  groupName: string;
  groupSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}
```

Update `TournamentTabsProps` to add the new fields:

```typescript
interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  podiumLockDate: string;
  teams: TeamOption[];
  podiumGroups: PodiumGroupData[];
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
  groupLeaderboards: GroupLeaderboardData[];
  currentUserId: string;
}
```

- [ ] **Step 2: Destructure-öld az új propokat és merge-öld a groupTokenSummaries-ba**

Update the component function signature to destructure the new props:

```typescript
export function TournamentTabs({
  matches,
  tournamentId,
  podiumLockDate,
  teams,
  podiumGroups,
  groupBetInfosByMatch,
  groupLeaderboards,
  currentUserId,
}: TournamentTabsProps) {
```

Replace the existing `groupTokenSummaries` useMemo (lines 102-129) with a version that merges leaderboard data:

```typescript
  const groupCardData = useMemo(() => {
    // Count unbetted scheduled matches per group
    const unbettedMap = new Map<string, number>();
    for (const match of liveMatches) {
      if (match.status !== "scheduled") continue;
      const groupInfos = groupBetInfosByMatch[match.id] ?? [];
      for (const gi of groupInfos) {
        if (!gi.existingBet) {
          unbettedMap.set(gi.groupId, (unbettedMap.get(gi.groupId) ?? 0) + 1);
        }
      }
    }

    return groupLeaderboards.map((gl) => {
      // Get balance from any match's groupBetInfo (all have the same balance for a group)
      const anyMatchInfos = Object.values(groupBetInfosByMatch).find((infos) =>
        infos.some((i) => i.groupId === gl.groupId),
      );
      const balance = anyMatchInfos?.find((i) => i.groupId === gl.groupId)?.balance ?? 0;

      return {
        ...gl,
        balance,
        unbettedCount: unbettedMap.get(gl.groupId) ?? 0,
      };
    });
  }, [liveMatches, groupBetInfosByMatch, groupLeaderboards]);
```

- [ ] **Step 3: Cseréld le a `<GroupTokenSummary>` hívást**

Replace `<GroupTokenSummary groups={groupTokenSummaries} />` (line 188) with:

```tsx
          <GroupTokenSummary
            groups={groupCardData}
            currentUserId={currentUserId}
          />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-tabs.tsx
git commit -m "feat: pass mini leaderboard data to GroupTokenSummary"
```

---

### Task 5: GroupTokenSummary újraírás — gazdagabb kártya

**Files:**
- Modify: `src/components/group-token-summary.tsx`

- [ ] **Step 1: Írd újra a teljes `group-token-summary.tsx`-et**

Rewrite `src/components/group-token-summary.tsx`:

```typescript
"use client";

import { ChevronRight, CircleAlert, CircleCheck, Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface GroupCardItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  balance: number;
  unbettedCount: number;
}

interface GroupTokenSummaryProps {
  groups: GroupCardItem[];
  currentUserId: string;
}

function ProfitDisplay({ profit }: { profit: number }) {
  const formatted = profit > 0 ? `+${profit}` : `${profit}`;
  const colorClass =
    profit > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : profit < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return <span className={`font-mono text-sm font-bold ${colorClass}`}>{formatted}</span>;
}

export function GroupTokenSummary({ groups, currentUserId }: GroupTokenSummaryProps) {
  const t = useTranslations("tournaments");

  if (groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const hasWarning = g.balance > 0 && g.unbettedCount > 0;

        return (
          <Link
            key={g.groupId}
            href={`/groups/${g.groupSlug}`}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            {/* Header: group name + arrow */}
            <div className="flex items-center justify-between">
              <span className="font-medium">{g.groupName}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            {/* Mini leaderboard */}
            {g.miniLeaderboard.length > 0 && (
              <div className="flex flex-col gap-1">
                {g.miniLeaderboard.map((entry) => {
                  const isMe = entry.userId === currentUserId;
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        isMe ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20" : ""
                      }`}
                    >
                      <span className="w-8 font-mono text-xs text-muted-foreground">
                        #{entry.rank}
                      </span>
                      <span className={`flex-1 truncate ${isMe ? "font-medium" : ""}`}>
                        {entry.userName}
                      </span>
                      <ProfitDisplay profit={entry.profit} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer: balance + unbetted info */}
            <div className="flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Coins className="size-3.5" />
                {t("tokenBalance", { balance: g.balance })}
              </span>

              {hasWarning ? (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <CircleAlert className="size-3.5" />
                  {t("unbettedMatches", { count: g.unbettedCount })}
                </span>
              ) : g.unbettedCount === 0 ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-3.5" />
                  {t("allBetsPlaced")}
                </span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Ellenőrizd, hogy az app buildel**

Run: `npx next build`
Expected: Build succeeds (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/components/group-token-summary.tsx
git commit -m "feat: rewrite GroupTokenSummary with mini leaderboard, profit, and group link"
```

---

### Task 6: Vizuális ellenőrzés és finomhangolás

- [ ] **Step 1: Indítsd el a dev szervert és nézd meg az eredményt**

Run: `npm run dev`

Navigálj a tournament oldalra (pl. `http://localhost:3000/hu/tournaments/<slug>`).

Ellenőrzőlista:
- A kártyák megjelennek a csoportokhoz
- Mini rangsor mutatja a helyes 3 sort
- A saját sor amber kiemelve
- Profit szín: zöld/piros/szürke
- Token balance és unbetted info alul
- A kártya kattintva a csoport oldalra visz
- Mobilon (keskeny nézet) is jól néz ki — 1 oszlopban

- [ ] **Step 2: Ha szükséges, finomhangold a stílust és commitolj**

```bash
git add -u
git commit -m "fix: fine-tune group card styling"
```
