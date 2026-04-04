# Odds Boost — Design Spec

**Dátum:** 2026-04-04
**Cél:** Passzív játékosok hátrányba kerüljenek az aktív tippelőkkel szemben, anélkül hogy explicit büntetést kapnának.

## Koncepció

Csoportonként konfigurálható odds szorzó (`oddsBoost`), ami a piaci oddsokat megsokszorozza a payout számításnál. Ez a tippelést pozitív várható értékűvé teszi: ha az odds fair, a várható hozam `1 × oddsBoost` (pl. 1.2× boost → 20% pozitív EV). Aki nem tippel, megtartja a tokenjeit, de az aktív játékosok idővel elhúznak.

**Pozitív framing:** nem büntetés a passzivitásért, hanem jutalom az aktivitásért ("boosted odds").

## DB változás

Új oszlop a `groups` táblán:

```sql
ALTER TABLE groups ADD COLUMN odds_boost real DEFAULT 1.0 NOT NULL;
```

- Típus: `real` (Drizzle: `real("odds_boost")`)
- Default: `1.0` (nincs boost — visszafelé kompatibilis)
- Értéktartomány: `1.0` – `3.0`
- Validáció: server action szinten

## Scoring logika

### `src/lib/scoring.ts` — `calculateBetPayout`

A `groupSettings` interface kap egy `oddsBoost: number` mezőt.

Módosított payout formula:

```
payout = Math.round(stake × oddsAtBet × oddsBoost)
```

A bónuszokra (goalDiff, exactScore) a boost **nem** hat — azok fix token összegek:

```
finalPayout = Math.round(stake × oddsAtBet × oddsBoost) + goalDiffBonus + exactScoreBonus
```

### `src/app/api/cron/sync/route.ts` — `scoreMatch`

Az `oddsBoost` értéket a `bet.group`-ból vesszük (a Drizzle relation már betölti), és átadjuk a `calculateBetPayout`-nak:

```typescript
groupSettings: {
  bonusGoalDiff: bet.group.bonusGoalDiff,
  bonusExactScore: bet.group.bonusExactScore,
  oddsBoost: bet.group.oddsBoost,
}
```

## Server Actions

### `src/actions/groups.ts`

- `CreateGroupInput`: új opcionális `oddsBoost?: number` mező
- `GroupSettings`: új opcionális `oddsBoost?: number` mező
- Validáció: `1.0 ≤ oddsBoost ≤ 3.0`
- `updateGroupSettings`: csak "upcoming" versenysorozatnál engedélyezett (meglévő guard)

## UI

### Csoport létrehozás (`create-group-form.tsx`)

Új input az advanced settings-ben:
- Label: `t("groups.oddsBoost")` — "Odds szorzó" / "Odds boost"
- Input type: `number`, step: `0.1`, min: `1.0`, max: `3.0`
- Default: `1.0`

### Csoport beállítások (`group-detail-tabs.tsx`)

Ugyanaz az input a settings tab-on. Szerkeszthető amíg a versenysorozat "upcoming" (meglévő guard).

### Meccs/tipp felület

**Változatlan.** A piaci oddsok jelennek meg, nem a boostolt oddsok — mivel a boost csoportonként eltérő, a meccsoldal nem tud releváns boosted odds-ot mutatni.

## i18n

```json
// hu.json
"oddsBoost": "Odds szorzó"

// en.json
"oddsBoost": "Odds boost"
```

## Tesztek

### `tests/lib/scoring.test.ts`

Új tesztesetek:
- **oddsBoost 1.0:** payout változatlan (regresszió)
- **oddsBoost 1.5:** `stake=100, odds=2.0` → `payout = round(100 × 2.0 × 1.5) = 300`
- **oddsBoost + bónuszok:** bónuszok nem szorzódnak (pl. `300 + 5 + 10 = 315`)
- **Helytelen tipp + oddsBoost:** payout továbbra is 0

## Ami NEM változik

- `bets.oddsAtBet` — továbbra is a piaci odds kerül mentésre
- Tipp felületen megjelenített odds — marad a piaci odds
- Fix bónuszok (goalDiff, exactScore, podium) — nem szorzódnak
- Token kiosztás logika — független az odds boost-tól
- Leaderboard számítás — a payout már a boostolt összeget tartalmazza

## Migrációs terv

1. Drizzle schema módosítás (`schema.ts`)
2. `npx drizzle-kit generate` → migráció generálás
3. `npx drizzle-kit migrate` → migráció futtatás (Neon)
4. Meglévő csoportok `odds_boost = 1.0` → változatlan viselkedés
