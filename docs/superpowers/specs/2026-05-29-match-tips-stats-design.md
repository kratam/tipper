# Meccs-dialog: Tippek + Statisztika nézet (skálázható ranglista)

**Dátum:** 2026-05-29
**Állapot:** Jóváhagyott design, implementációs terv következik

## Probléma

Egy futó vagy befejezett meccsre kattintva a [bet-dialog.tsx](../../../src/components/bet-dialog.tsx) jelenleg **az összes leadott tippet** kirendereli csoportonként, egyetlen lapos listában. 10 játékosnál ez rendben van, de ~100 fős csoportnál a lista átláthatatlan.

**Fontos tisztázás:** ez **nem teljesítmény-, hanem UX-probléma**:

- DB: egyetlen indexelt query (`inArray(groupId)`) + user join — 100 sor a réteg számára semmi, ezres nagyságrendig is elbír.
- Payload: 100 sor JSON ≈ 20–25 KB, triviális.
- DOM: 100 sor a böngészőnek semmi; virtualizáció csak ~1000+ sornál indokolt.
- Egyetlen valós perf-kockázat: 100 avatar kép betöltése — ezt a szűkített alap-render önmagában kezeli.

Ezért szerveroldali **pagination NEM indokolt** (perf-szempontból nem-probléma, modálban rossz UX). A megoldás a **renderben** korlátoz, nem a query-ben.

## Megoldás áttekintés

A meccs-dialog tartalma csoportonként **két tabra** bomlik, plusz egy felső csoportválasztó tab-sor, ha a felhasználó több csoportban is fogadott a meccsre:

```
Dialog
 ├─ Meccs fejléc + eredmény (változatlan)
 └─ Csoportonként:
     ├─ [Csoport tabok]          ← CSAK ha >1 csoport; 1 csoportnál elmarad
     └─ [Tippek | Statisztika]   ← alap tab: Tippek
         ├─ Tippek tab
         └─ Statisztika tab
```

A legtöbb felhasználó 1, legfeljebb 2-3 csoport tagja, ezért a két egymás alatti tab-sor nem zsúfol.

## Adatréteg: NINCS DB- vagy query-változás

A meglévő [getGroupBetsForStartedMatch](../../../src/queries/bets.ts) már minden szükséges mezőt visszaad
(`predictedHome`, `predictedAway`, `stake`, `result1x2Correct`, `payout`, user adatok), a meccs
eredménye (`homeScore` / `awayScore`) pedig a `match` objektumban van. Ebből minden kiszámolható
**kliens oldalon**:

- **1/X/2 besorolás:** `predictedHome > predictedAway` → `1`, egyenlő → `X`, `<` → `2`.
- **Pontos eredmény-találat:** `predictedHome === homeScore && predictedAway === awayScore`.
- **Győztes-találat:** a meglévő `result1x2Correct` mező.
- **Rangsor / szomszédok / statok:** aggregáció a már meglévő `GroupMemberBet[]` tömbön.

A feature tehát **tisztán kliensoldali**, a már lekért adaton dolgozik — nincs migráció, alacsony kockázat.

Megjegyzés: a teljes-tipp-lekérés ~100+ tagig bőven elég. Ha valaha százas-ezres csoportok lesznek,
akkor jön szóba szerver-pagination / virtualizáció — addig YAGNI. Ha bevezetjük a határt, azt
`log`/dokumentáció szinten jelezni kell, hogy ne tűnjön „minden meg van jelenítve"-nek.

## Tippek tab

### Befejezett meccs
Rangsor **profit szerint** csökkenő (`payout - stake`):

- **Dobogó:** top 3 sor (🥇🥈🥉).
- **Elválasztó:** „⋯ N további ⋯" ha van kihagyott sor a dobogó és a saját környezet között.
- **Te körülötted:** a saját sorod ±2 szomszédja a rangsorban (összesen max 5 sor), te kiemelve.
- **Összes mutatása (N):** accordion gomb, ami **helyben** (ugyanabban a tabban) kibontja a teljes
  rangsort egy scrollozható, max-magasságú dobozban. Nincs új szerver-kérés (az adat már megvan).

Élő esetek a saját sor pozíciójára:
- Ha te a top 3-ban vagy → nincs külön „Te körülötted" blokk; a dobogó + „összes mutatása" elég.
- Ha átfedés van a dobogó és a ±2 ablak között → nincs duplikált sor, az elválasztó elmarad.

