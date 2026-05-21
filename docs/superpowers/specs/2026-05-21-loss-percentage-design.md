# Csoport beállítás: vesztési százalék (lossPercentage)

**Dátum:** 2026-05-21
**Státusz:** Tervezés

## Cél

Új, csoportonként állítható beállítás: ha a játékos buk (1X2 rossz), a felrakott tét hány százalékát veszti el. Jelenleg ez fixen 100% — a feladat ezt konfigurálhatóvá tenni, hogy a csoportok adminjai "puhább" játékot is állíthassanak (pl. 10% stake-visszatérítés).

## Termékdöntések

- **Mező neve:** `lossPercentage` (integer, 0–100 inkluzív).
- **Jelentés:** 1X2 rossz → `payout = round(stake × (100 − lossPercentage) / 100)`.
  - `lossPercentage = 100` → payout = 0 (mai viselkedés).
  - `lossPercentage = 90` → payout = `round(stake × 0.1)` (10% visszatérítés).
  - `lossPercentage = 0` → payout = stake (teljes refund).
- **Új csoport default:** 90.
- **Meglévő csoport default:** 100 (migráció: `BACKFILL 100`, utána `SET DEFAULT 90`).
- **Hivatalos (official) csoport:** 90 (új defaultnak megfelelő).
- **Bónuszok:** Csak helyes 1X2-nél járnak — nem változik. Veszteségkor a `payout` kizárólag a részleges stake-refund.
- **`oddsAtBet IS NULL` (nincs odds):** Egységes "loss" kezelés — ugyanúgy a részleges refund jár, nem 0.
- **Retroaktivitás:** Nincs. Settings változtatás csak a jövőbeli scoringot érinti, korábbi resolved tippek nem újraszámolódnak — konzisztens a `bonusGoalDiff`/`oddsBoost` viselkedésével.

## Architektúra változások

### DB séma (`src/db/schema.ts`)

A `groups` tábla bővül:

```ts
lossPercentage: integer("loss_percentage").default(90).notNull(),
```

A `schema.ts`-ben `default(90)` szerepel — ez a jövőbeli `INSERT`-eknek készül. A meglévő rekordok 100-at kapnak a migráció backfill lépésében.

### Drizzle migráció

A `db:generate` által generált migrációt **kézzel módosítjuk** kétlépcsősre:

```sql
ALTER TABLE "groups" ADD COLUMN "loss_percentage" integer DEFAULT 100 NOT NULL;
ALTER TABLE "groups" ALTER COLUMN "loss_percentage" SET DEFAULT 90;
```

Indoklás: ha az `ADD COLUMN ... DEFAULT 90`-et hagynánk, minden meglévő csoport 90-et kapna — ami nem felel meg a követelménynek ("meglévő csoportoknál maradjon 100%"). A két lépés szétválasztja a backfill-t a future-default-tól.

Alkalmazás: lokálisan `npm run db:migrate`, prod-on Neon MCP `run_sql`-lel (deploy előtt — a Vercel build nem futtatja).

### Scoring (`src/lib/scoring.ts`)

`BetPayoutInput.groupSettings` kibővül `lossPercentage: number`-rel. A `calculateBetPayout` változás:

```ts
function calculatePartialRefund(stake: number, lossPercentage: number): number {
  return Math.round((stake * (100 - lossPercentage)) / 100);
}

// oddsAtBet === null esetén:
return {
  payout: calculatePartialRefund(stake, groupSettings.lossPercentage),
  result1x2Correct: false,
  goalDiffCorrect: false,
  exactScoreCorrect: false,
};

// 1X2 rossz esetén:
return {
  payout: calculatePartialRefund(stake, groupSettings.lossPercentage),
  result1x2Correct: false,
  goalDiffCorrect: false,
  exactScoreCorrect: false,
};
```

A helyes 1X2 ág nem változik.

### Sync (`src/lib/sync.ts`)

A 306. sor körüli `calculateBetPayout` hívás `groupSettings`-jébe bekerül `lossPercentage: bet.group.lossPercentage`. A `bet.group` Drizzle join már mindent visszaad — csak a típus bővül.

### Projected balance (`src/lib/tokens.ts`, `src/queries/groups.ts`)

**Nem igényel változást.** A cumulative budget már `payout − stake` net-tel számol:

```
netPayout = payout - stake
```

Részleges refundnál `payout = 10`, stake = 100 → `netPayout = −90`. A budget korlátja automatikusan ezzel a számmal lesz csökkentve, ami pontosan a tényleges (csökkentett) veszteséget tükrözi. Tehát a játékos visszanyert 10 tokenje újra elkölthető lesz.

### Server actions (`src/actions/groups.ts`)

`CreateGroupInput` és `UpdateGroupInput` típusokba `lossPercentage?: number`. Az `INSERT`/`UPDATE` mezőlistába is bekerül a megszokott `...(input.lossPercentage != null && { lossPercentage: input.lossPercentage })` mintával.

### UI

#### Új csoport form (`src/components/create-group-form.tsx`)

A `settings` state-be `lossPercentage: 90`. Új numerikus input (0–100, lépésköz=1) a "Bónuszok" / "Haladó" szekcióban, ahol a többi szabály van.

