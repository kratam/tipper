# Klasszikus (token nélküli) pontozás a Tipp-táblán

> **Dátum:** 2026-07-06
> **Státusz:** jóváhagyott terv, implementációra vár
> **Típus:** UI-bővítés + pure logika + egy szerver-aggregáció — **séma-változás nélkül**

## Motiváció

A játék token-alapú (odds-szal súlyozott tét, nyeremény/veszteség). A játékosok
kíváncsiak, **hogyan állnának egy hagyományos tippjátékban, tokenek nélkül** —
ahol csak a tippek pontossága számít, tét és tokenveszteség nélkül. Ez egy
alternatív, „mi lett volna, ha" nézet a meglévő adatokból.

## Pontlogika

Meccsenként **0–3 pont**, kizárólag a tipp pontossága alapján:

| Feltétel | Pont |
|---|---|
| Eltalált **kimenet** (1/X/2) | +1 |
| Eltalált **gólkülönbség** | +1 |
| **Pontos eredmény** | +1 |

A `get1X2` matematikájából ezek egymásra épülnek: a gólkülönbség-találat mindig
maga után vonja a kimenet-találatot, a pontos eredmény pedig mindkettőt. Így a
lehetséges pontszámok tiszták:

- **3** — pontos eredmény
- **2** — jó gólkülönbség (de nem pontos)
- **1** — csak jó kimenet
- **0** — rossz kimenet

**Nincs token, nincs tét, nincs veszteség, nincs odds.** **Csak meccs-tippek** —
a dobogó- (podium) tippek nem számítanak bele (azok token-specifikus extrák
maradnak).

### Adatforrás — nincs séma-változás

A pontozó cron (`scoreMatch`) a `bets` táblába meccsenként már eltárolja a három
találat-flaget: `result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect`
(mindhárom `boolean | null`, `null` = még nem pontozott). A klasszikus pont
ezekből egy összeadás:

```
classicPoints = (result1x2Correct ? 1 : 0)
              + (goalDiffCorrect  ? 1 : 0)
              + (exactScoreCorrect ? 1 : 0)
```

Ez pontosan párhuzamos a token-nettóval (`payout − stake`): mindkettő a
**lepontozott** tippből jön, és mindkettő ugyanarra a scoring-cron lefutására
vár. Lepontozatlan (flag `null`) tipp kimarad — épp úgy, mint most a token-net.

## Megjelenítés: A1 kapcsoló a Tipp-táblán

A Tipp-tábla (`tip-matrix.tsx`) egy mátrix: soronként egy játékos, oszloponként a
forduló egy meccse, a cellákban a tippelt eredmény + egy al-szám, jobb szélen egy
**Σ összeg-oszlop**, ami egyben rangsorol.

Ez már **félig ranglista**, és **már van benne egy kapcsoló**: a Σ fejléce
váltja a `scope`-ot (`total` ↔ `round`). Az új funkció egy **második, független
kapcsoló** a bal-felső sarok-cellában (az „A1" cella — a játékos-oszlop
sticky fejléce):

```
Tipp-tábla                           Σ[ total ▾ ]   ← scope (megvan)
┌─ ◉ Token │ Klasszikus ─┐                          ← MÓD (új, A1 sarok)
│ Játékos  │ SWE │ FIN │ CAN │  Σ  │
├──────────┼─────┼─────┼─────┼─────┤
│ Anna     │ 2:1 │ 3:0 │ 1:1 │     │
│          │ +3  │ +1  │  0  │ 12  │   ← klasszikus módban: 0–3 pont
│ Béla     │ 1:2 │ 2:2 │ 0:0 │     │
│          │ +2  │  0  │ +1  │  9  │
└──────────┴─────┴─────┴─────┴─────┘
```

### A két kapcsoló független

| | | |
|---|---|---|
| **Mód** (A1 sarok) | Token \| Klasszikus | *mit* pontozunk |
| **Scope** (Σ fejléc) | total \| forduló | *milyen tartományon* |

Mind a négy kombináció értelmes, és a scope-kapcsoló változatlanul működik
mindkét módban.

### Mit vált a mód

| | Cella al-szám | Σ oszlop + sorrend |
|---|---|---|
| **Token** (mostani) | nettó `payout − tét` (zöld `text-win` / piros `text-loss`, előjeles) | token-profit |
| **Klasszikus** (új) | 0–3 pont | klasszikus pontösszeg |

