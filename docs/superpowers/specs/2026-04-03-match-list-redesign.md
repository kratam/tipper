# Meccs lista UI redesign

## Probléma

A jelenlegi meccs lista (`tournament-tabs.tsx`) round-onként csoportosít, és minden meccs egy teljes méretű Card-ban jelenik meg. Ez túl sok helyet foglal, nem látszik azonnal van-e tippem, és navigálni kell a meccs detail oldalra a tippeléshez.

## Design döntések

### Csoportosítás: nap alapú accordion

- **Elsődleges csoportosítás**: naptári nap (pl. "2026. május 15. csütörtök")
- **Round info**: nem jelenik meg a fő struktúrában (opcionálisan a kártya detailben, ha szükséges)
- **Accordion viselkedés**:
  - Mai és holnapi nap: alapból nyitva
  - Elmúlt napok: alapból csukva
  - Fejléc mutatja: dátum + meccsszám (pl. "4 meccs")

### Filter tabek

A meccs lista tetején 3 szűrő:
- **Közelgő** (default): mai naptól előre, scheduled + live státuszú meccsek. Ha ma van live meccs, az is itt látszik.
- **Lejátszott**: finished meccsek, legfrissebb nap felül. Tegnaptól visszafelé.
- **Mind**: minden meccs időrendi sorrendben (legkorábbi nap felül)

### Kompakt meccs kártyák grid-ben

Nap accordion-on belül a meccsek 2 oszlopos grid-ben (desktop), 1 oszlopos (mobil).

**Scheduled meccs kártya layout** (~120px magas):
```
┌──────────────────────────────┐
│ 16:20                        │
│ 🇸🇪 Sweden  vs  🇩🇰 Denmark  │
│ 1: 2.10  X: 3.40  2: 2.85   │
│                      ✓ 3-1   │
└──────────────────────────────┘
```

- Bal felül: időpont (óra:perc)
- Középen: csapatok logóval + névvel, "vs" elválasztóval
- Alatta: odds sor (narancs monospace, `1: X: 2:` prefixekkel)
- Jobb alul: tipp badge

**Finished meccs kártya layout** (~140px magas):
```
┌──────────────────────────────┐
│ 16:20  ·  Vége               │
│ 🇫🇮 Finland        4 - 2    │
│ 🇨🇦 Canada                   │
│ 1: 2.10  X: 3.40  2: 2.85   │
│                      ✓ 4-2   │
└──────────────────────────────┘
```

- Fejléc: időpont + "Vége" / "LIVE" badge
- Csapatok egymás alatt (nem "vs"), eredmény nagy betűvel jobb oldalon
- Odds szürke kis betűvel (nem narancs — már nem aktuális, de informatív)
- Tipp badge szín:
  - Zöld háttér + zöld szöveg: nyerő tipp (+ payout ha van)
  - Piros háttér + piros szöveg: vesztes tipp
  - Szürke kötőjel: nem tippelt

### Tippelés: Radix Dialog (modal)

A meccs detail oldal (`/tournaments/[slug]/matches/[id]`) helyett modal nyílik kártyára kattintáskor.

**Modal tartalom:**
1. **Fejléc**: csapatok + időpont
2. **Eredménytipp**: hazai/vendég score input (közös minden csoportra)
3. **Odds megjelenítés**: 1/X/2 odds, kiemelve melyik kimenetelre tippel
4. **Csoportonkénti stake**: minden csoporthoz külön stake input + submit/update/cancel gomb
5. Ha meccs már elindult: "Tippelés lezárva" üzenet

**A modal a meglévő `BetForm` komponens logikáját használja újra**, csak Dialog wrapper-ben.

### Responsive viselkedés

| Breakpoint | Kártyák/sor | Kártya szélesség |
|------------|-------------|------------------|
| < 640px (sm) | 1 | 100% |
| >= 640px (md+) | 2 | ~50% |

Az accordion fejléc és a filter tabek mindkét méreten 100% szélességűek.

## Érintett fájlok

### Módosítandó
- `src/components/tournament-tabs.tsx` — Fő komponens újraírása: accordion + grid + filter
- `src/components/bet-form.tsx` — Kiemelés Dialog-ba, props interface megtartása
- `src/app/[locale]/tournaments/[slug]/page.tsx` — Adat előkészítés (nap szerinti csoportosítás)
- `messages/hu.json`, `messages/en.json` — Új i18n kulcsok (filter nevek, "Vége", stb.)

### Új fájlok
- `src/components/match-card.tsx` — Kompakt meccs kártya komponens
- `src/components/bet-dialog.tsx` — Radix Dialog wrapper a BetForm köré

### Törlendő
- `src/app/[locale]/tournaments/[slug]/matches/[id]/page.tsx` — A modal teljes egészében kiváltja.

## Shadcn/Radix komponensek

- `Accordion` (Radix) — nap csoportosítás (collapsible)
- `Dialog` (Radix) — tippelés modal
- `Tabs` (meglévő) — filter (Közelgő/Lejátszott/Mind)
- `Badge` (meglévő) — tipp státusz, "LIVE", "Vége"

## Nem változik

- Podium tab (meglévő `TournamentTabs` Podium fül)
- `BetForm` belső logikája (score prediction, stake, submit/cancel)
- Server action-ök (`placeBet`, `cancelBet`)
- DB séma, query-k
- Cron/sync logika
