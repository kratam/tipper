# Torna-landing: tabos, összecsukható kurált tip-mátrix board

- **Dátum:** 2026-06-21
- **Státusz:** jóváhagyott terv (implementáció előtt)
- **Érintett oldal:** `/tournaments/[slug]` (a `TournamentTabs` feletti rész)

## 1. Motiváció

A torna-landingen ma három, vizuálisan különálló elem szolgálja a „hol állok" kérdést:

- `OfficialGroupRibbon` — koronás kártya a hivatalos rangoddal + összecsukható mini-ranglista (`src/components/official-group-ribbon.tsx`),
- a „Csoportok és körök" accordion + `group-summary-card` / `circle-summary-card` rács (`src/components/tournament-tabs.tsx:330-354`),
- a tényleges összevetés (ki mit tippelt) csak a csoport/kör **részletes oldalán** elérhető (`group-detail-tabs.tsx` → `TipMatrix`).

Ez sok kattintás és kontextusváltás. A cél: a landingen **egy** összecsukható blokk, ahol a hivatalos/csoport/kör nézőpontok **tabok**, és minden tab alatt egy **kurált, vízszintesen görgethető tip-mátrix** (nem sima ranglista), a leaderekkel és a user körüli játékosokkal.

## 2. Cél és nem-cél

**Cél:**

- A `OfficialGroupRibbon` + „Csoportok és körök" szekció összevonása egyetlen összecsukható blokká.
- Nézőpont-váltás **tabbal** (hivatalos + saját csoportok + körök), de csak ha 2+ nézőpont van.
- Az alsó komponens a meglévő `TipMatrix` szerkezete (balra ragadó játékos-oszlop, `Σ` oszlop, vízszintesen görgethető meccs-oszlopok), **kurált sorokkal** (leaderek + user ±1) és **kibontható réssel**, **max-magassággal**, **összecsukhatóan**.

**Nem-cél (scope-on kívül):**

- Nincs változás a tippelési/pontozási logikában.
- Nincs változás a meccs-tabokban (`Közelgő / Lejátszott / Mind / Dobogósok`).
- A csoport/kör **részletes oldalai** változatlanok (ott marad a teljes, nem kurált `TipMatrix`, eredmények, beállítások).
- Nincs változás a csoport/kör létrehozásban, meghívásban.

## 3. UX terv

### 3.1 Komponens-hierarchia a landingen

```
Fejléc (FIFA WC 2026)
┌─ Koronás kártya ──────────────────────────── [▾]   ← MINDIG látszik; rajta a collapse-chevron
│   👑  #27 · -1454 · 12/7 tipp (köv. 3 nap)          (a HIVATALOS rangod, fixen — nem követi az aktív tabot)
│
│ (összecsukható törzs, usePersistedDisclosure)
├─ [ Hivatalos | Baráti kör | Munka | … ]             ← tab-sor; CSAK ha 2+ nézőpont van
│
└─ Kurált tip-mátrix board (az aktív tabé)            ← max-height; vízszintesen görgethető meccs-oszlopok
│     ◀ Forduló 3 ▶
│     ┌─────────┬────┬───────── meccs-oszlopok → ────┐
│     │ 🥇 [av] │ Σ  │  2:1 +340 │ 1:1 -100 │ 2:0 │ 🔒 │  ← leaderek FENT ragadnak
│     │ 🥈 [av] │ …  │           │          │     │    │
│     │ 🥉 [av] │ …  │           │          │     │    │
│     ├─────────────────────────────────────────────┤
│     │           ▾ 22 további játékos               │  ← kibontható rés (max-height görgetés)
│     ├─────────────────────────────────────────────┤
│     │ 26 [av] │ …  │ … │ … │ 🔒 │ 🔒 │              │  ← te ±1 LENT ragad
│     │ 27 [av] │ …  │ … │ … │ +  │ +  │  (te, arany) │
│     │ 28 [av] │ …  │ … │ … │ 🔒 │ 🔒 │              │
│     └─────────────────────────────────────────────┘
│     Részletek →                          ⚖ Szabályok
│
Közelgő | Lejátszott | Mind | Dobogósok               ← VÁLTOZATLAN
```

### 3.2 Tab-sor

- **Összetétel és sorrend:** `Hivatalos` (az `isOfficial` csoport) → saját csoportok (tagság/`joinedAt` szerinti sorrend) → körök (`joinedAt` szerint).
- **Komponens:** a meglévő `src/components/ui/tabs.tsx`. Mobilon (`max-[560px]`) már `overflow-x-auto` + `auto-cols-max`, így sok tab vízszintesen görgethető.
- **„2+" feltétel:** a tab-sor csak akkor renderelődik, ha `(saját csoportok + körök) ≥ 1` (azaz a hivatalossal együtt ≥2 nézőpont). Különben nincs tab-sor, csak a hivatalos board.
- **Alapértelmezett aktív tab:** `Hivatalos`.
- **Tab-váltás hatóköre:** csak az alatta lévő boardot cseréli; a koronás kártya és a meccs-tabok nem mozdulnak.

