# Per-meccs token rendszer — Design Spec

## Összefoglaló

A jelenlegi napi/round-alapú token kiosztást per-meccs modellre cseréljük. Minden meccs előtt X nappal Y tokent kap a játékos, csatlakozáskor Z indulótőkét + az addig kiosztott meccsek tokenjeit. A játékos a vetített egyenlege alapján előre is tippelhet meccsekre, amikre még nem kapott tokent.

## Motiváció

- **Arányos elosztás:** 1 meccses napon nem jár ugyanannyi mint 5 meccsesnél
- **Előre tippelés:** 30 nappal korábban is lehessen tippelni
- **Végig játékban tartás:** Nem kapja meg egyszerre az összes tokent, hanem fokozatosan
- **Késői csatlakozók:** Nem hátrányosak, megkapják a múltbeli meccsek tokenjeit is
- **Egyszerűsítés:** Carryover logika kiesik

## Új group beállítások

Létrehozáskor beállítva, utána **immutable** (a jelenlegi `tournament.status === "upcoming"` ellenőrzés marad):

| Mező | DB oszlop | Típus | Default | Leírás |
|---|---|---|---|---|
| Token per meccs | `token_per_match` | integer | 100 | Kiosztás meccsenként |
| Indulótőke | `initial_tokens` | integer | 200 | Egyszeri token csatlakozáskor |
| Kiosztás nappal előtte | `distribution_days_before` | integer | 3 | Hány nappal meccs előtt jön a kiosztás |

**Kieső mezők:** `token_per_round`, `carryover_percent`

## Token kiosztás logika

### Cron kiosztás (minden futásnál)

```
minden scheduled meccsre ahol (scheduledAt - now) <= distributionDaysBefore nap:
  minden group member-nek:
    ha NEM létezik (userId, groupId, type='distribution', referenceId=matchId):
      INSERT token_ledger: +tokenPerMatch, type='distribution', referenceId=matchId
```

- **Idempotencia:** `(userId, groupId, type, referenceId)` kombináció egyediség
- A `referenceId` innentől a match.id-t tárolja distribution típusnál (eddig NULL volt)

### Csatlakozáskor

```
1. INSERT token_ledger: +initialTokens, type='distribution', referenceId=NULL
2. Minden meccsre amire MÁR volt kiosztás a csoportban (bárki másnak):
     ha NEM létezik (userId, groupId, type='distribution', referenceId=matchId):
       INSERT token_ledger: +tokenPerMatch, type='distribution', referenceId=matchId
```

Így a késői csatlakozó pontosan annyi tokent kap, mint aki az elejétől benne volt. A múltbeli meccsekre nem tud tippelni, de a tokeneket felhasználhatja jövőbeli meccsekre.

## Vetített egyenleg (projected balance)

A tippelhető összeg **meccs-specifikus** és read-only (nem tárolódik):

```
projectedBalance(userId, groupId, matchId) =
    aktuális_egyenleg                               -- SUM(token_ledger.amount)
  + pendingDistributions × tokenPerMatch             -- meccsek amikre MÉG NEM kapott tokent,
                                                     -- DE a vizsgált meccs ELŐTT (vagy az) vannak
```

**Ahol:**
- `aktuális_egyenleg`: SUM(token_ledger.amount) — ez LEHET negatív ha a user előre fogadott vetített egyenlegből
- `pendingDistributions`: scheduled meccsek száma ahol `scheduledAt <= targetMatch.scheduledAt` ÉS nincs distribution ledger entry a userre (userId, groupId, matchId)

**Miért nincs külön "lekötve" tag?** Amikor a user tippel, a stake ledger entry-ként levonódik az aktuális egyenlegből. Ha vetített egyenlegből tippelt, az aktuális egyenleg negatívba mehet — ez rendben van, a következő distribution korrigálja.

### Validáció tippeléskor

A `placeBet` action a `projectedBalance`-t használja a `getTokenBalance` helyett:
```
if (projectedBalance(userId, groupId, matchId) < stake) → "Insufficient balance"
```

## UI változások

### Bet form (per-group szekció)

