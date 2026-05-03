# No-Group Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ha a felhasználó egy versenysorozat oldalán jár, de egyetlen csoportnak sem tagja, mutasd meg a top publikus csoportokat, és tedd lehetővé a csatlakozást modálból anélkül, hogy el kellene hagyni az oldalt.

**Architecture:** Szerver-oldali adatlekérés a tournament page-en (`getTopPublicGroupsForTournament`), prop threading `TournamentTabs → GroupTokenSummary` és `BetDialog` felé. A meglévő `PublicGroupDialog` + `joinPublicGroup` + `router.refresh()` kombinációja kezeli a join + re-render flow-t.

**Tech Stack:** Next.js App Router, Drizzle ORM, next-intl, Shadcn UI (Dialog, Button), React useState/useTransition

---

## Fájlstruktúra

| Fájl | Változás |
|------|---------|
| `src/queries/groups.ts` | Új query hozzáadása |
| `src/app/[locale]/tournaments/[slug]/page.tsx` | Feltételes fetch + új prop |
| `src/components/tournament-tabs.tsx` | Új opcionális prop + továbbítás |
| `src/components/group-token-summary.tsx` | "Nincs csoport" banner |
| `src/components/bet-dialog.tsx` | "Nincs csoport" állapot |
| `messages/hu.json` | 5 új i18n kulcs |
| `messages/en.json` | 5 új i18n kulcs |

> **Megjegyzés a tesztekről:** Ez a feature DB queryket és UI komponenseket érint. A projektben lévő unit tesztek csak pure logic functionökre vannak (ld. `tests/lib/`). DB queryeket és komponenseket a projekt nem tesztel egységtesztekkel — ezért ez a plan manuális verifikációt tartalmaz tesztek helyett, konzisztensen a meglévő mintával.

---

### Task 1: i18n kulcsok

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Adj hozzá 5 új kulcsot a `tournaments` namespace-be — `hu.json`**

Nyisd meg `messages/hu.json`, keresd meg a `"tournaments"` objektumot, és add hozzá a végéhez (a záró `}` elé):

```json
"noGroupYet": "Még nem vagy tagja egyetlen csoportnak sem. Csatlakozz és versenyezz!",
"noGroupYetShort": "Még nem vagy tagja csoportnak.",
"noPublicGroup": "Még nincs aktív csoport ehhez a versenysorozathoz.",
"browseGroups": "Csoportok böngészése",
"createGroup": "Csoport létrehozása"
```

- [ ] **Step 2: Adj hozzá ugyanezeket — `en.json`**

Nyisd meg `messages/en.json`, ugyanoda:

```json
"noGroupYet": "You're not a member of any group yet. Join and compete!",
"noGroupYetShort": "You're not a member of any group yet.",
"noPublicGroup": "No active groups for this tournament yet.",
"browseGroups": "Browse groups",
"createGroup": "Create a group"
```

- [ ] **Step 3: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat: add i18n keys for no-group suggestion"
```

---

### Task 2: Új query — `getTopPublicGroupsForTournament`

**Files:**
- Modify: `src/queries/groups.ts`

- [ ] **Step 1: Add a `PublicGroupSuggestion` típust és a queryt a fájl végéhez**

Nyisd meg `src/queries/groups.ts`. A fájl végéhez (a `getPublicGroups` után) add hozzá:

```typescript
export interface PublicGroupSuggestion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  oddsBoost: number;
  tournament: {
    name: string;
    slug: string;
    status: string;
  };
}

export async function getTopPublicGroupsForTournament(
  userId: string,
  tournamentId: string,
  limit: number,
): Promise<PublicGroupSuggestion[]> {
  const userGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const excludeIds = userGroupIds.map((r) => r.groupId);

  const rows = await db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      eq(groups.tournamentId, tournamentId),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      members: true,
    },
  });

  return rows
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, limit)
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      memberCount: g.members.length,
      tokenPerMatch: g.tokenPerMatch,
      initialTokens: g.initialTokens,
      bonusGoalDiff: g.bonusGoalDiff,
      bonusExactScore: g.bonusExactScore,
      bonusPodiumMention: g.bonusPodiumMention,
      oddsBoost: g.oddsBoost,
      tournament: {
        name: g.tournament.name,
        slug: g.tournament.slug,
        status: g.tournament.status,
      },
    }));
}
```

- [ ] **Step 2: Ellenőrizd, hogy a szükséges importok megvannak**

A `notInArray` már importálva van a fájl tetején (`import { and, eq, inArray, notInArray, sql } from "drizzle-orm"`). Ha nem, add hozzá.

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build 2>&1 | tail -20
```

