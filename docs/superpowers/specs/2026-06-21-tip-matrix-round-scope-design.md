# Tipp-tábla — forduló-szűrhető Σ oszlop

**Dátum:** 2026-06-21
**Státusz:** jóváhagyott terv
**Érintett komponens:** `src/components/tip-matrix.tsx` (Tipp-tábla / mátrix-ranglista)

## Probléma

A Tipp-tábla Σ (összesítő) oszlopa mindig a teljes, minden fordulót átfogó
token-egyenleget mutatja (`row.profit`, szerver-oldali aggregáció). Nincs mód
megnézni, ki hogyan teljesített **egy adott fordulóban**.

## Cél

A Σ oszlop fejlécére kattintva váltani lehessen két nézet között:

- **Összesített** (default, jelenlegi viselkedés): a teljes profit.
- **Aktuális forduló**: csak az éppen megnyitott forduló pontjai, és a tábla
  ehhez igazodva átrendeződik.

## Hatókör

**Benne van:**

- Kliens-oldali mód-kapcsoló a Σ oszlopon (fejléc-kattintás).
- Forduló-módban a sorok átrendezése és a helyezés-számok újraszámolása.
- Mobilbarát, fix-rövid fejléc-felirat.
- Pure logika + Vitest unit-teszt.

**Nincs benne (YAGNI):**