### Élő (még futó) meccs
Nincs eredmény → nincs profit-rangsor. A lista **tét szerint** csökkenő sorrendben, top/szomszéd
bontás nélkül; a saját sorod felül kiemelve, alatta „Összes mutatása (N)".

A sorok a meglévő [BetRow](../../../src/components/bet-dialog.tsx) komponenst használják újra
(avatar, név, eredmény-tipp, tét, profit-badge). A „Te" mindig kiemelve, a meglévő `youLabel` logikával.

## Statisztika tab

A teljes stat-készlet (csoportonként számolva):

**1-X-2 megoszlás**
- Vízszintes sávok **tét szerint** (mennyi token ment 1-re / X-re / 2-re), soronként a fő szám is.

**Eredmény-tippek**
- Leggyakoribb tipp (pl. `4-1`, és hányan tippelték).
- Átlag tipp (pl. `4.2 – 1.3`).
- *Csak befejezett meccsnél:* pontos eredményt eltalálta (fő).
- *Csak befejezett meccsnél:* győztest eltalálta (`X / N`).

**Tét**
- Legnagyobb tét (ki + mennyi).
- Összes tét.
- Átlag tét.

Élő meccsnél a befejezett-only sorok (pontos találat, győztes-arány) kimaradnak; a többi változatlan.

## Kód-szervezés

A `bet-dialog.tsx` ne hízzon túl — kiszervezés sok kis fájlba:

- **`src/lib/match-stats.ts`** — tiszta (pure) függvények, side-effect nélkül:
  - `rankBets(bets, mode)` — rangsor profit (befejezett) vagy tét (élő) szerint.
  - `pickNeighbors(rankedBets, currentUserId, radius)` — dobogó + ±radius ablak kiválasztása,
    duplikáció nélkül; visszaadja a megjelenítendő sorokat és az elválasztó pozícióját.
  - `computeMatchStats(bets, match)` — 1X2 megoszlás, leggyakoribb/átlag tipp, pontos/győztes
    találat, tét-statok. Befejezett vs élő ágat is kezeli.
  - `classify1x2(predictedHome, predictedAway)` — segéd a 1/X/2 besoroláshoz.
- **`src/components/match-tips-tab.tsx`** — a Tippek tab UI-ja.
- **`src/components/match-stats-tab.tsx`** — a Statisztika tab UI-ja (sávok, kulcs-érték sorok).
- **`bet-dialog.tsx`** — a `GroupBetsSection` átalakítása: tab-állapot (group + nézet), a két tab
  komponens beillesztése. A `BetRow` és `sortBets` újrahasználva / a `match-stats.ts`-be költöztetve.

## Alapértékek (jóváhagyva)

- **Szomszéd-sugár:** ±2 (top 3 + saját környezet max 5 sor).
- **Alap tab:** Tippek (a Statisztika a második).
- **Élő meccs:** Tippek tab tét szerint sorol, top/szomszéd nélkül; Statisztika tab a befejezett-only
  statok nélkül.
- **Single-group:** nincs felső csoport-tab sor, csak Tippek/Statisztika.
- **Kibontás:** helyben (accordion), nem navigáció.

## Tesztelés

**Unit (Vitest) — `match-stats.ts` (pure logika, 80%+ coverage itt teljesül):**
- `rankBets`: profit szerinti és tét szerinti rendezés; döntetlen profit/tét tie-break.
- `pickNeighbors`: te a top 3-ban / középen / utolsó helyen; dobogó és ±2 ablak átfedése;
  kevés játékos (kevesebb mint 5 sor); 1 tipp.
- `classify1x2`: 1 / X / 2 határesetek.
- `computeMatchStats`: 1X2 megoszlás (tét + fő), leggyakoribb tipp (holtverseny), átlag tipp,
  pontos találat, győztes-arány; élő vs befejezett ág; edge case-ek (1 tipp, mindenki ugyanazt tippelte,
  0 token tét).

**Komponens-szint:**
- Tab-váltás (Tippek ↔ Statisztika), csoport-tab váltás.
- „Összes mutatása" kibontás megjeleníti a teljes listát.
- Single-group: nincs csoport-tab.
- Élő vs befejezett meccs eltérő Tippek/Statisztika tartalma.

## Hatókörön kívül (YAGNI)

- Szerveroldali pagination / cursor.
- Lista-virtualizáció (react-window stb.).
- Csoportok közti összevont (cross-group) rangsor.
- Stat-trendek időben, történeti összehasonlítás.