### 3.3 Board — kurált tip-mátrix

A `TipMatrix` szerkezete, kurált sor-elrendezéssel:

- **Oszlopok (változatlan render):**
  - balra ragadó **játékos-oszlop**: rang + avatar (+ név, de `<560px` alatt rejtve),
  - **`Σ` oszlop**: fejléc-toggle összesen ↔ forduló (`MatrixScope`, meglévő),
  - **meccs-oszlopok**: fordulónként, `◀ Forduló X ▶` navval; a kezdő fordulót a meglévő `pickDefaultRoundKey` adja (`src/lib/tip-matrix.ts:162-173`).
  - **cella-állapotok** (meglévő logika, `tip-matrix.tsx:155-202`): lejátszott tipp + nettó eredmény (tónussal); saját jövőbeli tipp (arany keret); `🔒` mások jövőbeli/zárolt tippje; `+` ha nincs még tipped.
- **Függőleges kuráció („C" elrendezés):**
  - **fent ragad:** top 3 az aktív `Σ`-scope szerint,
  - **kibontható rés:** `▾ N további játékos` — alapból csukva; kinyitva egy **max-magasságú, függőlegesen görgethető** sáv a köztes sorokkal (a leaderek fent, a te-blokk lent ragadva marad),
  - **lent ragad:** te **±1** (előtted, te, mögötted).
- **readOnly:** kör-tabok → `readOnly` (csak nézet, a hivatalos tippekből szűrve a kör tagjaira); hivatalos + saját csoportok → interaktív (saját jövőbeli cellára koppintva tippelés).
- **Lábléc:** `Részletek →` (az adott csoport/kör részletes oldalára) + `⚖ Szabályok` (az adott csoport/kör szabály-dialógusa).

### 3.4 Mobil viselkedés

A játékos-oszlopban `<560px` alatt **csak rang + avatar** látszik (a név rejtve), a meglévő `max-[560px]:hidden` mintát követve (`tip-matrix.tsx:301`), hogy maradjon hely a meccs-oszlopoknak.

### 3.5 Összecsukás

- A koronás kártya a mindig látható fejléc, rajta a chevron (`▾`/`▸`).
- Csukva: csak a kártya + a meccs-tabok látszanak (a tab-sor és a board elrejtve).
- Nyitva: tab-sor + board megjelenik.
- Állapot: `usePersistedDisclosure` (`src/hooks/use-persisted-disclosure.ts`), új kulcs `tipper:landingBoard:open`, **alapból nyitva** (`defaultOpen = true`). Ugyanaz a minta, mint a mai `OfficialGroupRibbon` (`official-group-ribbon.tsx:52`).

## 4. Adatfolyam és újrahasznosítás

### 4.1 Szerver (tournament page, `src/app/[locale]/tournaments/[slug]/page.tsx`)

A meglévő lekérdezéseket használjuk (már most is futnak a landingen):

- `getUserGroups(user.id)` → torna-szűrés → `officialGroupMembership` (`isOfficial`) + `userOnlyGroupMemberships` (`page.tsx:49-65`),
- `getUserCircles(user.id)` → a tornához tartozó körök (a meglévő landing-szűrés szerint),
- csoportonként `getGroupLeaderboard(group.id)` → teljes ranglista,
- körönként a hivatalos sorokból: `filterAndRerankLeaderboard(officialRows, körTagIdSet)` (`src/lib/circle-leaderboard.ts:15-26`) → `CircleLeaderboardRow[]` (megőrzi az `officialRank`-ot).

A page átadja a `TournamentBoardPanel`-nek: az aktív (hivatalos) tab teljes ranglistáját + kezdő forduló mátrixát, és a többi tab metaadatait (id, név, típus, ranglista) a lusta betöltéshez.

### 4.2 Mátrix-adat tabonként, lazán

Page-loadkor **csak a hivatalos** board mátrixa töltődik be (kezdő forduló). A többi tab a `getTipMatrixRoundAction` (`tip-matrix.tsx:6`) hívással az **első aktiváláskor** tölt — nem N lekérdezés induláskor. A betöltött tab-adat kliens oldalon cache-elődik (egyszerű state map), tab-visszaváltáskor nincs újratöltés.

### 4.3 Sor-kuráló algoritmus

Új pure függvény a `src/lib/leaderboard-utils.ts`-be, a `pickMiniLeaderboard` mellé (annak ±1-re általánosított, rés-tudatos változata). A teljes rendezett `MatrixRowDisplay[]`-en dolgozik (`src/lib/tip-matrix.ts:210-216`):

```ts
interface CuratedRows {
  leaders: MatrixRowDisplay[];   // top N (alapból 3)
  middle: MatrixRowDisplay[];    // a rés tartalma (köztes sorok)
  around: MatrixRowDisplay[];    // te ±1 (előtted, te, mögötted)
  showGap: boolean;              // van-e elrejtett köztes sor
}

function splitCuratedRows(
  rows: readonly MatrixRowDisplay[],
  currentUserId: string,
  opts?: { leaders?: number; neighbors?: number }, // default { leaders: 3, neighbors: 1 }
): CuratedRows
```

**Szabályok / edge case-ek:**

- **Te a top N-ben vagy** (vagy nem vagy a listában): `around = []`, `leaders = rows.slice(0, N)`, `middle = rows.slice(N)`, `showGap = middle.length > 0`. A te sorod a leaderek közt kiemelve.
- **Te N alatt:** `leaders = rows.slice(0, N)`; `around` = `[userIndex-1, userIndex, userIndex+1]` metszve a tömb határaival és a leaderekkel (átfedés nincs duplikálva); `middle` = a leaderek és az `around` közti sorok; `showGap = middle.length > 0`.
- **Kevés játékos** (ha a leaderek + around lefedi a teljes listát, vagy `rows.length ≲ N + 2·neighbors + 1`): nincs rés (`middle = []`, `showGap = false`), mindenki látszik.
- A rangok és értékek a `buildMatrixRows` kimenetéből jönnek (scope-függő rerank), a kuráció csak particionál — nem számol újra rangot.

### 4.4 readOnly és groupId leképezés tabonként

| Tab típus | `groupId` | `leaderboard` | `readOnly` |
|-----------|-----------|---------------|------------|
| Hivatalos | official group id | `getGroupLeaderboard(official)` | `false` |
| Saját csoport | csoport id | `getGroupLeaderboard(group)` | `false` |
| Kör | **official group id** | `filterAndRerankLeaderboard(officialRows, körTagok)` | `true` |

(A körök a hivatalos tippeket mutatják a kör tagjaira szűrve — ezért `groupId = official`, `readOnly`. A meglévő `circle-detail-tabs.tsx:117-124` ugyanezt csinálja.)

## 5. Komponens-bontás

**Új:**

- `src/components/tournament-board-panel.tsx` (client) — az összecsukható blokk: koronás fejléc (chevron + hivatalos rang/profit/next-3-days), tab-sor (`ui/tabs.tsx`), és az aktív tab kurált `TipMatrix`-a (lazy betöltéssel). A collapse a `usePersistedDisclosure`-rel.
- `splitCuratedRows()` a `src/lib/leaderboard-utils.ts`-ben + unit teszt.

**Módosított:**

- `src/components/tip-matrix.tsx` — új `curated?: boolean` prop (alap: `false` = a mai teljes nézet). `curated` esetén a `<tbody>` három csoportra bomlik (leaderek / kibontható köztes / te±1) sticky pozicionálással és max-height görgetéssel; minden más (oszlopok, `Σ`-toggle, forduló-nav, cella-render, sticky-left oszlop, `readOnly`) változatlanul újrahasznosul. A meglévő „jump-to-me" alsó sáv `curated` módban a te±1 blokkal helyettesül.
- `src/app/[locale]/tournaments/[slug]/page.tsx` — a `TournamentBoardPanel` beillesztése; a különálló `OfficialGroupRibbon`, a „Csoportok és körök" accordion és a summary-kártya rács eltávolítása a landingről.

**Eltávolítandó, ha máshol nincs hivatkozás** (implementációkor ellenőrizni `grep`-pel): `group-summary-card.tsx`, `circle-summary-card.tsx`, és a `tournament-tabs.tsx` accordion-szekciója (`:330-354`). Az `OfficialGroupRibbon` fejléc-részeit a `TournamentBoardPanel` örökli; ha a ribbon sehol máshol nem kell, törölhető.

## 6. Tesztelés

- **Vitest (pure, TDD):** `splitCuratedRows()` — te a top-ban / te alul / te legalul / te legfelül a nem-leaderek közt / kevés játékos (nincs rés) / üres lista / egyelemű lista / átfedés a leaderek és a ±1 közt (nincs duplikáció). A `buildMatrixRows` és `pickDefaultRoundKey` már fedett.
- **E2E (Playwright — a stack szerint TODO):** tab-váltás cseréli a boardot; collapse állapot megmarad reload után; rés kibontása megjeleníti a köztes sorokat görgethetően; vízszintes meccs-görgetés; `<560px`-en csak avatarok; kör-tab read-only (nincs `+`/tippelés).

## 7. Nyitott pontok

- A `getUserCircles` torna-szűrésének pontos helye az implementációkor a meglévő landing-logikából átemelendő (a kör→torna kapcsolat ott már megoldott, mert a landing ma is renderel kör-kártyákat).
- A `TipMatrix` `curated` módjában a **kétirányú sticky** (balra ragadó játékos-oszlop + fent/lent ragadó sorok, vízszintes meccs-görgetés mellett) a fő technikai kockázat — implementációkor érdemes először ezt prototípusozni.