**Jelenleg** ([bet-form.tsx:192](src/components/bet-form.tsx#L192)):
```
{group.groupName}                    {group.balance} token
```

**Ezután:**
```
{group.groupName}          Tippelhető: {projectedBalance} ⓘ
```

Az ⓘ → Radix `Tooltip` (hover/tap):
```
Egyenleged:    100
Még kapsz:    +300 (3 × 100)
───────────────────
Tippelhető:    400
```

Ha az egyenleg negatív (mert előre fogadott):
```
Egyenleged:    −50
Még kapsz:    +300 (3 × 100)
───────────────────
Tippelhető:    250
```

- Ha nincs pending distribution → tooltip nem jelenik meg, csak a szám (projected = actual)
- Stake preset gombok és max a projectedBalance-hoz igazodnak
- Input max is projectedBalance

### Leaderboard

Változatlan — valós egyenleg (SUM ledger) marad.

### Group settings

- Új mezők: tokenPerMatch, initialTokens, distributionDaysBefore
- Kiesik: tokenPerRound, carryoverPercent
- Szerkesztés továbbra is csak `tournament.status === "upcoming"` esetén

## DB migráció

### groups tábla

```sql
ALTER TABLE groups ADD COLUMN token_per_match integer NOT NULL DEFAULT 100;
ALTER TABLE groups ADD COLUMN initial_tokens integer NOT NULL DEFAULT 200;
ALTER TABLE groups ADD COLUMN distribution_days_before integer NOT NULL DEFAULT 3;

-- Meglévő adatok migrálása
UPDATE groups SET token_per_match = token_per_round;

ALTER TABLE groups DROP COLUMN token_per_round;
ALTER TABLE groups DROP COLUMN carryover_percent;
```

### token_type enum

A `carryover` típus megmarad az enumban (meglévő ledger entry-k miatt), de új entry nem jön létre vele.

## Érintett fájlok

| Fájl | Változás |
|---|---|
| `src/db/schema.ts` | groups: új oszlopok, régi drop. carryover enum marad |
| `src/app/api/cron/sync/route.ts` | `distributeTokensForTournament` → per-meccs logika |
| `src/actions/groups.ts` | `distributeInitialTokens` → initialTokens + catch-up. `updateGroupSettings` → új mezők |
| `src/actions/bets.ts` | `placeBet` validáció → projected balance |
| `src/queries/groups.ts` | Új `getProjectedBalance(userId, groupId, matchId)` |
| `src/lib/tokens.ts` | `calculateCarryover` kiesik, projected balance helper jön |
| `src/components/bet-form.tsx` | Tippelhető + Radix Tooltip UI |
| `src/components/group-detail-tabs.tsx` | Settings: új mezők, régi kiesik |
| `messages/hu.json`, `messages/en.json` | Új i18n kulcsok (tippelhető, tooltip szövegek, settings labels) |

## Edge case-ek

1. **Meccs törlődik amire már volt distribution:** A ledger entry-k maradnak (a tokenek elkölthetők más meccsekre). Nincs teendő.
1b. **Meccs törlődik amire MÉG NEM volt distribution, de valaki a vetítéséből már más meccsre tippelt:** A várt kiosztás elmarad, a user "túlköltött" állapotba kerülhet (aktuális egyenleg negatívabb mint tervezett). A tétek más meccsekre szólnak, nem vonhatók vissza automatikusan. Nem kezeljük külön — ritka eset, a user kevesebb tokennel gazdálkodik egy ideig, a következő kiosztások fokozatosan korrigálják.
2. **Meccs törlődik amire már volt tét:** Refund mint eddig (stake visszajön).
3. **User csatlakozik és rögtön tippel egy távoli meccsre:** A projected balance tartalmazza az összes pending distribution-t addig a meccsig — működik.
4. **Két user tippel ugyanazon a meccsen, egyiknek elfogynak a tokenek:** Mindenki a saját projected balance-ét látja, nincs verseny a tokenekért.
5. **distributionDaysBefore = 0:** Token kiosztás a meccs napján (azonnali). Előre tippelés vetített egyenleggel továbbra is működik.
