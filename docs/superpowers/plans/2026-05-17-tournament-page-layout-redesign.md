# Tornaoldal layout redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/tournaments/[slug]` oldalon a meccs accordion a lehető legmagasabbra kerül: a "Hivatalos" csoport kártya egy csukható, egysoros "ribbon"-ná zsugorodik, a két tab sor (Meccsek/Dobogós + Közelgő/Lejátszott/Mind) eggyé olvad össze (4 elem), és a "Hivatalos" felirat mindenhol "Ranglista"-ra cserélődik.

**Architecture:** Egy új `OfficialGroupRibbon` kliens komponens helyettesíti a régi `OfficialGroupCard`-ot, inline localStorage perzisztenciával a nyit/csuk állapothoz. A `TournamentTabs`-ből kikerül a Shadcn `Tabs` wrapper; helyette egy 4 elemű filter sor jön, ahol a "Dobogós tipp" gomb mode-switch-et csinál (PodiumForm a MatchCard-ok helyett). A "Ranglista" átnevezés érinti a `OFFICIAL_GROUP_NAME` konstanst, a fenntartott slug listát, az i18n kulcsokat és egy manuálisan futtatandó adat-SQL-t a meglévő tornákra.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Shadcn UI, next-intl, Drizzle ORM (Neon Postgres), Vitest (csak `src/lib/**` pure logika tesztre — komponens viselkedés manuális dev-server ellenőrzéssel).

---

## File Structure

**Új fájlok:**
- `src/components/official-group-ribbon.tsx` — egysoros, csukható csík; inline `useEffect` + `localStorage` a default állapot perzisztálásához
- `scripts/rename-official-to-ranglista.sql` — egyszeri `UPDATE` SQL a meglévő `groups.name = 'Hivatalos'` sorokra

**Módosított fájlok:**
- `src/lib/official-group.ts` — `OFFICIAL_GROUP_NAME` és `RESERVED_OFFICIAL_SLUGS` átírása
- `tests/lib/official-group.test.ts` — új teszt esetek a `ranglista` reserved slug-ra
- `src/components/tournament-tabs.tsx` — felső `Tabs` eltávolítása, 4-elemes filter sor, `OfficialGroupRibbon` import csere, `view === "podium"` ág
- `messages/hu.json` — `officialBadge` törlés, `officialGroupNameReserved`/`cannotDeleteOfficial`/`cannotLeaveOfficial` érték-frissítés, új `officialRibbon` és `podiumTab` kulcsok
- `messages/en.json` — ugyanazok angolul

**Törölt fájlok:**
- `src/components/official-group-card.tsx`

---

### Task 1: Backend rename — DB konstans + reserved slug + unit teszt

**Files:**
- Modify: `src/lib/official-group.ts:8-15`
- Modify: `tests/lib/official-group.test.ts`

- [ ] **Step 1.1: Bővítsd a reserved slug tesztet**

Add hozzá a meglévő `tests/lib/official-group.test.ts` fájlhoz egy új test esetet a `describe("isReservedOfficialSlug", ...)` blokkon belül (új `it` blokk a fájl végén lévő záró `});` elé):

```ts
it("returns true for 'ranglista'", () => {
  expect(isReservedOfficialSlug("ranglista")).toBe(true);
});
```

És bővítsd ki a `RESERVED_OFFICIAL_SLUGS contains both languages` assertion-t mindkét nyelvre + `ranglista`-ra:

```ts
it("RESERVED_OFFICIAL_SLUGS contains all reserved values", () => {
  expect(RESERVED_OFFICIAL_SLUGS).toContain("hivatalos");
  expect(RESERVED_OFFICIAL_SLUGS).toContain("official");
  expect(RESERVED_OFFICIAL_SLUGS).toContain("ranglista");
});
```

Ehhez cseréld le a meglévő `it("RESERVED_OFFICIAL_SLUGS contains both languages", ...)` blokkot a fenti változatra.

- [ ] **Step 1.2: Futtasd a tesztet és nézd meg, hogy elbukik**

