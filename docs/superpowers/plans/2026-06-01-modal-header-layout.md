# Modál header layout + vízszintes scoreboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bet-dialog mindhárom állapota (tippelhető / lejátszott / élő) egy közös, szimmetrikus fejlécet (dátum + X) és egy közös vízszintes scoreboard-sort használjon; a close-X soha ne lógjon tartalom fölé, és minden modál kattintással zárható legyen.

**Architecture:** Egy új, tisztán prezentációs `MatchScoreboard` komponens rendereli a `[zászló] [közép] [zászló]` sort, a nevekkel alatta. A `center` slot állapotonként más (függőleges léptetők / eredmény / ÉLŐ). A close-X térközt a `DialogHeader` adja konvencióként. Nincs generikus `Modal`/`ModalHeader` absztrakció — a shadcn `Dialog*` primitívek maradnak.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind v4, shadcn/radix Dialog, next-intl, lucide-react.

**Tesztelési mód:** A projektnek nincs komponens-teszt infrastruktúrája (Vitest `node` env, coverage csak `src/lib/**`, nincs `.test.tsx`). A CLAUDE.md szerint TDD csak a pure logikára kötelező. Ez a változás tisztán prezentációs, nincs kiemelhető pure logika → a kapu minden taskban `npx tsc --noEmit` + `npm run check`, a végén vizuális ellenőrzés. Nem vezetünk be testing-library-t (YAGNI, idegen a kódbázistól).

## File Structure

- **Create:** `src/components/match-scoreboard.tsx` — a vízszintes scoreboard sor (zászlók + center slot + nevek). Egyetlen felelősség, prezentációs.
- **Modify:** `src/components/bet-form.tsx` — `ScoreStepper` függőlegesre; a kártya-grid helyett `MatchScoreboard`; odds-sor alá kerül.
- **Modify:** `src/components/bet-dialog.tsx` — dátum-header minden állapotban; a lejátszott/élő zászló-grid-cím helyett `MatchScoreboard` a body tetején; `Badge`/`pr-8` eltűnik.
- **Modify:** `src/components/ui/dialog.tsx` — `DialogHeader` alapból `pr-8` (X-térköz).
- **Modify:** `src/components/help-dialog.tsx` — a kézi `pr-8` elhagyása.
- **Modify:** `src/components/public-group-dialog.tsx` — fehér X a gradient headerbe.

---

### Task 1: `MatchScoreboard` komponens

**Files:**
- Create: `src/components/match-scoreboard.tsx`

- [ ] **Step 1: Hozd létre a komponenst**

```tsx
import type { ReactNode } from "react";
import { TeamLogo } from "@/components/team-logo";

interface MatchScoreboardProps {
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  /** Középső elem a két zászló közé: léptetők, eredmény vagy ÉLŐ jelzés. */
  center: ReactNode;
  /** Zászló mérete pixelben. */
  logoSize?: number;
}

/**
 * Vízszintes meccs-scoreboard sor: [zászló] [közép] [zászló], a csapatnevek a
 * zászlók alatt. A `center` slot a hívótól függ (tippelhető → léptetők,
 * lejátszott → eredmény, élő → ÉLŐ jelzés). Tisztán prezentációs, nincs üzleti
 * logika — a BetForm és a BetDialog közösen használja.
 */
export function MatchScoreboard({ homeTeam, awayTeam, center, logoSize = 40 }: MatchScoreboardProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-x-3 gap-y-1.5">
      <TeamLogo name={homeTeam.name} logoUrl={homeTeam.logoUrl} size={logoSize} />
      <div className="flex items-center justify-center">{center}</div>
      <TeamLogo name={awayTeam.name} logoUrl={awayTeam.logoUrl} size={logoSize} />
      <span className="text-center font-medium text-xs leading-tight">{homeTeam.name}</span>
      <div />
      <span className="text-center font-medium text-xs leading-tight">{awayTeam.name}</span>
    </div>
  );
}
```

- [ ] **Step 2: Típus- és lint-ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes (a komponens még nincs használva — ez rendben van, exportált, nem dead code a következő taskok után).

- [ ] **Step 3: Commit**

```bash
git add src/components/match-scoreboard.tsx
git commit -m "feat(ui): add MatchScoreboard component for shared match header row"
```

---

### Task 2: `ScoreStepper` függőleges (chevron) elrendezés

**Files:**
- Modify: `src/components/bet-form.tsx:55-75`