Várt eredmény: 0 TypeScript hiba.

- [ ] **Step 4: Commit**

```bash
git add src/queries/groups.ts
git commit -m "feat: add getTopPublicGroupsForTournament query"
```

---

### Task 3: Tournament page — feltételes fetch és prop átadás

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx`

- [ ] **Step 1: Importáld az új queryt és típust**

A `src/app/[locale]/tournaments/[slug]/page.tsx` fájlban cseréld ki a groups import sort:

```typescript
import { getBatchProjectedBalances, getUserGroups } from "@/queries/groups";
```

erre:

```typescript
import {
  getBatchProjectedBalances,
  getUserGroups,
  getTopPublicGroupsForTournament,
  type PublicGroupSuggestion,
} from "@/queries/groups";
```

- [ ] **Step 2: Add a feltételes fetchet Phase 2 után**

A Phase 2 `Promise.all` blokk után, de Phase 3 előtt, add be:

```typescript
// Phase 2.5: top public groups if user has no groups for this tournament
const relevantGroups = userGroupMemberships.filter(
  (gm) => gm.group.tournamentId === tournament.id,
);

const topPublicGroups: PublicGroupSuggestion[] =
  relevantGroups.length === 0
    ? await getTopPublicGroupsForTournament(user.id, tournament.id, 2)
    : [];
```

> **Fontos:** A `relevantGroups` változó már definiálva van lejjebb a fájlban. Töröld az ottani duplikált definíciót, és használd ezt az egyet.

- [ ] **Step 3: Add a `topPublicGroups` propot a `TournamentTabs`-nek**

Keresd meg a `<TournamentTabs ... />` JSX-t, és add hozzá:

```tsx
<TournamentTabs
  matches={matchesData}
  tournamentId={tournament.id}
  timezone={tournament.timezone}
  podiumLockDate={tournament.podiumLockDate.toISOString()}
  teams={tournamentTeams}
  podiumGroups={podiumData}
  groupBetInfosByMatch={groupBetInfosByMatch}
  groupLeaderboards={groupLeaderboards}
  currentUserId={user.id}
  topPublicGroups={topPublicGroups}