Run: `npm run test -- tests/lib/official-group.test.ts`
Expected: FAIL — "returns true for 'ranglista'" és a `RESERVED_OFFICIAL_SLUGS contains all reserved values` is bukik, mert a "ranglista" jelenleg nincs a listán.

- [ ] **Step 1.3: Írd át a konstansokat**

A `src/lib/official-group.ts` 8-11 sora most:

```ts
export const OFFICIAL_GROUP_NAME = "Hivatalos";
export const OFFICIAL_GROUP_SLUG = "hivatalos";

export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official"] as const;
```

Cseréld le erre:

```ts
export const OFFICIAL_GROUP_NAME = "Ranglista";
export const OFFICIAL_GROUP_SLUG = "hivatalos";

export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official", "ranglista"] as const;
```

(A `OFFICIAL_GROUP_SLUG` szándékosan marad `hivatalos` — a meglévő URL-ek stabilitása miatt.)

- [ ] **Step 1.4: Futtasd újra a tesztet, nézd meg, hogy átmegy**

Run: `npm run test -- tests/lib/official-group.test.ts`
Expected: PASS — minden teszt zöld.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/official-group.ts tests/lib/official-group.test.ts
git commit -m "refactor(official-group): rename 'Hivatalos' to 'Ranglista' and reserve slug"
```

---

### Task 2: Adat-SQL script meglévő tornákra

**Files:**
- Create: `scripts/rename-official-to-ranglista.sql`

- [ ] **Step 2.1: Hozd létre a SQL script-et**

Új fájl: `scripts/rename-official-to-ranglista.sql`

```sql
-- One-shot data migration: rename existing official groups from 'Hivatalos' to 'Ranglista'.
-- Run once per environment (dev + production) via Neon SQL editor or psql.
-- Idempotent: only updates rows that still have the old name.
UPDATE groups
SET name = 'Ranglista'
WHERE is_official = true
  AND name = 'Hivatalos';
```

A script-et szándékosan **nem** futtatjuk a `db:migrate` workflow-n keresztül, mert ez nem séma-változás. Manuálisan futtatandó dev és prod környezetben az implementáció befejezése után (lásd Task 7).

- [ ] **Step 2.2: Commit**

```bash
git add scripts/rename-official-to-ranglista.sql
git commit -m "chore(scripts): SQL to rename existing official groups to 'Ranglista'"
```

---

### Task 3: i18n kulcsok frissítése (hu + en)

**Files:**
- Modify: `messages/hu.json` (lines ~179-186 a `groups` blokkban; új `tournaments.officialRibbon` és `tournaments.podiumTab` blokkok)
- Modify: `messages/en.json` (ugyanazok angolul)

- [ ] **Step 3.1: Frissítsd a `messages/hu.json` `groups` blokk vonatkozó sorait**

A jelenlegi sorok 179-185 között így néznek ki:

```json
"officialBadge": "Hivatalos",
"viewDetails": "Részletek",
"myRank": "Helyezésed",
"myProfit": "Profitod",
"officialGroupNameReserved": "Ez a név fenntartva a hivatalos csoportoknak",
"cannotDeleteOfficial": "Hivatalos csoport nem törölhető",
"cannotLeaveOfficial": "Hivatalos csoportból nem lehet kilépni",
```

Cseréld le erre (az `officialBadge` sor törölve, a három "official"-os érték újrafogalmazva):

```json
"viewDetails": "Részletek",
"myRank": "Helyezésed",
"myProfit": "Profitod",
"officialGroupNameReserved": "Ez a név fenntartva a ranglistának",
"cannotDeleteOfficial": "A ranglista nem törölhető",
"cannotLeaveOfficial": "A ranglistából nem lehet kilépni",
```

- [ ] **Step 3.2: Adj hozzá új kulcsokat a `messages/hu.json` `tournaments` blokkjához**

A `tournaments` blokk (39-65. sor) végéhez, a `"createGroup": "Csoport létrehozása"` után, vesszővel zárva tedd hozzá:

```json
"officialRibbon": {
  "expand": "Ranglista mutatása",
  "collapse": "Ranglista elrejtése",
  "rankAndProfit": "#{rank} · {profit}"
},
"podiumTab": {
  "submitted": "Leadva",
  "locked": "Lezárva"
}
```

Vagyis a `createGroup` sor után új vesszős sor lesz: `"createGroup": "Csoport létrehozása",` és utána jönnek az új objektumok. A `tournaments` záró `}` után vessző marad (mert vannak további blokkok, `matches`, `betting`, stb.).

- [ ] **Step 3.3: Frissítsd a `messages/en.json` ugyanezen sorait**

A 179-185 sorok angol megfelelői:

```json
"viewDetails": "Details",
"myRank": "Your rank",
"myProfit": "Your profit",
"officialGroupNameReserved": "This name is reserved for the leaderboard",
"cannotDeleteOfficial": "The leaderboard group cannot be deleted",
"cannotLeaveOfficial": "Cannot leave the leaderboard group",
```

(Az `officialBadge` sort törölni kell.)

És a `tournaments` blokk végéhez, a `"createGroup": "Create group"` után:

```json
"officialRibbon": {
  "expand": "Show leaderboard",
  "collapse": "Hide leaderboard",
  "rankAndProfit": "#{rank} · {profit}"
},
"podiumTab": {
  "submitted": "Submitted",
  "locked": "Locked"
}
```

- [ ] **Step 3.4: Ellenőrizd a JSON szintaxist**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/hu.json', 'utf8')); JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('OK')"`
Expected: `OK` kiírás. Ha bármelyik JSON hibás, állj meg és javítsd a hiányzó/extra vesszőt.