- [ ] **Step 1: Cseréld le a `ScoreStepper` függvényt**

A `+` a szám fölött, a `–` alatta. A meglévő `Minus`/`Plus` import marad.

```tsx
function ScoreStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="flex h-5 w-8 items-center justify-center rounded-md bg-muted/80 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        aria-label="+1"
      >
        <Plus className="size-3" />
      </button>
      <span className="w-7 text-center font-bold font-mono text-2xl leading-none tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-5 w-8 items-center justify-center rounded-md bg-muted/80 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        aria-label="-1"
      >
        <Minus className="size-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Típus- és lint-ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes.

- [ ] **Step 3: Commit**

```bash
git add src/components/bet-form.tsx
git commit -m "refactor(bet-form): vertical chevron layout for ScoreStepper"
```

---

### Task 3: BetForm a `MatchScoreboard`-ra

**Files:**
- Modify: `src/components/bet-form.tsx:187-241` (a `Card` → `CardContent` első blokkja)

- [ ] **Step 1: Importáld a `MatchScoreboard`-ot**

A meglévő import-blokkba (a `TeamLogo` import után):

```tsx
import { MatchScoreboard } from "@/components/match-scoreboard";
```

- [ ] **Step 2: Cseréld le a match-header blokkot**

A jelenlegi `<div className="flex flex-col items-center gap-2 px-5 pt-1 pb-4"> … </div>` (a grid-es logók/nevek/léptetők/odds) helyére:

```tsx
        <div className="flex flex-col items-center gap-3 px-5 pt-1 pb-4">
          <MatchScoreboard
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            center={
              <div className="flex items-center gap-2">
                <ScoreStepper value={homeScore} onChange={setHomeScore} />
                <span className="font-mono text-lg text-muted-foreground">:</span>
                <ScoreStepper value={awayScore} onChange={setAwayScore} />
              </div>
            }
          />
          {odds ? (
            <div className="flex justify-center gap-2">
              {[
                { label: "1", value: odds.homeOdds, outcome: "1" },
                { label: "X", value: odds.drawOdds, outcome: "X" },
                { label: "2", value: odds.awayOdds, outcome: "2" },
              ].map((o) => (
                <div
                  key={o.label}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-sm transition-colors ${
                    predictedOutcome === o.outcome
                      ? "bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/40"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] opacity-50">{o.label}</span>
                  <span className="font-semibold">{o.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-amber-500 text-xs">{tMatches("oddsNotAvailable")}</p>
          )}
        </div>
```

- [ ] **Step 3: Töröld a feleslegessé vált importokat**

Ha a `TeamLogo` már sehol nem használt a `bet-form.tsx`-ben (a `MatchScoreboard` veszi át), töröld a `TeamLogo` importot. Ellenőrizd a `Card`/`CardContent` használatát — maradnak (a külső wrapper marad). Futtasd a lint-et, ami jelzi a használatlan importot.

Run: `npm run check`
Expected: a Biome jelzi és/vagy javítja a használatlan `TeamLogo` importot; egyébként hibamentes.

- [ ] **Step 4: Típusellenőrzés**

Run: `npx tsc --noEmit`
Expected: hibamentes.

- [ ] **Step 5: Commit**

```bash
git add src/components/bet-form.tsx
git commit -m "refactor(bet-form): use MatchScoreboard, move odds below scoreboard"
```

---

### Task 4: bet-dialog — közös dátum-header + scoreboard

**Files:**
- Modify: `src/components/bet-dialog.tsx`

- [ ] **Step 1: Importáld a `MatchScoreboard`-ot, töröld a `Badge`-et**

A `TeamLogo` import törölhető, ha már nem használt (a header-grid megszűnik). Add hozzá:

```tsx
import { MatchScoreboard } from "@/components/match-scoreboard";
```

Töröld: `import { Badge } from "@/components/ui/badge";` és a `TeamLogo` importot (ha máshol nincs használva a fájlban).

- [ ] **Step 2: A `DialogHeader` egységesítése**

A teljes `<DialogHeader>…</DialogHeader>` blokkot (a `showBetForm`-os elágazással együtt) cseréld erre — a dátum minden állapotban a header, a `pr-8` itt már nem kell (a `DialogHeader` adja):

```tsx
          <DialogHeader>
            <DialogTitle className="sr-only">
              {match.homeTeam.name} – {match.awayTeam.name}
            </DialogTitle>
            <MatchDateTime
              scheduledAt={match.scheduledAt}
              timeZone={timeZone}
              className="font-mono text-[11px] text-muted-foreground"
            />
            <DialogDescription className="sr-only">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </DialogHeader>
```

- [ ] **Step 3: Vezesd be a scoreboard-center és a body-elágazást**

A `DialogHeader` után a `const odds = …` és `renderGroupSection` definíciók maradnak. A `showScore` marad (`finished` + van eredmény). A `showBetForm` változó törölhető (a body közvetlenül a feltételt használja). Add hozzá a center-t a `renderGroupSection` elé:

```tsx
  const scoreboardCenter = showScore ? (
    <span className="font-bold font-mono text-2xl tabular-nums">
      {match.homeScore} : {match.awayScore}
    </span>
  ) : match.status === "live" ? (
    <span className="flex items-center gap-1.5 font-semibold text-base text-red-500">
      <Circle className="size-2 animate-pulse fill-red-500 text-red-500" />
      {t("live")}
    </span>
  ) : (
    <span className="text-muted-foreground/40 text-xs tracking-[0.15em]">{t("vs")}</span>
  );
```

- [ ] **Step 4: Cseréld le a body conditionalt**

A jelenlegi body conditional (`{!match.participantsKnown ? … : matchStarted ? … : groups.length > 0 ? <BetForm/> : …}`) helyére. A BetForm a saját scoreboardját mutatja; minden más participantsKnown ág a `MatchScoreboard`-ot kapja a tetején:

```tsx
          {!match.participantsKnown ? (
            <p className="text-center text-muted-foreground text-sm">{t("participantsUnknown")}</p>
          ) : !matchStarted && groups.length > 0 ? (
            <BetForm
              matchId={match.id}
              groups={groups}
              odds={odds}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              onSuccess={groups.length <= 1 ? () => onOpenChange(false) : undefined}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <MatchScoreboard
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                center={scoreboardCenter}
              />
              {matchStarted ? (
                groupBetsData === undefined ? (
                  <p className="text-center text-muted-foreground text-sm">{t("loadingBets")}</p>
                ) : groupBetsData.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">{t("betLocked")}</p>
                ) : groupBetsData.length === 1 ? (
                  renderGroupSection(groupBetsData[0])
                ) : (
                  <Tabs defaultValue={groupBetsData[0].groupId} className="w-full">
                    <TabsList className="w-full flex-wrap">
                      {groupBetsData.map((group) => (
                        <TabsTrigger key={group.groupId} value={group.groupId}>
                          {group.groupName}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {groupBetsData.map((group) => (
                      <TabsContent key={group.groupId} value={group.groupId} className="pt-1">
                        {renderGroupSection(group)}
                      </TabsContent>
                    ))}
                  </Tabs>
                )
              ) : topPublicGroups.length > 0 ? (
                <>
                  <p className="text-muted-foreground text-sm">{tTournaments("noGroupYetShort")}</p>
                  <GroupCard
                    group={topPublicGroups[0]}
                    memberCount={topPublicGroups[0].memberCount}
                    variant="public"
                    onClick={() => setSelectedPublicGroup(topPublicGroups[0])}
                  />
                  <Button variant="outline" size="sm" asChild className="w-full gap-2">
                    <Link href="/groups">
                      <Users className="size-4" />
                      {tTournaments("browseGroups")}
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">{tTournaments("noPublicGroup")}</p>
                  <Button variant="outline" size="sm" asChild className="w-full gap-2">
                    <Link href="/groups/new">{tTournaments("createGroup")}</Link>
                  </Button>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 5: Típus- és lint-ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes. Ha a `showBetForm` vagy `TeamLogo` használatlan maradt, töröld.

- [ ] **Step 6: Commit**

```bash
git add src/components/bet-dialog.tsx
git commit -m "refactor(bet-dialog): unified date header + MatchScoreboard for all states"
```

---

### Task 5: `DialogHeader` X-térköz konvenció

**Files:**
- Modify: `src/components/ui/dialog.tsx:74-78`
- Modify: `src/components/help-dialog.tsx:32`

- [ ] **Step 1: `DialogHeader` kapjon alap `pr-8`-at**

`src/components/ui/dialog.tsx`, a `DialogHeader`:

```tsx
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2 pr-8", className)} {...props} />
  );
}
```

- [ ] **Step 2: Töröld a help-dialog kézi `pr-8`-ját**

`src/components/help-dialog.tsx`, a `DialogHeader`:

```tsx
        <DialogHeader>
```

(a korábbi `className="pr-8"` elhagyva)

- [ ] **Step 3: Típus- és lint-ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/help-dialog.tsx
git commit -m "refactor(ui): reserve close-button space in DialogHeader by default"
```

---

### Task 6: public-group-dialog — fehér X

**Files:**
- Modify: `src/components/public-group-dialog.tsx:11` (import), `:87-98` (gradient header)

- [ ] **Step 1: Importok bővítése**

A lucide importhoz add hozzá az `X`-et, és a dialog importhoz a `DialogClose`-t:

```tsx
import { UserPlus, X } from "lucide-react";
```

```tsx
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
```

- [ ] **Step 2: Tedd a gradient headert `relative`-vé és adj hozzá fehér X-et**

A `{/* Gradient header */}` div nyitását cseréld, és tedd be a `DialogClose`-t első gyerekként:

```tsx
        {/* Gradient header */}
        <div className="relative bg-linear-to-br from-[#1e3a5f] to-[#2d1b69] p-6">
          <DialogClose className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogTitle className="pr-8 font-bold text-lg text-white">{group.name}</DialogTitle>
```

(A `DialogTitle` kap egy `pr-8`-at, hogy hosszú csoportnév ne lógjon az X alá.)

- [ ] **Step 3: Típus- és lint-ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes.

- [ ] **Step 4: Commit**

```bash
git add src/components/public-group-dialog.tsx
git commit -m "feat(public-group-dialog): add close button in gradient header"
```

---

### Task 7: Vizuális ellenőrzés és záró build

**Files:** nincs (verifikáció)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: sikeres production build, hibamentes.

- [ ] **Step 2: Vizuális ellenőrzés dev szerveren**

Run: `npm run dev`
Ellenőrizd a böngészőben (egy csoportos és egy több-csoportos meccsen):
- **Tippelhető meccs:** dátum-header + X; vízszintes scoreboard zászlókkal, középen a függőleges chevron-léptetők (`+` fönt, szám, `–` lent), `:` középen; odds-sor a scoreboard alatt; nevek a zászlók alatt.
- **Lejátszott meccs:** ugyanaz a dátum-header + X; scoreboard `6 : 0`-val középen; nincs „Vége" badge; alatta Tippek/Statisztika tabok + ranglista.
- **Élő meccs:** scoreboard középen piros, pulzáló `ÉLŐ` (nincs eredmény).
- **Szimmetria:** egyik zászló sincs oldalra tolva; az X nem lóg tartalom fölé.
- **public-group-dialog:** fehér X jobb felül, kattintásra zár.
- **help / display-name dialog:** cím nem lóg az X alá.

Expected: minden pont teljesül.

- [ ] **Step 3: Záró ellenőrzés**

Run: `npx tsc --noEmit && npm run check`
Expected: hibamentes.

---

## Self-Review

**Spec coverage:**
- Vezérelv „X soha nem lóg tartalom fölé" → Task 5 (DialogHeader pr-8) + Task 4 (header átszervezés) + Task 6 (public-group X). ✓
- Közös vízszintes scoreboard mindhárom állapotra → Task 1 (komponens) + Task 3 (betform) + Task 4 (dialog). ✓
- `MatchScoreboard` center slot (léptető / `6 : 0` / `ÉLŐ`) → Task 3 (léptető), Task 4 (`scoreboardCenter`). ✓
- Függőleges chevron léptetők (A variáns) → Task 2. ✓
- „Vége" badge el, `Badge` import törölve → Task 4 (Step 1, Step 4). ✓
- `showScore` csak `finished` → Task 4 (a meglévő `showScore` változatlan marad; a fájl már így tartalmazza). ✓
- public-group fehér X, `showCloseButton={false}` marad → Task 6. ✓
- help/display-name nincs funkcionális változás (csak help `pr-8` törlés) → Task 5. ✓
- Nincs `Modal`/`ModalHeader`, nincs livescore → egyik task sem vezeti be. ✓

**Placeholder scan:** Nincs TBD/TODO; minden lépés tartalmaz konkrét kódot vagy parancsot. ✓

**Type consistency:** `MatchScoreboard` propjai (`homeTeam`, `awayTeam`, `center`, `logoSize`) végig egyezően használva (Task 3, Task 4). A `homeTeam`/`awayTeam` alakja (`{ name, logoUrl }`) megegyezik a `match.homeTeam` és a BetForm prop alakjával. A `center: ReactNode` befogad span/div tartalmat. ✓
