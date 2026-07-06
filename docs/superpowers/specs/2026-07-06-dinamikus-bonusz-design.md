# Dinamikus gólkülönbség / pontos eredmény bónusz

**Dátum:** 2026-07-06
**Státusz:** jóváhagyott terv (implementáció előtt)

## Probléma

A meccs-bónuszok (gólkülönbség, pontos eredmény) fix token-értékek: alapból
`bonusGoalDiff = +30`, `bonusExactScore = +50` (a hivatalos csoportban). A játék
elején, amikor kevés token volt forgalomban, ez arányos jutalom volt. A torna
vége felé viszont a tétek és nyeremények elérik az 1000–10000-es nagyságrendet,
így a fix +80 gyakorlatilag jelentéktelen — nem jutalmazza érdemben a
gólkülönbség/pontos eredmény eltalálását.

**Cél:** a bónusz mérete kövesse a játékban lévő tokenmennyiséget, hogy a torna
minden szakaszában arányos maradjon, de úgy, hogy ne borítsa fel a tabellát. A
bónusz **ne** függjön az egyéni tét nagyságától (a tét a meccs egyértelműségét is
tükrözi, nem csak a magabiztosságot).

## Megoldás áttekintés

A fix bónusz-értékeket **dinamikus, poolból osztott** bónuszra cseréljük:

- Meccsenként és **csoportonként** kiszámolunk egy **pool-alapot** = a meccsre
  tippelő aktív játékosok addig felhalmozott „vagyonának" (lifetime budget)
  összege.
- A pool a bázis egy százaléka: külön **gólkülönbség-pool** (`P_gd`) és
  **pontos-eredmény-pool** (`P_ex`).
- Minden pool **fix keret**, amit **egyenlően szétosztunk** az adott szint
  találói között. Több találó → kisebb fejenkénti bónusz (önszabályozó: sosem
  minteledik több, mint a pool `P%`-a).
- A két pool **halmozható**: aki a pontos eredményt eltalálta (⊆ gólkülönbség),
  mindkét poolból részesedik — a jelenlegi logikát megőrizve.

### Kulcsdöntés: miért lifetime budget, nem a nyers egyenleg

Kalibrációkor kiderült, hogy a nyers „szabad egyenleg" (`SUM(token_ledger.amount)`)
mid-torna **torzított**: a játékosok a jövőbeli meccsekre is tehetnek tétet (a
projektált budget alapján), a `bet` ledger-sor azonnal levonódik, miközben a
jövőbeli per-meccs token-osztás még nincs a ledgerben. Emiatt a nyers egyenleg
összege korán akár **negatív** is lehet (a valós adaton −10 000-ig).

Ezért a pool-alap az egyes játékosok **lifetime budgetje**:

```
initialTokens + tokenPerMatch × (nem-törölt meccsek, dátum ≤ M dátuma)
             + Σ (payout − stake) a játékos M-nél korábbi, lepontozott tippjeire
```

Ez mindig pozitív, a torna során monoton nő, és pontosan a „játékban lévő
tokenek" fogalmát ragadja meg. (Ekvivalens a „nyers egyenleg + lekötött tétek"
képlettel, mert a lekötött tétek negatívja és pozitívja kiesik — de a
dátum-alapú definíció tisztább szemantikájú és eleve idempotens.)

## Kalibráció (valós prod adat, FIFA WC 2026, „Ranglista" csoport, 92 lepontozott meccs-cella)

Pool-alap (tiszta lifetime budget) eloszlása: min ~6 000, medián ~119 000,
max ~352 000. Nulla negatív cella.

Kontextus: a meccsek medián payoutja 178, p90 ≈ 1 078.

| P_gd / P_ex | GD/fő medián | EX/fő medián | EX telitalálat a saját meccse medián-payoutjához | Mintelt bónusz a meccs össz-payoutjának %-a (medián) |
|---|---|---|---|---|
| 1% / 2% | 213 | 703 | 3,6× | 12% |
| **2% / 3%** | **427** | **1 055** | **5,4×** | **22%** |
| 3% / 4% | 641 | 1 407 | 7,1× | 32% |