- [ ] **Step 3.5: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "i18n: rename 'Official' to 'Leaderboard', add ribbon and podium tab keys"
```

---

### Task 4: Új komponens — `OfficialGroupRibbon`

**Files:**
- Create: `src/components/official-group-ribbon.tsx`

- [ ] **Step 4.1: Hozd létre az új komponens fájlt**

Új fájl: `src/components/official-group-ribbon.tsx`

```tsx
"use client";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "tipper:officialRibbon:open";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface OfficialGroupRibbonProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
  unbettedCount: number;
}

export function OfficialGroupRibbon({
  groupName,
  groupSlug,
  tournamentSlug,
  oddsBoost,
  myProfit,
  myRank,
  miniLeaderboard,
  currentUserId,
  unbettedCount,
}: OfficialGroupRibbonProps) {
  const t = useTranslations("groups");
  const tTournaments = useTranslations("tournaments");

  // SSR: always start closed to avoid hydration mismatch. Sync from localStorage in effect.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setOpen(true);
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }

  const rankDisplay = myRank ? `#${myRank}` : "—";

  return (
    <div className="overflow-hidden rounded-lg border-2 border-amber-500/40 bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? tTournaments("officialRibbon.collapse") : tTournaments("officialRibbon.expand")}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-500/5"
      >
        <Crown className="size-5 shrink-0 text-amber-500" />
        <span className="font-mono text-sm">
          <span className="font-bold">{rankDisplay}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold text-amber-500">{myProfit}</span>
        </span>
        {unbettedCount > 0 ? (
          <span className="flex items-center gap-1.5 text-amber-600 text-xs dark:text-amber-400">
            <CircleAlert className="size-3.5" />
            {tTournaments("unbettedMatches", { count: unbettedCount })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-600 text-xs dark:text-emerald-400">
            <CircleCheck className="size-3.5" />
            {tTournaments("allBetsPlaced")}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Link
            href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden text-xs hover:text-foreground sm:inline"
          >
            {t("viewDetails")} →
          </Link>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-amber-500/20 border-t bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{groupName}</span>
            <span className="text-muted-foreground">
              · {t("oddsBoost")}: <span className="font-mono text-amber-500">×{oddsBoost}</span>
            </span>
          </div>
          {miniLeaderboard.length > 0 && (
            <div className="flex flex-col gap-1">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Néhány design döntés magyarázata:
- A komponens **gombként** működik a teljes csukott állapot — kattintható területen `<Link>` viszont `e.stopPropagation()`-tel megakadályozza a button-toggle viselkedést.
- Mobile-on (`< sm`) a `Részletek →` link rejtett (`hidden sm:inline`).
- `try/catch` a `localStorage.setItem`-en, mert privát módban vagy storage-quota hibánál nem szabad a UI-t hibáztatnia.
- `aria-expanded` és `aria-label` a screen reader-ek miatt.

- [ ] **Step 4.2: Build check (TypeScript)**

Run: `npx tsc --noEmit`
Expected: NINCS típus hiba. Ha hiba van, javítsd (pl. `Link` importálás `@/i18n/navigation`-ből, `useTranslations` `next-intl`-ből).

A komponens még nincs sehol használva — ez normális; a Task 5-ben fogjuk importálni.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/official-group-ribbon.tsx
git commit -m "feat(ribbon): add collapsible OfficialGroupRibbon component"
```

---

### Task 5: `TournamentTabs` átalakítása — egyetlen filter sor + ribbon csere

**Files:**
- Modify: `src/components/tournament-tabs.tsx`

- [ ] **Step 5.1: Cseréld le az import sorokat**

A `src/components/tournament-tabs.tsx` 5-16 sorai (jelenlegi importok) közül módosítsd / távolítsd el a következőket:

Régi:
```ts
import { OfficialGroupCard } from "@/components/official-group-card";
...
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

Új (a `Tabs/TabsContent/TabsList/TabsTrigger` sor törölve, helyette `OfficialGroupRibbon` import + a `lucide-react`-ből új ikonok):

```ts
import { Check, Lock } from "lucide-react";
import { OfficialGroupRibbon } from "@/components/official-group-ribbon";
...
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
```

(A `Tabs/TabsContent/TabsList/TabsTrigger` import sor teljesen törölve.)

- [ ] **Step 5.2: Bővítsd ki a `MatchFilter` típust**

Találd meg a `type MatchFilter = "upcoming" | "played" | "all";` sort (93. sor) és cseréld le:

```ts
type MatchFilter = "upcoming" | "played" | "all" | "podium";
```

- [ ] **Step 5.3: Cseréld a return JSX-et új struktúrára**

A `return ( <> ... </> )` blokk (254-388. sorok) helyére tedd be ezt a teljes JSX struktúrát. **NE** törölj komponens importot vagy state hook-ot a fájl elejéről — csak a return blokkot cseréld:

```tsx
return (
  <>
    {officialCard && (
      <div className="mb-4">
        <OfficialGroupRibbon
          groupName={officialCard.groupName}
          groupSlug={officialCard.groupSlug}
          tournamentSlug={officialCard.tournamentSlug}
          oddsBoost={officialCard.oddsBoost}
          myProfit={officialCard.myProfit}
          myRank={officialCard.myRank}
          miniLeaderboard={officialCard.miniLeaderboard}
          currentUserId={currentUserId}
          unbettedCount={officialUnbettedCount}
        />
      </div>
    )}

    {filter !== "podium" && (
      <GroupTokenSummary
        groups={groupCardData}
        currentUserId={currentUserId}
        topPublicGroups={topPublicGroups}
        hasOfficialGroup={!!officialCard}
      />
    )}

    {/* Unified filter row */}
    <div className="my-4 flex gap-1 rounded-lg bg-muted p-1">
      <button
        type="button"
        onClick={() => setFilter("upcoming")}
        className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
          filter === "upcoming"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {tMatches("upcoming")}
      </button>
      <button
        type="button"
        onClick={() => setFilter("played")}
        className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
          filter === "played"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {tMatches("played")}
      </button>
      <button
        type="button"
        onClick={() => setFilter("all")}
        className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
          filter === "all"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {tMatches("all")}
      </button>
      <button
        type="button"
        onClick={() => setFilter("podium")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
          filter === "podium"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{t("podium")}</span>
        {existingPodiumBet ? (
          <Check
            className="size-3.5 text-emerald-600 dark:text-emerald-400"
            aria-label={tTournaments("podiumTab.submitted")}
          />
        ) : isLocked ? (
          <Lock
            className="size-3.5 text-muted-foreground"
            aria-label={tTournaments("podiumTab.locked")}
          />
        ) : null}
      </button>
    </div>

    {filter === "podium" ? (
      <div className="flex flex-col gap-4">
        <PodiumForm
          tournamentId={tournamentId}
          teams={teams}
          existingBet={existingPodiumBet}
          isLocked={isLocked}
        />
      </div>
    ) : filteredDays.length === 0 ? (
      <p className="py-8 text-center text-muted-foreground">{tMatches("noMatches")}</p>
    ) : (
      <Accordion type="multiple" defaultValue={initialOpen} className="flex flex-col gap-2">
        {filteredDays.map((day) => (
          <AccordionItem key={day.dateKey} value={day.dateKey} className="border-none">
            <AccordionTrigger className="rounded-lg bg-muted px-4 py-2.5 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{day.label}</span>
                <span className="text-muted-foreground text-xs">
                  {t("betProgress", {
                    betCount: day.matches.filter((m) =>
                      sortedGroupInfosByMatch[m.id]?.some((g) => g.existingBet),
                    ).length,
                    total: day.matches.length,
                  })}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {day.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    timezone={timezone}
                    onClick={() => handleMatchClick(match)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )}

    <BetDialog
      match={selectedMatch}
      groups={
        selectedMatch
          ? (sortedGroupInfosByMatch[selectedMatch.id] ?? []).map((g) => ({
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
  </>
);
```

Néhány észrevétel:
- A `useTranslations("tournaments")`-et a 138. sorban `const t = useTranslations("tournaments");`-ben deklarált `t` használja. **De** a "Dobogós tipp" gombhoz a `tTournaments("podiumTab.submitted")` kifejezés a "tournaments" namespace alól megy — itt zavar lehet, mert `t` már a "tournaments" namespace-é. Ellenőrizd a 138-140. sort:

  ```ts
  const t = useTranslations("tournaments");
  const tMatches = useTranslations("matches");
  ```

  Tehát `t("podium")` = "Dobogós tipp", és `t("podiumTab.submitted")` = "Leadva". Az új JSX-ben **ne** használj külön `tTournaments`-et — használd a meglévő `t`-t mindenhol, ahol "tournaments" namespace kell. Cseréld a kódban a `tTournaments(...)` hivatkozásokat `t(...)`-ra:

  - `tTournaments("podiumTab.submitted")` → `t("podiumTab.submitted")`
  - `tTournaments("podiumTab.locked")` → `t("podiumTab.locked")`

  (A komponens elejéről a `tTournaments` változó nem létezik, csak `t` és `tMatches`.)

- [ ] **Step 5.4: Korrigáld a `tTournaments` referenciákat**

Találd meg a JSX-ben a `tTournaments(...)` kifejezéseket és cseréld le mindegyiket `t(...)`-ra. Ellenőrizd, hogy csak két helyen van:
- `aria-label={tTournaments("podiumTab.submitted")}` → `aria-label={t("podiumTab.submitted")}`
- `aria-label={tTournaments("podiumTab.locked")}` → `aria-label={t("podiumTab.locked")}`

- [ ] **Step 5.5: TypeScript ellenőrzés**

Run: `npx tsc --noEmit`
Expected: NINCS hiba. Ha hiba van: `Tabs` import maradt valahol (törlöd), vagy `tTournaments` még szerepel (cseréld `t`-re), vagy `MatchFilter` típushiba (a 142. sorban `useState<MatchFilter>("upcoming")` változatlan kell legyen — de a típus most már elfogadja `"podium"`-ot is).

- [ ] **Step 5.6: Lint**

Run: `npm run lint`
Expected: nincs hiba a `tournament-tabs.tsx`-en.

- [ ] **Step 5.7: Commit**

```bash
git add src/components/tournament-tabs.tsx
git commit -m "feat(tournament-tabs): unify filter row, swap to OfficialGroupRibbon"
```

---

### Task 6: Régi `OfficialGroupCard` törlése

**Files:**
- Delete: `src/components/official-group-card.tsx`

- [ ] **Step 6.1: Ellenőrizd, hogy a régi komponensre nincs élő hivatkozás**

Run: `grep -rn "OfficialGroupCard\|official-group-card" /Users/kratam/dev/tipper/src /Users/kratam/dev/tipper/tests 2>/dev/null`
Expected: csak magában a `src/components/official-group-card.tsx` fájlban van match (azon belül a `export function OfficialGroupCard` definíció). Ha máshol is van match, állj meg és cseréld le ott is `OfficialGroupRibbon`-ra; a Task 5-ben elvileg ezt már megtettük a `tournament-tabs.tsx`-ben, de ellenőrizni kell.

- [ ] **Step 6.2: Töröld a fájlt**

Run: `rm /Users/kratam/dev/tipper/src/components/official-group-card.tsx`

- [ ] **Step 6.3: Build sanity check**

Run: `npx tsc --noEmit`
Expected: nincs hiba (megerősítve, hogy semmi más nem hivatkozik a régi komponensre).

- [ ] **Step 6.4: Commit**

```bash
git add -u src/components/official-group-card.tsx
git commit -m "chore: remove obsolete OfficialGroupCard component"
```

(A `-u` flag jeleníti meg a törlést a stage-ben.)

---

### Task 7: Build, lint, dev-szerver manuális ellenőrzés

**Files:** (nincs új fájl, csak verifikáció)

- [ ] **Step 7.1: Teljes build**

Run: `npm run build`
Expected: sikeres build, nincs TypeScript hiba.

- [ ] **Step 7.2: Lint az egész projekten**

Run: `npm run lint`
Expected: nincs új lint hiba. (Auto-fix ami nem szándékozott változás → revert.)

- [ ] **Step 7.3: Vitest teljes futtatás**

Run: `npm run test`
Expected: az összes teszt zöld, beleértve a Task 1-ben módosított `tests/lib/official-group.test.ts`-t is.

- [ ] **Step 7.4: Dev server indítása**

Run (background-ban vagy külön terminálban): `npm run dev`
Várj amíg a "Ready in X ms" üzenet megjelenik.

- [ ] **Step 7.5: Böngészős manuális ellenőrzés**

Nyisd meg: http://localhost:3000/hu/tournaments/jegkorong-vb-2026

Ellenőrizd:
1. **Ribbon csukott állapot:** Korona + `#9 · -186` + figyelmeztetés/all-bets-placed üzenet + (asztal) "Részletek →" link + chevron. NEM látszik a "Hivatalos" szöveg vagy badge.
2. **Ribbon kattintás:** lenyílik a panel — látszik a "Ranglista" név + `×1.1` odds szorzó + 3 soros mini leaderboard. Második kattintásra csukódik.
3. **localStorage perzisztencia:** nyisd ki, frissítsd az oldalt — nyitva marad. Csukd be, frissítsd — csukva marad.
4. **Filter sor:** 4 gomb egy sorban (Közelgő / Lejátszott / Mind / Dobogós tipp). NINCS külön felső "Meccsek / Dobogós tipp" tab.
5. **Dobogós tipp tab:** kattintásra a meccs accordion eltűnik, a PodiumForm jelenik meg. Ha már van podium bet → zöld pipa a tab címke mellett.
6. **Csoport detail oldal:** menj a `/hu/tournaments/jegkorong-vb-2026/groups/hivatalos` URL-re. A cím továbbra is "Hivatalos" — **ezt a Task 8-ban a SQL futtatással fogjuk "Ranglista"-vá tenni.**
7. **Mobile nézet:** `< 640px` szélességen a ribbon `Részletek →` link eltűnik, a chevron jelez. A filter sor 4 gomb `flex-1`-el, "Dobogós tipp" felirat kicsit szűkebben fér.

Ha bármelyik ellenőrzés bukik, megállsz, dokumentálod a hibát és visszatérsz a releváns Task lépéséhez.

- [ ] **Step 7.6: Ha minden rendben, állítsd le a dev servert**

---

### Task 8: SQL futtatása dev és prod környezetben (kézi lépés)

**Files:** (manuális műveletek)

- [ ] **Step 8.1: Futtasd a SQL-t a Neon dev branch-en**

Megoldási opciók (válassz egyet):

**A) Neon Console UI:** Lépj be a https://console.neon.tech/ → `patient-leaf-69938778` projektre → `dev` branch → SQL Editor → másold be és futtasd:

```sql
UPDATE groups SET name = 'Ranglista' WHERE is_official = true AND name = 'Hivatalos';
```

**B) `psql` CLI:** `psql $DATABASE_URL_DEV -f scripts/rename-official-to-ranglista.sql`

Expected: `UPDATE N` (N = a dev branch-en lévő official csoportok száma).

- [ ] **Step 8.2: Verifikáció dev-en**

Nyisd meg újra a `/hu/tournaments/jegkorong-vb-2026/groups/hivatalos` URL-t a dev környezetben. A cím most már "Ranglista". A ribbon nyitott állapotában a `groupName` is "Ranglista".

- [ ] **Step 8.3: Production deploy**

A frontend deploy elé (vagy közvetlenül utána, de minél hamarabb) futtasd ugyanazt a SQL-t a `production` Neon branch-en:

```sql
UPDATE groups SET name = 'Ranglista' WHERE is_official = true AND name = 'Hivatalos';
```

Expected: `UPDATE N` a prod-on.

**Sorrend:** a kód deploy és a SQL futtatás között rövid átmeneti időszakban a frontend a `groupName`-et "Hivatalos"-ként rendereli (DB-ből), míg a ribbon UI design már az újat tükrözi. Ez nem hibás állapot, csak átmenetileg furcsa — a SQL futtatás után konzisztens lesz.

- [ ] **Step 8.4: Verifikáció production-on**

Nyisd meg a https://tippcasino.vercel.app/hu/tournaments/jegkorong-vb-2026/groups/hivatalos URL-t. "Ranglista" jelenik meg.

---

## Self-Review

**Spec coverage:**
- Slim ribbon csukott/nyitott + localStorage → Task 4
- Egyetlen 4-elemes filter sor (Közelgő/Lejátszott/Mind/Dobogós tipp) → Task 5
- "Dobogós tipp" tab ✓/🔒 állapotjelzők → Task 5 (Step 5.3 a `<Check>` és `<Lock>` ikonokkal)
- "Hivatalos" → "Ranglista" DB konstans → Task 1
- `RESERVED_OFFICIAL_SLUGS` bővítés `ranglista`-val → Task 1
- DB migration (data SQL) → Task 2 + futtatás Task 8
- i18n értékek frissítése + új kulcsok → Task 3
- `OFFICIAL_GROUP_SLUG` változatlan → Task 1 (explicit kommenttel)
- Régi komponens törlése → Task 6
- Verifikáció build/lint/teszt + manuális → Task 7

**Placeholder scan:** nincs TBD, TODO, "implement later", "fill in details", "appropriate error handling" — minden lépésben konkrét kód vagy parancs van.

**Type consistency:**
- `OfficialGroupRibbon` props (Task 4) megegyezik a `OfficialCardData` interface mezőivel a `tournament-tabs.tsx`-ben (Task 5 Step 5.3 import + render).
- `MatchFilter` típus `"podium"` ággal bővítve a Task 5 Step 5.2-ben, és a `setFilter("podium")` hívás konzisztens a Step 5.3-ban.
- A "tournaments" namespace alól `t("podiumTab.submitted")` és `t("podiumTab.locked")` — mindkettő Task 3-ban definiálva (`messages/hu.json` és `messages/en.json`).
- `t("officialRibbon.expand")` / `.collapse` — Task 3-ban definiálva, Task 4-ben hivatkozva.

**Risk recap:**
- Production deploy és SQL futtatás közötti átmeneti állapot — Task 8 Step 8.3 explicit kezeli.
- Hydration mismatch a localStorage miatt — Task 4 inline `useEffect` pattern-nel kezelve (SSR mindig `closed`).
