# Tipp-tábla (kompakt mátrix-ranglista) — terv

**Dátum:** 2026-06-20
**Állapot:** jóváhagyásra vár
**Kiindulás:** `docs/assets/Tipp ranglista.JPG` (egy hasonló játék „Prediction Overview" nézete — vízszintesen görgethető mátrix, soronként egy játékos, oszloponként egy meccs).

## 1. Cél

Egy **kompakt, vízszintesen görgethető mátrix-nézet** a csoport-oldalra, ahol egyszerre látszik **minden játékos minden tippje** egy fordulóra — a jelenlegi accordion-ranglista helyett, ahol a tippek csak egy-egy játékos kinyitásakor jönnek elő.

- **Sorok** = játékosok, az összesített egyenleg szerint rangsorolva.
- **Oszlopok** = a kiválasztott forduló meccsei (zászlók + valódi eredmény a fejlécben).
- **Cellák** = az adott játékos tippje az adott meccsre + a meccs nettó token-hozama.

Nincs séma-változás és nincs új pontozási logika — ez tisztán egy új **megjelenítési + lekérdezési** réteg a már tárolt adat fölött.

## 2. Hol jelenik meg

- **Új tab a csoport-oldalon**, és ez lesz az **alapértelmezett** tab.
  - Fájl: `src/components/group-detail-tabs.tsx`. Jelenleg `<Tabs defaultValue="leaderboard">`, tabok: `leaderboard` (`GroupLeaderboardContent`), `results` (`GroupResultsContent`), opcionálisan `settings`.
  - Hozzáadunk egy `matrix` tabot (`TabsTrigger` + `TabsContent`), és a `defaultValue`-t `"matrix"`-ra állítjuk. A meglévő „Ranglista" (accordion) és „Eredmények" tabok **megmaradnak** változatlanul.
  - Tab-állapot kliens-oldali (Radix `Tabs`), ezen nem változtatunk.
- **Kör-detail oldalon** (`tournaments/[slug]/circles/[circleSlug]`) ugyanez a mátrix, **csak olvasható** módban (a körön belül szűrt + újrarangsorolt sorokkal — lásd 9.3).

> **Tab elnevezés:** **„Tipp-tábla"** (eldöntve).

## 3. Adatmodell — mit használunk (nincs séma-változás)

Meglévő táblák (`src/db/schema.ts`): `bets`, `matches`, `teams`, `match_odds`, `group_members`, `token_ledger`. A cella minden adata a `bets` sorból jön:

- tipp: `predictedHome` / `predictedAway`
- tét: `stake`, lekötött odds: `oddsAtBet`
- eredmény-flagek: `result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect`
- kifizetés: `payout` (NULL, amíg nincs lepontozva)
- **nettó (a cella „pontja")** = `payout − stake` (csak lepontozott meccsnél; egyébként nincs)

A sor összesített `Σ` értéke = a ranglista `profit` (a `token_ledger` összege a befejezett/törölt meccsekre) — ez **megegyezik** a sor celláinak nettó-összegével, így a tábla önkonzisztens.

## 4. Megjelenítés — a tábla felépítése

Letisztult mockup: `.superpowers/brainstorm/.../table-final.html` (a brainstorm session). A „kaszinó" sötét téma tokenjeit használja (`globals.css @theme`), JetBrains Mono a számokra.

### 4.1 Oszlopok (balról jobbra)

1. **Játékos** — `rang.` + avatar + név. **Ez az egyetlen ragadós (sticky) oszlop** (`position: sticky; left: 0`). Mobilon **csak az avatar** látszik (a név CSS-breakpointtal elrejtve).
2. **`Σ`** — összesített egyenleg (a ranglista `profit`-ja), arany. **Nem sticky** — a meccs-oszlopokkal együtt görög.
3. **Meccs-oszlopok** — fordulónként, vízszintesen görgethető.

### 4.2 Fejléc (meccs-oszlop)

- **Zászlók egymás mellett** (hazai – vendég), alattuk:
  - **befejezett** meccs → valódi eredmény (`3:0`, arany),
  - **élő** meccs → **„ÉLŐ" jelzés, gólszám nélkül** (nincs élő eredmény-adat; a végeredmény csak lezáráskor jelenik meg),
  - **jövőbeli** meccs → kezdési idő (`ma 20:00`),
  - **törölt** meccs → „törölve".
- **Nincs** „statisztika"/„tippelés" felirat a fejlécben (helytakarékosság). A kattinthatóságot a kurzor + halvány hover jelzi.

Az állapotok az adatból: **befejezett** = `status = finished`; **élő** = lockolt (`scheduledAt <= now`), de még nem `finished`/`cancelled`; **jövőbeli** = `scheduledAt > now`; **törölt** = `status = cancelled`.

### 4.3 Cella (B-variáns: kétsoros)

- **Tipp fönt** (`2:1`), **nettó token lent** (`+180` / `−90`), kisebb betűvel.
- A **tipp színe** a találat minőségét jelzi — a meglévő `predictionToneClass` (`src/lib/bet-display.ts`):
  - telitalálat → **félkövér zöld** (`exactScoreCorrect`),
  - gólkülönbség → semibold zöld (`goalDiffCorrect`),
  - csak 1X2 → halvány zöld (`result1x2Correct`),
  - rossz tipp → halvány piros.
- A **nettó színe**: pozitív zöld, negatív piros, lepontozatlan (élő) → „…" halványan.
- **Nem tippelt** (lezárt meccsre) → `–` halványan.
- **Saját, jövőbeli tipp** → szaggatott arany keret (kiemelve, hogy ez szerkeszthető).

### 4.4 Saját sor + „ugorj rám" sáv

- A bejelentkezett user sora **arany kiemelés** (háttér + arany név).
- A mátrix alján **rögzített „ugorj rám" sáv**: `rang. · Név (te) · Σ · ⤓ gomb`. A `⤓` a saját sorra görget (`scrollIntoView`). Olvasható (nem tag) felhasználónál (kör read-only, nem tag) a sáv elrejtve.

## 5. Forduló-navigáció

- A `matches.round` szabad szöveges mező. A meccseket **fordulóba csoportosítjuk**, a fordulókat a bennük lévő legkorábbi `scheduledAt` szerint rendezzük.
- A mátrix **egy fordulót** mutat egyszerre; a fejléc-sávban **← / →** lapozás a fordulók közt (mint a referenciaképen).
- **Alapértelmezett forduló:** a **legkésőbbi forduló, amelyben már van elkezdődött meccs** (`scheduledAt <= now`); ha még egyik forduló sem kezdődött, a **legkorábbi** (soron következő) forduló.
- A `Σ` és a rang **mindig az összesített** verseny-érték (nem fordulónkénti).
- Ha csak egy forduló van / nincs `round` adat → nincs lapozó nyíl.

## 6. Lock és adatvédelem (a kulcsszabály)

A tét **lock-ja a kezdés**: a `placeBet` (`src/actions/bets.ts`) `scheduledAt <= now` esetén tiltja a fogadást. Ugyanez a vízválasztó a tippek felfedésében:

- **Jövőbeli meccs** (`scheduledAt > now`): inline **csak a saját** tipped látszik; mások celláját 🔒 jelzi.
- **Élő vagy befejezett meccs** (`scheduledAt <= now`, lockolt): **mindenki** tippje látszik (élőnél nettó még „…", befejezettnél tipp + nettó).
- **Törölt meccs**: lockolt volt → tippek látszanak; nettó a visszatérítés szerint.

> **Kritikus implementációs követelmény:** az adatvédelmi szűrés **kizárólag szerver-oldalon** történhet. Mások jövőbeli (még nem lockolt) tippje **soha nem juthat ki a kliensre** — sem a kezdeti HTML-be, sem a forduló-váltás válaszába.

## 7. Interakciók — meglévő komponensek újrahasználata

A popupokat **nem tervezzük újra**; a meglévő komponensek nyílnak `Dialog`-ban (`src/components/ui/dialog.tsx`):

- **Lezárt (élő/befejezett/törölt) meccs** cellájára/fejlécére kattintva → **`MatchTipsTab`** (`src/components/match-tips-tab.tsx`) az adott meccsre. Propok: `bets: GroupMemberBet[]`, `currentUserId`, `isFinished`, `youLabel`, `oddsBoost`. A lockolt meccs tippjei már a betöltött forduló-adatban vannak → továbbadhatók (vagy `getGroupBetsForStartedMatch`-csel pótolva).
- **Jövőbeli meccs** cellájára/fejlécére (és a saját jövőbeli tippre) kattintva → a meglévő **tipplap** (`BetForm` / `BetDialog`, `src/components/bet-form.tsx`) az adott meccsre. A `BetForm` propjai (`matchId`, `groups: GroupBetInfo[]`, `odds`, `homeTeam`, `awayTeam`, `onSuccess`) a meglévő, match-card-on használt flow-val töltődnek.

A mátrix dolga csak a **kattintás-routolás** (lockolt → stats dialog, jövőbeli → tipplap dialog) és a propok beadása; maguk a komponensek változatlanok.

## 8. Élő / jövőbeli / törölt meccs összefoglaló

| Meccs állapot | Fejléc | Cellák (mások) | Cella (saját) | Kattintás |
|---|---|---|---|---|
| befejezett | eredmény (`3:0`) | tipp + nettó | tipp + nettó | stats dialog |
| élő | „ÉLŐ" | tipp + „…" | tipp + „…" | stats dialog |
| jövőbeli | kezdési idő | 🔒 | tipp (arany keret) v. „—" | tipplap dialog |
| törölt | „törölve" | tipp + visszatérítés-nettó | ua. | stats dialog |

## 9. Komponens- és adat-architektúra

### 9.1 Pure logika — `src/lib/tip-matrix.ts` (tesztelt)

- `groupMatchesIntoRounds(matches)` → rendezett fordulók (kulcs, címke, min `scheduledAt`, meccsek).
- `pickDefaultRound(rounds, now)` → az alapértelmezett forduló (lásd 5.).
- `filterRoundBetsForViewer(bets, matches, now, currentUserId)` → a kliensre adható tippek (adatvédelmi szűrés: jövőbeli meccsen csak a saját). **Ez a biztonsági mag — TDD-vel.**
- `buildMatrixRows(leaderboardRows, matches, visibleBets)` → a renderelhető sorok/cellák (tipp, nettó = `payout − stake`, tónus-flagek, `isOwn`, `locked`).

### 9.2 Lekérdezés / szerver-akció

- Meglévő: `getGroupLeaderboard(groupId)` (`src/queries/leaderboard.ts`) → sorok (rang, userId, név, avatar, profit); `getMatchesForTournament(tournamentId, useFlagFallback)` (`src/queries/matches.ts`) → **összes** meccs csapat-megjelenítéssel, állapottal, eredménnyel, fordulóval, oddsszal.
- **Új:** `src/queries/tip-matrix.ts` — egy forduló tippjei a csoport tagjaira, a **megfelelő eredmény-flagekkel** (`goalDiffCorrect`, `exactScoreCorrect` is, amiket a meglévő `GroupMemberBet` nem ad), **adatvédelmileg szűrve** (`filterRoundBetsForViewer` a szerveren).
- **Új szerver-akció:** `getTipMatrixRound(groupId, roundKey)` (`"use server"`, `getCurrentUser()` ellenőrzés) — egy forduló teljes, szűrt mátrix-adatát adja vissza. A forduló-váltás ezt hívja (SWR/akció, mint a `src/actions/live.ts`). A **kezdeti** (alapértelmezett forduló) adatát a page szerver-komponens adja propként; a kliens a betöltött fordulókat cache-eli.

### 9.3 Kliens komponens — `src/components/tip-matrix.tsx`

- Megkapja: a sorokat (összrang/profit), az aktuális forduló mátrix-adatát, `currentUserId`-t, a forduló-listát (prev/next), és a dialog-flow-hoz szükséges metaadatot.
- Tartja: aktuális forduló + per-forduló cache; forduló-váltáskor `getTipMatrixRound`-ot hív.
- Rendereli: sticky név-oszlop, `Σ`, meccs-oszlopok, cellák (B-variáns, tónus), saját-sor kiemelés, „ugorj rám" sáv, forduló-nav, kattintás-routolás a két dialogba.
- **Kör read-only**: `filterAndRerankLeaderboard` (`src/lib/circle-leaderboard.ts`) adja a sorokat; nincs tipplap-dialog és nincs „ugorj rám" sáv (csak stats dialog).

### 9.4 Integráció

- `group-detail-tabs.tsx`: új `matrix` tab, `defaultValue="matrix"`, a page szerver-komponens betölti az alapértelmezett forduló adatát.

## 10. i18n

Új `tipMatrix` namespace (`messages/hu.json` + `messages/en.json`): tab-címke, `Σ` címke, „ÉLŐ", kezdési idő formátum, „törölve" / „visszatérítve", „(te)", az „ugorj rám" gomb aria-label, 🔒 aria, üres állapotok („nincs tipp ebben a fordulóban" stb.). Nincs hardcoded string.

## 11. Tesztelés (Vitest, TDD a pure logikára)

- `filterRoundBetsForViewer` — **adatvédelem**: jövőbeli meccsen csak a saját tipp marad; lockolton mindenki; határeset `scheduledAt == now`.
- `pickDefaultRound` — elkezdődött forduló kiválasztása; minden-jövőbeli eset; üres/egy-forduló.
- `groupMatchesIntoRounds` — rendezés min `scheduledAt` szerint; hiányzó `round`.
- `buildMatrixRows` — nettó = `payout − stake`; lepontozatlan → null; nem-tippelt cella; saját jövőbeli tipp `isOwn`.

## 12. Hatókörön kívül (YAGNI / v2)

- A két popup **újratervezése** (a meglévő `MatchTipsTab` és `BetForm` megy).
- **Élő gólszám** a fejlécben (nincs élő eredmény-adat).
- **Rang-mozgás nyilak** (↑/↓ az előző fordulóhoz képest) — előző-fordulós rang tárolását igényelné; v2.
- **Élő auto-frissítés / polling** a futó forduló alatt — v2 (a meglévő `src/actions/live.ts` polling-ablak újrahasználható).
- **Sor-/oszlop-virtualizáció** nagyon nagy mezőnyre (pl. a hivatalos World Cup Ranglista) — csak ha teljesítmény-gond lesz; v2.

## 13. Eldöntött kérdések

1. **Tab neve:** **„Tipp-tábla"**.
2. **Alapértelmezett forduló:** a **legkésőbbi elkezdődött forduló** (lásd 5.) — a friss eredmények jönnek elő először.
3. **Régi „Ranglista" (accordion) tab:** egyelőre **megmarad** a mátrix mellett. (Későbbi esetleges kiváltás a használati tapasztalat alapján — nem most.)