**Választott default: `P_gd = 2%`, `P_ex = 3%`** — jó egyensúly: mindkét bónusz
bőven a régi +30/+50 és a meccs medián-payoutja fölött (tehát számít), a
telitalálat kb. 5× egy tipikus meccs-nyeremény, és mediánban ~22%-kal told meg a
meccs kifizetéseit (érezhető, de nem dominál). A ritka, késői „jackpot"-ok
(magányos telitalálat nagy pool mellett, ~6 000–7 600) elfogadottak: a pontos
eredményt nehéz eltalálni, megérdemli.

**Plafon:** nincs. Tiszta fix-pool / találók-száma logika.

## Részletes terv

### 1. Adatmodell (séma)

A `groups` táblában:
- **Eldobjuk:** `bonus_goal_diff` (int), `bonus_exact_score` (int).
- **Hozzáadjuk:** `bonus_goal_diff_pct` (real, default `2`),
  `bonus_exact_score_pct` (real, default `3`). Az érték maga a százalék
  (`2` = 2%); `real`, hogy fél-százalék is állítható legyen.

A **dobogó**-bónuszok (`bonusPodiumMention`, `bonusPodiumExact`) **változatlanok**
— ez a változás csak a meccs-bónuszokra vonatkozik.

### 2. Pontozás — két fázis (pure függvények, `src/lib/scoring.ts`)

A jelenlegi `calculateBetPayout` tippenként pure, de a bónusz mostantól a meccs
összes találójától függ, ezért szétbontjuk:

- **`calculateBaseBetPayout(input)`** — pure, tippenként. Kimenet: alap-payout és
  a három flag (`result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect`).
  Bónusz **nélkül**. Alap-payout:
  - `oddsAtBet == null` → `partialRefund(stake, lossPercentage)`, minden flag
    `false`.
  - 1X2 rossz → `partialRefund(...)`, `goalDiff`/`exact` `false`.
  - 1X2 jó → `round(stake × oddsAtBet × oddsBoost)`, a flageket kiszámolja.

- **`computePoolBase({ initialTokens, tokenPerMatch, matchesToDate, bettorResolvedNets })`**
  — pure. `bettorResolvedNets: number[]` (tippelőnként a korábbi rendezett
  tét-nettók összege). Visszaad: `Σ (initialTokens + tokenPerMatch × matchesToDate + net)`.

- **`distributeBonusPools({ poolBase, goalDiffHitters, exactScoreHitters, gdPct, exPct })`**
  — pure. Visszaad:
  - `gdPerHitter = goalDiffHitters > 0 ? Math.floor(max(0, poolBase) × gdPct / 100 / goalDiffHitters) : 0`
  - `exPerHitter = exactScoreHitters > 0 ? Math.floor(max(0, poolBase) × exPct / 100 / exactScoreHitters) : 0`

### 3. `scoreMatch` refaktor (`src/lib/sync.ts`)

A `scoreMatch(matchId, homeScore, awayScore)` a pending tippeket **csoportonként**
dolgozza fel (a tokenek csoport-szintűek, egy meccsre több csoport is tippelhet):

1. Pending tippek betöltése a meccsre (`payout IS NULL`), csoportosítva `groupId`
   szerint.
2. Minden csoportra:
   a. Tippenként `calculateBaseBetPayout` → base payout + flagek.
   b. A meccs tippelőire kiszámoljuk a `computePoolBase` inputjait:
      - `matchesToDate` = nem-törölt torna-meccsek, amelyek dátuma ≤ M dátuma
        (a torna időzónájában, a `dateToDateNum` mintát követve).
      - `bettorResolvedNets` = tippelőnként `Σ (payout − stake)` az M-nél
        **korábbi dátumú**, lepontozott (`payout IS NOT NULL`) tippjeikből ebben
        a csoportban.
   c. `goalDiffHitters` / `exactScoreHitters` = a flagek alapján a találók száma.
   d. `distributeBonusPools(...)` a csoport `bonus_goal_diff_pct` /
      `bonus_exact_score_pct` értékeivel.
   e. Tippenként: `payout = basePayout + (goalDiff ? gdPerHitter : 0) + (exact ? exPerHitter : 0)`.
      Marad az atomikus `UPDATE ... WHERE payout IS NULL` claim és a `win`
      ledger-sor beszúrása (payout > 0 esetén), mint most.

