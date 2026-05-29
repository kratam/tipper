# Lekötött odds megjelenítése

**Dátum:** 2026-05-29
**Státusz:** Jóváhagyásra vár

## Probléma

Ha a játékos egy adott oddsnál ad le tippet, a nyereménye ettől a **lekötött** oddstól
függ akkor is, ha az odds később változik. A `bets.oddsAtBet` oszlop ezt tárolja, és a
pontozás is ebből számol:

```
payout = Math.round(stake × oddsAtBet × oddsBoost)   // src/lib/scoring.ts:65
```

Frissítéskor (`update`) az `oddsAtBet` újra-rögzül a jelenlegi oddsra (`src/actions/bets.ts:110`).

A gond tisztán **megjelenítési**: az `oddsAtBet` sehol nem látszik a felületen.
- A bet-form „Ranglista (1.70)" felirata a *jelenlegi* piaci oddsból számol élőben
  (`match.odds × boost`), nem a lekötöttből.
- Az `existingBet` objektum, amit a form megkap, nem is tartalmazza az `oddsAtBet`-et.
- Az élő/lezárt nézetek (BetRow), valamint a csoport-oldal Ranglista és Eredmények
  tabjainak per-tipp táblái szintén nem mutatják.

A játékosnak nincs módja látni, mennyiért adta le a tippet.

## Alapfogalom — „effektív lekötött odds"

A tétre ható tényleges szorzó: **`oddsAtBet × oddsBoost`**. Ez egyenlő `payout / stake`-kel,
tehát pontosan ezt jelenti, hogy „mitől függ a nyereményem". Mindenhol ezt az **effektív**
értéket mutatjuk — konzisztensen a bet-form jelenlegi `(1.70)` feliratával, ami szintén
`raw × boost`-ot számol.

Vesztes tippnél is értelmes (független a win/loss-tól és a `lossPercentage`-től): megmutatja,
„mennyiért ment" a tipp / mennyit ért volna.

### Pure helper

`src/lib/odds-display.ts` (új fájl):

```ts
/** Effektív lekötött odds = oddsAtBet × oddsBoost, 2 tizedesre. null, ha nincs rögzített odds. */
export function formatEffectiveOdds(oddsAtBet: string | null, oddsBoost: number): string | null
```