/>
```

- [ ] **Step 4: Build ellenőrzés**

```bash
npm run build 2>&1 | tail -20
```

Várt eredmény: TypeScript hiba a `topPublicGroups` propra (mert `TournamentTabs` még nem fogadja el) — ez rendben van, a következő task javítja.

- [ ] **Step 5: Commit** (csak a page.tsx-t)

```bash
git add src/app/[locale]/tournaments/[slug]/page.tsx
git commit -m "feat: fetch top public groups when user has no tournament groups"
```

---

### Task 4: TournamentTabs — prop átvétel és továbbítás

**Files:**
- Modify: `src/components/tournament-tabs.tsx`

- [ ] **Step 1: Importáld a típust és add hozzá az interfészhez**

A fájl tetején add az importot:

```typescript
import type { PublicGroupSuggestion } from "@/queries/groups";
```

A `TournamentTabsProps` interfészbe add hozzá:

```typescript
interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  timezone: string;
  podiumLockDate: string;
  teams: TeamOption[];
  podiumGroups: PodiumGroupData[];
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
  groupLeaderboards: GroupLeaderboardData[];
  currentUserId: string;
  topPublicGroups?: PublicGroupSuggestion[];  // <-- új
}
```

- [ ] **Step 2: Vedd ki a propot a destructuringben**

```typescript
export function TournamentTabs({
  matches,
  tournamentId,
  timezone,
  podiumLockDate,
  teams,
  podiumGroups,
  groupBetInfosByMatch,
  groupLeaderboards,
  currentUserId,
  topPublicGroups = [],  // <-- új, default üres tömb
}: TournamentTabsProps) {
```

- [ ] **Step 3: Add át a `GroupTokenSummary`-nak**

Keresd meg a `<GroupTokenSummary ... />` sort, és add hozzá:

```tsx
<GroupTokenSummary
  groups={groupCardData}
  currentUserId={currentUserId}
  topPublicGroups={topPublicGroups}
/>
```

- [ ] **Step 4: Add át a `BetDialog`-nak**

Keresd meg a `<BetDialog ... />` sort, és add hozzá:

```tsx
<BetDialog
  match={selectedMatch}
  groups={
    selectedMatch
      ? (groupBetInfosByMatch[selectedMatch.id] ?? []).map((g) => ({
          ...g,
          unbettedMatchCountOnDay: Math.max(
            1,
            groupUnbettedCountOnSelectedDay[g.groupId] ?? 1,
          ),
        }))
      : []
  }
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  topPublicGroups={topPublicGroups}
/>
```

- [ ] **Step 5: Build ellenőrzés**

```bash
npm run build 2>&1 | tail -20
```

Várt: TypeScript hibák a `GroupTokenSummary` és `BetDialog` propokra (következő taskok javítják).

- [ ] **Step 6: Commit**

```bash
git add src/components/tournament-tabs.tsx
git commit -m "feat: thread topPublicGroups prop through TournamentTabs"
```

---

### Task 5: GroupTokenSummary — "nincs csoport" banner

**Files:**
- Modify: `src/components/group-token-summary.tsx`

- [ ] **Step 1: Importok bővítése**

A fájl importjaihoz add:

```typescript
import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { Link } from "@/i18n/navigation";
import type { PublicGroupSuggestion } from "@/queries/groups";
```

- [ ] **Step 2: Props bővítése**

```typescript
interface GroupTokenSummaryProps {
  groups: GroupCardItem[];
  currentUserId: string;
  topPublicGroups?: PublicGroupSuggestion[];
}
```

- [ ] **Step 3: Cseréld ki a `return null` ágat a banner komponensre**

A `GroupTokenSummary` function-ben a jelenlegi:

```typescript
if (groups.length === 0) return null;
```

helyett:

```typescript
const [selectedGroup, setSelectedGroup] = useState<PublicGroupSuggestion | null>(null);

if (groups.length === 0) {
  return (
    <>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
        {topPublicGroups && topPublicGroups.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("noGroupYet")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {topPublicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  memberCount={group.memberCount}
                  variant="public"
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" asChild className="self-start gap-2">
              <Link href="/groups">
                <Users className="size-4" />
                {t("browseGroups")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("noPublicGroup")}</p>
            <Button variant="outline" size="sm" asChild className="self-start gap-2">
              <Link href="/groups/new">
                {t("createGroup")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {selectedGroup && (
        <PublicGroupDialog
          group={selectedGroup}
          memberCount={selectedGroup.memberCount}
          open={!!selectedGroup}
          onOpenChange={(open) => {
            if (!open) setSelectedGroup(null);
          }}
        />
      )}
    </>
  );
}
```

> **Fontos:** Az `useState` miatt ez a komponens már `"use client"` — ellenőrizd, hogy ez már szerepel a fájl tetején (igen, már szerepel).

> **GroupCard prop:** A `GroupCard` elvárja `group.tournament.slug`-ot, amit a `PublicGroupSuggestion.tournament.slug` biztosít — ez konzisztens.

- [ ] **Step 4: Build + lint ellenőrzés**

```bash
npm run build 2>&1 | tail -30
npm run lint 2>&1 | tail -20
```

Várt: 0 hiba.

- [ ] **Step 5: Manuális ellenőrzés**

Indítsd el a dev servert (`npm run dev`), navigálj egy tournament oldalra egy olyan userrel, aki **nem tagja egyetlen csoportnak sem**. Elvárt:
- Banner jelenik meg a meccsek felett
- Ha van publikus csoport: 2 `GroupCard` + "Csoportok böngészése" gomb
- Ha nincs: "Még nincs aktív csoport..." szöveg + "Csoport létrehozása" gomb
- GroupCard-ra klikk → `PublicGroupDialog` megnyílik
- Join után → oldal újrarenderel, banner eltűnik, csoport kártya megjelenik

- [ ] **Step 6: Commit**

```bash
git add src/components/group-token-summary.tsx
git commit -m "feat: show public group suggestions when user has no groups"
```

---

### Task 6: BetDialog — "nincs csoport" állapot

**Files:**
- Modify: `src/components/bet-dialog.tsx`

- [ ] **Step 1: Importok bővítése**

```typescript
import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { Link } from "@/i18n/navigation";
import type { PublicGroupSuggestion } from "@/queries/groups";
```

> Ellenőrizd, hogy `useState` már importálva van-e — ha nem, a `react` importhoz add hozzá.

- [ ] **Step 2: Props bővítése**

```typescript
interface BetDialogProps {
  match: MatchCardData | null;
  groups: GroupBetInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topPublicGroups?: PublicGroupSuggestion[];
}
```

- [ ] **Step 3: Destructuring bővítése**

```typescript
export function BetDialog({ match, groups, open, onOpenChange, topPublicGroups = [] }: BetDialogProps) {
```

- [ ] **Step 4: State hozzáadása és a `groups.length === 0` ág cseréje**

A function body elejéhez (a `const t = ...` sor után) add:

```typescript
const [selectedPublicGroup, setSelectedPublicGroup] = useState<PublicGroupSuggestion | null>(null);
```

Az `else` ágban (jelenleg):

```tsx
) : (
  <p className="text-center text-sm text-muted-foreground">{t("noBet")}</p>
)}
```

Cseréld erre:

```tsx
) : topPublicGroups.length > 0 ? (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">{t("noGroupYetShort")}</p>
    <GroupCard
      group={topPublicGroups[0]}
      memberCount={topPublicGroups[0].memberCount}
      variant="public"
      onClick={() => setSelectedPublicGroup(topPublicGroups[0])}
    />
    <Button variant="outline" size="sm" asChild className="w-full gap-2">
      <Link href="/groups">
        <Users className="size-4" />
        {t("browseGroups")}
      </Link>
    </Button>
  </div>
) : (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">{t("noPublicGroup")}</p>
    <Button variant="outline" size="sm" asChild className="w-full gap-2">
      <Link href="/groups/new">
        {t("createGroup")}
      </Link>
    </Button>
  </div>
)}
```

> **Kontextus a kondicionálisban:** A teljes ternary lánc: `matchStarted ? <started-view> : groups.length > 0 ? <BetForm> : topPublicGroups.length > 0 ? <suggestion> : <fallback>`.

- [ ] **Step 5: `PublicGroupDialog` renderelése a `Dialog` után**

A `return` statementben a `</Dialog>` után, de még a `</>` előtt add:

```tsx
{selectedPublicGroup && (
  <PublicGroupDialog
    group={selectedPublicGroup}
    memberCount={selectedPublicGroup.memberCount}
    open={!!selectedPublicGroup}
    onOpenChange={(open) => {
      if (!open) setSelectedPublicGroup(null);
    }}
  />
)}
```

Ha a `return` jelenleg egyetlen `<Dialog>...</Dialog>` (nem fragment), csomagold `<>...</>` fragmentbe.

- [ ] **Step 6: Build + lint ellenőrzés**

```bash
npm run build 2>&1 | tail -30
npm run lint 2>&1 | tail -20
```

Várt: 0 hiba.

- [ ] **Step 7: Manuális ellenőrzés**

Dev serveren ugyanazzal a test userrel:
- Kattints bármely meccskártyára → BetDialog megnyílik
- Ha van publikus csoport: 1 GroupCard + "Csoportok böngészése" gomb jelenik meg
- Ha nincs: "Még nincs aktív csoport..." + "Csoport létrehozása" gomb
- GroupCard-ra klikk → `PublicGroupDialog` nyílik a BetDialog fölé
- Join → `router.refresh()` → BetDialog bezárul, oldal újrarenderel bet formmal

- [ ] **Step 8: Commit**

```bash
git add src/components/bet-dialog.tsx
git commit -m "feat: show public group suggestion in bet dialog when user has no groups"
```

---

## Self-Review

**Spec coverage:**
- ✅ `getTopPublicGroupsForTournament` query (Task 2)
- ✅ Tournament page fetch + prop (Task 3)
- ✅ TournamentTabs prop threading (Task 4)
- ✅ GroupTokenSummary banner — 2 csoport + "böngészés" (Task 5)
- ✅ GroupTokenSummary fallback — "hozz létre egyet" (Task 5)
- ✅ BetDialog suggestion — 1 csoport + "böngészés" (Task 6)
- ✅ BetDialog fallback — "hozz létre egyet" (Task 6)
- ✅ `PublicGroupDialog` reuse + `router.refresh()` re-render (Task 5–6)
- ✅ i18n mindkét language (Task 1)

**Type consistency:**
- `PublicGroupSuggestion` exportálva Task 2-ben, importálva Task 3, 4, 5, 6-ban — konzisztens
- `topPublicGroups?: PublicGroupSuggestion[]` prop minden komponensben egyforma
- `GroupCard` propjai: `group`, `memberCount`, `variant="public"`, `onClick` — mind teljesül a `PublicGroupSuggestion` shape-pel
- `PublicGroupDialog` propjai: `group` (kell `tokenPerMatch`, `initialTokens`, stb.), `memberCount`, `open`, `onOpenChange` — mind teljesül