**Idempotencia:** a pool-alap M saját tippjeitől/kifizetéseitől függetlenül
számol (dátum-alapú definíció), ezért újrapontozásra és párhuzamos
cron-futásokra is ugyanazt adja. Az atomikus claim biztosítja, hogy `win` sor
tippenként egyszer íródik.

### 4. Kerekítés + edge case-ek

- Fejenkénti bónusz: **lefelé kerekítés** (`Math.floor`); a maradék nem
  minteledik.
- 0 találó egy szinten → az a pool nem oszlik ki (0).
- 1X2 rossz / void tipp → partial refund, nincs bónusz.
- `poolBase ≤ 0` guard → bónusz 0 (a gyakorlatban nem fordul elő).

### 5. Migráció + mid-VB viselkedés

- Séma-változás **kizárólag** `db:generate` → `db:migrate` úton (CLAUDE.md), a
  migrációt kézzel futtatjuk deploy előtt (a Vercel build nem futtatja). A
  migráció eldobja a régi két oszlopot, hozzáadja a két pct-oszlopot
  (default 2 / 3). A régi token-értékeket **nem** konvertáljuk (token↔% nem
  egyértelmű).
- **Már lepontozott VB-meccsek érintetlenek:** a scoring egyszeri és idempotens
  (`payout IS NULL` szűrő), a régi +30/+50 benne marad a `bets.payout`-ban és a
  `win` ledger-sorokban. Deploy után minden **új** pontozás dinamikus. Nincs
  visszamenőleges átszámolás.
- `src/lib/official-group.ts` seed: `bonusGoalDiff: 30` / `bonusExactScore: 50`
  → `bonusGoalDiffPct: 2` / `bonusExactScorePct: 3`.
- A **klasszikus (token nélküli) pontozás** érintetlen (flag-alapú, +1/+1;
  `classicPointsFromFlags`).

### 6. UI / i18n

Frissítendő hivatkozások (`bonusGoalDiff` / `bonusExactScore` → pct):

- **Csoport-beállítás UI** (`src/components/group-detail-tabs.tsx`) és
  **létrehozás** (`src/components/create-group-form.tsx`): a két token-input
  helyett **%-input** megfelelő label/help szöveggel.
- **Szabály-megjelenítés** (`src/lib/group-rules.ts`, `buildRuleSections` +
  `GroupRules` típus): a `+30` formátum helyett `2%` / `3%`; a
  `bonusGoalDiff`/`bonusExactScore` sorok most a pct mezőket olvassák, és a
  magyarázat frissül (dinamikus, a meccs aktív tippelőinek vagyonából).
- Típusok + megjelenítés: `src/components/tournament-tabs.tsx`,
  `src/components/public-groups-section.tsx`,
  `src/components/public-group-dialog.tsx`.
- `src/queries/groups.ts`: `ProjectedBalanceResult` komment és a
  bónusz-hivatkozások frissítése (a bónusz továbbra is bele van sütve a
  `bets.payout`-ba, csak dinamikusan számolt).
- **i18n** (`messages/hu.json`, `messages/en.json`): `bonusGoalDiff` /
  `bonusExactScore` label-kulcsok szövege („… bónusz" → „… bónusz (%)"),
  a `howToPlayScoringDesc` és a csoport-magyarázó szövegek (`groupText` stb.)
  finomítása a dinamikus jelleghez. Minden magyar szöveg ékezetesen.

### 7. Tesztek (TDD)

- Új pure függvényekre egységtesztek (`src/lib/scoring.test.ts`):
  - `calculateBaseBetPayout`: void odds, 1X2 rossz (partial refund), 1X2 jó,
    gólkülönbség, pontos eredmény flagek.
  - `computePoolBase`: több tippelő, különböző resolved nettók, matchesToDate.
  - `distributeBonusPools`: 0 találó, 1 találó, több találó (osztás + kerekítés),
    stackelés, negatív poolBase guard.
- A meglévő `calculateBetPayout`-tesztek átírása az új szétbontásra (base +
  distribute külön).
- A `scoreMatch` csoport-szintű pool-logikájának integrációs jellegű tesztje, ha
  a meglévő sync-tesztstruktúra engedi.

## Nyitott kérdések

Nincs — minden döntés lezárva a brainstorming során.