#### Csoport szerkesztés (`src/components/group-detail-tabs.tsx`)

Settings tab-on új input ugyanazzal a stílussal, mint a `bonusGoalDiff`/`bonusExactScore` mezők.

#### Csoport-ribbon és public dialog

- `src/components/public-group-dialog.tsx`: `RuleBox`-ba kerül egy új sor: `lossPercentage: 90%`.
- `src/components/official-group-ribbon.tsx`: ha helyhiány engedi, megjelenik (`vesztés: 90%`).
- `src/components/public-groups-section.tsx`, `src/components/tournament-tabs.tsx`: prop átvezetés.

#### Match card (`src/components/match-card.tsx`)

Jelenleg a `StakePill` győzelemnél a teljes `payout`-ot mutatja `+`-szal, ami **bugos** (pl. stake=100, payout=250 → `100→+250` ahelyett, hogy `100→+150`-et mutatna). Az új viselkedés: **mindig a netto változást mutatjuk**.

```tsx
if (isFinished && bet.payout != null) {
  const net = bet.payout - bet.stake;
  const sign = net > 0 ? "+" : net < 0 ? "" : "±";
  // net negatív értéke már tartalmazza a `-` előjelet
  return (
    <span className={`font-bold ${net > 0 ? "text-emerald-600" : net < 0 ? "text-destructive" : ""}`}>
      {bet.stake}→{sign}{net}
    </span>
  );
}
```

Példák:
- Nyer (stake=100, payout=250): `100→+150`
- Buk 10% refund-dal (payout=10): `100→-90`
- Buk 100% loss (payout=0): `100→-100`
- Full refund (payout=stake=100): `100→±0`
- Nem értékelt: `100`

A `line-through` áthúzás megszűnik — a `→` jelölés tisztább.

### Tournament page és group detail page passthrough

`src/app/[locale]/tournaments/[slug]/page.tsx` és `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`: az `oddsBoost`/`bonusGoalDiff` mellett `lossPercentage`-et is átadjuk minden gyermekkomponensnek, ahol szükséges.

### Hivatalos csoport (`src/lib/official-group.ts`)

Az `OFFICIAL_GROUP_DEFAULTS` (vagy ami most ott van) `lossPercentage: 90`-et kap. Ha már létezik official group adott tournament-re és a `loss_percentage` még 100 a backfill-ből, **nem nyúlunk hozzá automatikusan** (admin manuálisan módosíthatja, ha akarja) — konzisztens a megfogalmazással ("meglévőknél maradjon 100%").

### Translations (`messages/hu.json`, `messages/en.json`)

`groups` namespace alá:

- `lossPercentage` — "Vesztési %"  /  "Loss %"
- `lossPercentageDescription` — "Bukáskor a tét hány %-át veszíti el a játékos. 100% = teljes veszteség (default), 90% = 10%-ot visszakap."  /  "On loss, what percentage of the stake the player loses. 100% = full loss (default), 90% = 10% refunded."

## Tesztek

`tests/lib/scoring.test.ts`:

- **lossPercentage = 100, 1X2 rossz** → payout = 0 (régi viselkedés, regression guard).
- **lossPercentage = 90, stake=100, 1X2 rossz** → payout = 10.
- **lossPercentage = 90, stake=33, 1X2 rossz** → payout = 3 (kerekítés tesztje, `round(3.3) = 3`).
- **lossPercentage = 0, stake=100, 1X2 rossz** → payout = 100 (full refund edge).
- **lossPercentage = 90, oddsAtBet = null** → payout = 10 (egységes loss kezelés).
- **lossPercentage = 90, helyes 1X2** → payout változatlan (full win, bónuszokkal).
- **lossPercentage = 90, helyes 1X2 + exact score** → payout includes bonus, NEM additív a partial refund-dal.

`tests/lib/tokens.test.ts` (ha létezik): cumulative budget tesztet bővíteni resolved loss bet-re `payout = 10` net-tel — meggyőződni, hogy a `-90` netPayout helyesen csökkenti a maxBudgetet.

## Élesítés és kockázat

- **Backward kompat:** A meglévő csoportokon `lossPercentage = 100` → nincs viselkedésváltozás. Az új scoring logika `lossPercentage = 100`-nál `round(stake × 0 / 100) = 0`-t ad, ami pontosan a régi `payout = 0` ág.
- **Match-card UI változás:** A `100→+250` típusú megjelenítés bugos volt — az új `100→+150` helyes és konzisztens. A `bet-dialog.tsx` és a leaderboardok már most is `payout - stake` net-et mutatnak, tehát egységesedik.
- **Deploy sorrend:** (1) migráció kézi futtatása prod Neonon, (2) deploy. Ha fordítva fut, az új kód a `lossPercentage` mezőre hivatkozik egy nem létező oszlopon → 500-as hiba.
- **A `db:generate` ki fogja írni a migrációt `DEFAULT 90`-nel** — **emlékezni kell** rá, hogy a generált SQL-t kézzel kell átírni a kétlépcsős formára a commit előtt. Erről a `CLAUDE.md` is figyelmeztet (migrációkat kézzel kell futtatni).