- Nincs új DB-oszlop, séma-változás, szerver-lekérdezés vagy server action.
- Nincs perzisztált felhasználói beállítás — a mód csak a komponens
  élettartamáig él (újratöltésnél default „összesített").
- A globális Σ értéke (`row.profit`) változatlanul a szerverről jön.

## Megoldás

### 1. Adat — tisztán kliens-oldali

A fordulónkénti pont játékosonként a **már betöltött** `round.bets`-ből
számolódik. Minden cellára `betNet(payout, stake)` (= `payout − stake`),
játékosonként összegezve a forduló meccseire.

Adatvédelmi megfontolás (miért teljes és helyes a kliensen): minden lepontozott
tipp (`payout != null`) szükségszerűen **lockolt** meccshez tartozik, amelyet a
`filterRoundBetsForViewer` minden néző számára átenged. A jövőbeli, még nem
pontozott tippek nettója `null`, ezért nem számítanak a forduló-összegbe. Tehát
a forduló-pont minden játékosra teljes, új lekérdezés nélkül.

Konzisztencia: a forduló-pontok összege az összes fordulóra megegyezik a
globális `profit`-tal (mindkettő a lepontozott cellák nettó összege; törölt
meccsnél a visszatérített tét miatt a nettó 0).

### 2. Pure logika + teszt

Új pure függvény a `src/lib/tip-matrix.ts`-ben, Vitest-tel fedve
(`tests/lib/tip-matrix.test.ts`):

```ts
export type MatrixScope = "total" | "round";

export interface MatrixRowInput {
  rank: number;     // globális helyezés (holtverseny-kezelt, szerverről)
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;   // globális, szerverről
}

export interface MatrixRowDisplay {
  rank: number;     // mód szerint: globális vagy forduló-rangsor
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  value: number;    // mód szerint: profit vagy forduló-pont
}

// round.bets-ből: { userId, matchId, payout, stake }[]
export function buildMatrixRows(
  rows: readonly MatrixRowInput[],
  bets: readonly { userId: string; payout: number | null; stake: number }[],
  scope: MatrixScope,
): MatrixRowDisplay[];
```

Viselkedés:

- **`scope === "total"`**: a sorok a bemeneti (globális) sorrendben, `value =
  profit`, és a `rank` a bemeneti **eredeti globális helyezés** (a szerver
  holtverseny-kezelt rank-je megőrződik, nem a pozíció-index). A bemenet már
  globális rangsor szerint rendezett.
- **`scope === "round"`**:
  - Forduló-pont userenként = `Σ betNet(payout, stake)` a `payout != null`
    tippekre (a `bets` már csak a forduló tippjeit tartalmazza). Nincs tipp → 0.
  - Rendezés forduló-pont szerint **csökkenő**; holtversenynél **stabil**
    másodlagos sorrend a bemeneti globális sorrend szerint.
  - `rank` újraszámolva **standard competition ranking** szerint (1, 2, 2, 4) —
    azonos forduló-pont = azonos helyezés. (A meglévő leaderboard rank-konvenció
    ellenőrzése implementációkor; ehhez igazítjuk.)

### 3. Komponens-változások (`tip-matrix.tsx`)

- Új state: `const [scope, setScope] = useState<MatrixScope>("total")`.
- A `tbody` és a „Ugorj rám" sáv a `buildMatrixRows(leaderboard, round.bets,
  scope)` kimenetét használja a nyers `leaderboard` helyett — így az érték, a
  sorrend, a helyezés-szám és a saját sor (`meRow`) is konzisztensen vált.
- A Σ `<th>` tartalma kattintható **`<button>`** (teljes billentyűzet-
  hozzáférés: Enter/Space, `aria-pressed`), `onClick={() => setScope(s => s ===
  "total" ? "round" : "total")}`, a meccs-fejlécekkel azonos `hover:bg-surface-3`.
- Forduló-váltás (← →) megőrzi a `scope`-ot; a lazy-load után a `buildMatrixRows`
  automatikusan az új forduló pontjait számolja.

### 4. Fejléc-megjelenés (mobilbarát)

A Σ `<th>` kétsoros, illeszkedve a meccs-oszlopok fejlécéhez (zászló + eredmény):

- **Fő sor:** `Σ` (mindig).
- **Alsó sor (felirat):** `whitespace-nowrap`, fix-rövid (≤4 karakter), így sem a
  magasság (a sor amúgy is létezik), sem a szélesség nem nő mobilon:

| Forduló | Felirat | Szín |
|---|---|---|
| Összesített | `össz` | muted |
| Csoportkör, N. forduló | `F1`, `F2`, … | arany |
| Nyolcaddöntő (16 csapat) | `1/8` | arany |
| 1/16-döntő (32 csapat) | `1/16` | arany |
| 1/32-döntő (64 csapat) | `1/32` | arany |
| Negyeddöntő (8 csapat) | `ND` | arany |
| Elődöntő (4 csapat) | `ED` | arany |
| Döntő | `D` | arany |

Kieséses logika: döntő→`D`, elődöntő (4)→`ED`, negyed (8)→`ND`, fölötte
`1/(csapatszám ÷ 2)` (16→`1/8`, 32→`1/16`, 64→`1/32`).

A **teljes** forduló-név végig látható a tábla tetején, a forduló-nav sávban
(`← Döntő →`), így a rövid Σ-felirat csak állapot-emlékeztető — nem vész el infó.

A label-választás a komponens meglévő `roundTitle` switch-ének (81–94. sor)
mintájára készül, a következő ponttal bővített i18n-kulcsokból.

### 5. i18n

Új kulcsok a `tipMatrix` névtérben (hu + en), a tényleges üzenet-fájl
struktúráját implementációkor követve:

- `scopeTotal` — `össz` / `tot`
- `shortGroup` — `F{n}` / `R{n}`
- `shortFinal` — `D` / `F`
- `shortSf` — `ED` / `SF`
- `shortQf` — `ND` / `QF`

Az `1/8`, `1/16`, `1/32` tört-jelölés nyelvfüggetlen, kódból generált
(`1/${teams / 2}`), nem igényel külön kulcsot.

## Tesztelés

Vitest unit-tesztek a `buildMatrixRows`-ra:

- `total` mód: változatlan sorrend, `value === profit`, eredeti rangsor.
- `round` mód: helyes pont-összegzés userenként; `payout == null` kihagyva.
- `round` mód: csökkenő rendezés; holtversenynél stabil globális tie-break.
- `round` mód: standard competition ranking (1, 2, 2, 4).
- Üres forduló (nincs lepontozott tipp): mindenki 0, sorrend stabil.

## Élesetek

- **Read-only (kör-oldal):** a `scope` state ott is működik; a Σ-toggle
  elérhető. A „Ugorj rám" sáv read-only módban amúgy sem jelenik meg.
- **Forduló-váltás módban:** a `scope` megmarad, az új forduló pontjait mutatja.
- **0 pontos forduló:** minden érték 0, a tábla a globális sorrendet tartja
  (stabil tie-break) — helyes, csak vizuálisan „lapos".

## Érintett fájlok

- `src/lib/tip-matrix.ts` — új `buildMatrixRows` + típusok.
- `tests/lib/tip-matrix.test.ts` — új tesztek.
- `src/components/tip-matrix.tsx` — `scope` state, Σ fejléc `<button>`,
  `buildMatrixRows` használata (tbody + jump-to-me sáv), rövid forduló-felirat.
- `messages/*` (hu + en) — új `tipMatrix` rövid-kulcsok.