- `oddsAtBet === null` (régi tippek, vagy nem volt elérhető odds) → `null` (UI: „—" vagy elrejtés).
- Egyébként `(Number(oddsAtBet) * oddsBoost).toFixed(2)`.

TDD-vel unit-tesztelve (`src/lib/odds-display.test.ts`): normál eset, null eset, boost = 1.0,
kerekítés (pl. 1.48 × 1.15 = 1.702 → „1.70").

## Felületi változások

### 1. Bet-form (tipp-leadó) — lekötött + jelenlegi együtt

A csoport-fejlécben, ha van meglévő tipp `oddsAtBet`-tel, a jelenlegi `(...)` helyett:

```
Ranglista  🔒 1.70 · most 1.55  ⓘ      Tippelhető: 300
```

- **🔒 1.70** — lekötött effektív odds (fix, az `existingBet.oddsAtBet × group.oddsBoost`-ból).
- **most 1.55** — jelenlegi élő effektív odds a kiválasztott kimenetre (a meglévő
  `predictedOutcome → odds × oddsBoost` logika). A score-stepper mozgatásával frissül, így a
  játékos rögtön látja, mire rögzülne újra, ha frissít.
- **ⓘ** — info-tooltip (a meglévő `BalanceInfoTooltip` radix-mintát követve, `Info` ikonnal),
  ami elmagyarázza: a lakatos érték a tipp leadásakor rögzült odds, ez határozza meg a
  nyereményt; a „most" a jelenlegi piaci odds, amire frissítéskor újra rögzülne.
- Ha **nincs** meglévő tipp (vagy `oddsAtBet === null`): marad a mostani egyetlen `(...)`
  (csak jelenlegi odds), lakat és tooltip nélkül.

A „most" érték a kiemelt outcome (1/X/2) jelölő `bg-amber` stílusával összhangban marad.

### 2. Bet-dialog élő/lezárt nézet (BetRow, Tippek tab)

A `BetRow` sorba, a tét mellé (a `predicted` és `stake` közé), halványan: `@1.70`
(effektív lekötött odds). `null` odds esetén nem jelenik meg.

A Statisztika tab (score-eloszlás) **nem** változik.

### 3. + 4. Csoport oldal — Ranglista és Eredmények tabok

Mindkét kinyitható per-tipp táblába új **Odds** oszlop a *Tipp* és *Tét* közé:

```
Játékos        Tipp   Odds   Tét   Nyeremény
Anna           3-0    1.70   100      +70
```

- Ranglista tab: `GroupLeaderboardContent` — a per-játékos kinyitott meccs-soraiba.
- Eredmények tab: `GroupResultsContent` — a per-meccs kinyitott játékos-soraiba.
- `null` odds → „—".
- A fejléc-sorok (oszlopcímkék) is bővülnek az Odds oszloppal.
- Az aggregált profit-sor (Ranglista fő sora) **nem** változik.

## Adat-réteg

A felületeket tápláló read-path-ok bővítése (`oddsAtBet` már létező oszlop a `bets` táblán,
**nincs séma-migráció**):

1. **`src/queries/bets.ts`**
   - `GroupMemberBet` interfész += `oddsAtBet: string | null`.
   - `GroupBetsForMatch` interfész += `oddsBoost: number`.
   - `getGroupBetsForStartedMatch`: a bet-mappelésnél `oddsAtBet: bet.oddsAtBet`; a
     csoport `oddsBoost`-ot a `m.group.oddsBoost`-ból (a `with: { group: true }` már megvan).

2. **`src/app/[locale]/tournaments/[slug]/page.tsx`**
   - Az `existingBet` objektum (≈131. és ≈159. sor) += `oddsAtBet: existingBet.oddsAtBet`.
   - A `GroupBetInfo` (két komponensben deklarált) `existingBet` típusa += `oddsAtBet`.

3. **`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`**
   - A `groupBets` mapping (≈109. sor) += `oddsAtBet: b.oddsAtBet`.
   - `group.oddsBoost` átadása a `GroupDetailTabs`-nak (a `settings.oddsBoost` már megvan,
     de a bet-detail tábláknak külön prop-ként vagy a settings-en keresztül elérhetővé tesszük).

## Komponens prop-változások

- **`bet-form.tsx`**: `GroupBetInfo.existingBet` típus += `oddsAtBet: string | null`. A fejléc
  render bővítése (lekötött + jelenlegi + tooltip). Új kis tooltip-komponens vagy a meglévő
  `BalanceInfoTooltip` mintájára egy `OddsInfoTooltip`.
- **`group-bets-section.tsx`** → **`match-tips-tab.tsx`** → **`bet-row.tsx`**: `oddsBoost`
  átadása a section-ből a BetRow-ig (prop-drilling), `BetRow` += effektív odds cella.
  Alternatíva: az effektív oddsot a query/section szinten előre kiszámolt stringként
  továbbítjuk, hogy a BetRow ne kapjon boost-ot. **Döntés:** a `oddsAtBet` + `oddsBoost`
  külön utazik a BetRow-ig, az effektív számítás a `formatEffectiveOdds` helperrel a
  megjelenítés helyén történik (egy forrás az igazságra).
- **`group-leaderboard-content.tsx`** és **`group-results-content.tsx`**: `GroupBet` típus
  += `oddsAtBet: string | null`; új `oddsBoost: number` prop; Odds oszlop + fejléc.
- **`group-detail-tabs.tsx`**: `GroupBet` típus += `oddsAtBet`; `oddsBoost` továbbadása a két
  tartalom-komponensnek (a `settings.oddsBoost`-ból).

## i18n (hu + en)

Új kulcsok (a pontos elnevezés implementációkor egyeztetve a meglévő konvencióval):
- `betting.lockedOddsInfo` — a tooltip magyarázó szövege (lekötött vs jelenlegi).
- `groups.odds` — az Odds oszlop fejléce a Ranglista/Eredmények tábláiban.
- „most" felirat a formban — `betting.currentOddsShort` vagy hasonló.

Minden magyar szöveg ékezetekkel, `useTranslations()`-on keresztül (nincs hardcoded string).

## Tesztelés

- **Unit (TDD):** `formatEffectiveOdds` — normál, null, boost=1.0, kerekítés.
- **Vizuális ellenőrzés:** bet-form meglévő tippel (lekötött ≠ jelenlegi), tooltip;
  BetRow élő + lezárt; Ranglista és Eredmények Odds oszlop; null-odds („—") esetek.

## Amit NEM csinálunk (scope-on kívül)

- Nincs payout-/nyeremény-megjelenítés a bet-formban (csak odds).
- Nincs séma-migráció (`oddsAtBet` már létezik).
- A Statisztika tab és a Ranglista aggregált profit-sora nem változik.
- Nem nyúlunk a pontozási/odds-rögzítési logikához (csak megjelenítés).
```