- A cella **tippelt eredménye** a meglévő `predictionToneClass` szerint már
  színezett (telitalálat / gólkülönbség / kimenet / hibás) — ez **változatlan**
  marad. Csak az **al-szám** vált token-nettóról 0–3 pontra.
- Klasszikus al-szám színe: a pont sosem negatív; javasolt a semleges/arany
  hangolás a token zöld/piros helyett (a pontos érték a tone-color a tippen már
  látszik). Lepontozatlan tipp al-száma `…` (mint most a token-nél).

### Adatforrás a Σ-hez és a rangsorhoz

Tükrözi a jelenlegi token-megoldás felépítését:

- **Cella + `round` scope Σ + `round` sorrend:** kliens-oldalról, a mátrixba már
  beolvasott forduló-tippek flagjeiből (`round.bets` → `result1x2Correct` +
  `goalDiffCorrect` + `exactScoreCorrect`). Ugyanaz az út, mint a `betNet` összeg
  most.
- **`total` scope Σ + `total` sorrend:** új szerver-aggregáció, `classicLeaderboard`:
  userenként `SUM((result1x2Correct)::int + (goalDiffCorrect)::int +
  (exactScoreCorrect)::int)` a csoport `finished` meccsű, lepontozott tippjeire.
  Ugyanúgy prop-ként érkezik, ahogy a token `leaderboard.profit` most.

**Holtverseny:** pont csökkenő, majd `userName` növekvő (egyszerű, determinisztikus).
Ez a `round`-ág mostani `sort`-jával konzisztens rank-konvenció (`index + 1`).

## A mód-választás megjegyzése

A `scope` marad komponens-állapot (reset navigációkor, ahogy most). A **mód**
viszont **localStorage-ban** perzisztálódik, **közös kulccsal** a csoport- és
kör-mátrix közt (pl. `tipmatrix:mode`), hogy a két felület egyezzen és a
választás túléljen egy navigációt/újratöltést. Default: `token` (a jelenlegi
viselkedés).

## Érintett egységek

| Egység | Változás | Teszt |
|---|---|---|
| `src/lib/scoring.ts` | új pure `classicPointsFromFlags({result1x2Correct, goalDiffCorrect, exactScoreCorrect}): number \| null` (`null`, ha bármely flag `null`) | Vitest (`tests/lib/scoring.test.ts`) |
| `src/lib/tip-matrix.ts` | `buildMatrixRows` kap `mode: "token" \| "classic"` paramétert; klasszikus `total` (a `classicLeaderboard` prop értékéből) és `round` (flag-összegből) ág; a token-ágak változatlanok | Vitest (`tests/lib/tip-matrix.test.ts`) |
| új query (`src/queries/…`) | `classicLeaderboard(groupId)` — flag-összeg aggregáció, csoport- és kör-szinten (mint a meglévő `getGroupLeaderboard` / `circle-leaderboard`) | — |
| `src/components/tip-matrix.tsx` | A1 sarok mód-kapcsoló; `renderCell` és a Σ/rank a `mode` szerint; localStorage-perzisztálás; új `classicLeaderboard` prop | — |
| `src/components/group-detail-tabs.tsx`, `circle-detail-tabs.tsx` | a `classicLeaderboard` prop átadása a `TipMatrix`-nak | — |
| a group/circle **page.tsx**-ek | `classicLeaderboard` lekérés + prefetch (a meglévő leaderboard mellett) | — |
| `messages/hu.json`, `messages/en.json` | mód-címkék (`Token` / `Klasszikus`), rövid magyarázó tooltip a pontozásról | — |

## Nem cél (YAGNI)

- **Nincs** külön „Klasszikus" tab — a klasszikus mátrix (Σ + sorrend + cellánkénti
  bontás) magában foglalja a rangsort, informatívabban, mint egy külön lista lenne.
- **Nincs** dobogó-pont a klasszikus nézetben.
- **Nincs** új DB-tábla, oszlop vagy ledger-írás — minden a meglévő `bets`
  flagekből számol.
- **Nincs** külön odds-boost / token-szabály hatás (a klasszikus mód definíció
  szerint token-mentes).

## Ismert korlát

A `total`-Σ és a per-cella/`round` pont egyaránt a **lepontozott** tippekből
számol, tehát egy `finished`, de a scoring-cron által még fel nem dolgozott
meccs átmenetileg 0-ként/`…`-ként jelenik meg. Ez pontosan ugyanaz az
eventual-consistency ablak, mint a jelenlegi token-nézeté; a cron gyorsan lefut,
így átmeneti.
