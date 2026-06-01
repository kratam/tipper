# Modál header layout — egységesítés + vízszintes scoreboard

**Dátum:** 2026-06-01
**Státusz:** jóváhagyásra vár

## Probléma

1. A `bet-dialog` lejátszott/élő fejlécében a `DialogContent` abszolút X-e a tartalom
   fölött lebeg → a jobb oldali zászló aszimmetrikusan jobbra tolva (`pr-8`), az
   eredmény a „Vége" badge miatt feljebb csúszik.
2. Élő meccsnél **nincs livescore**, ezért a 0–0 valószínűleg hamis.
3. A `bet-dialog` két állapota (tippelhető vs. lejátszott/élő) két különböző
   fejléc-világot használ: a tippelhető egy dátum-header + középre rendezett kártya,
   a lejátszott/élő egy zászló-grid címként. Nincs közös minta.
4. A `public-group-dialog`-on `showCloseButton={false}` miatt egyáltalán nincs X.

## Vezérelv

- **Az X soha nem lóg tartalom fölé** — a modál teteje egy header-sáv (dátum balra,
  X jobbra), a tartalom alatta kezdődik, vízszintesen szimmetrikusan.
- **Egy közös vízszintes „scoreboard" sor** mindhárom meccs-állapotra:
  `[zászló] [közép] [zászló]`, a nevek a zászlók alatt.

## Új komponens: `MatchScoreboard`

`src/components/match-scoreboard.tsx`

- **Egyetlen felelősség:** a meccs scoreboard-sorának renderelése.
- **Props:** `homeTeam`, `awayTeam` (`{ name, logoUrl }`), és egy `center` slot
  (ReactNode) a két zászló közé.
- **Layout:** grid `[1fr_auto_1fr]`:
  - 1. sor: home logo · `center` · away logo (függőlegesen középre igazítva)
  - 2. sor: home név · (üres) · away név (a zászlók alatt, középre)
- **Függ:** `TeamLogo`. Nincs üzleti logika, tisztán prezentációs.

A `center` slot tartalma hívónként:
- **tippelhető (BetForm):** `[ScoreStepper] : [ScoreStepper]` — függőleges chevron
  léptetők (`+` a szám fölött, `–` alatta).
- **lejátszott (bet-dialog):** `6 : 0` (font-mono, bold).
- **élő (bet-dialog):** piros, pulzáló `ÉLŐ` (Circle pötty + `t("live")`), kettőspont nélkül.

## Változások

### 1. `src/components/match-scoreboard.tsx` (új)

A fenti komponens. `ScoreStepper` átalakítása függőleges (chevron fölött/alatt)
elrendezésre — vagy a `bet-form.tsx`-ben marad és a betform adja át `center`-ként.
Döntés: a `ScoreStepper` a `bet-form.tsx`-ben marad (csak ott kell), de függőleges
elrendezésűre alakul.

### 2. `src/components/bet-form.tsx`

- A jelenlegi középre rendezett kártya-grid (logók/nevek/léptetők) helyett
  `<MatchScoreboard center={<léptetők>} />`.
- A `ScoreStepper` függőleges (chevron fölött/alatt) elrendezésű lesz.
- Az odds-sor (1/X/2) a scoreboard alá kerül, középre.
- A per-group tét/submit rész változatlan.
- A dátum továbbra is a dialog headerben (nem itt).

### 3. `src/components/bet-dialog.tsx`

- A **lejátszott/élő ág** is a **dátum-headert** kapja (`MatchDateTime` + abszolút X),
  mint a betform — a zászló-grid-cím megszűnik.
- A header alatt `<MatchScoreboard center={...} />`:
  - `finished` (van eredmény) → `6 : 0`,
  - `live` → `ÉLŐ`,
  - egyéb (pl. cancelled) → halvány `vs`.
- `showScore` csak `finished`-re igaz. Nincs „Vége" badge → a `Badge` import törölhető.
- Alatta a Tippek/Statisztika tabok + group bets (változatlan).
- Az aszimmetrikus `pr-8` és a régi flex-col stack megszűnik.

### 4. `src/components/ui/dialog.tsx`

- A close-X térköz beépítése konvencióként: a `DialogHeader` alapból fenntartja a
  jobb felső helyet az X-nek (pl. `pr-8` a headeren), hogy ne kelljen modálonként
  külön kompenzálni. A help-dialog kézi `pr-8`-ja így elhagyható.

### 5. `src/components/public-group-dialog.tsx`

- A gradient headerbe **fehér X** kerül (jobb felső sarok), `DialogPrimitive.Close`-zal.
  `showCloseButton={false}` marad (a saját X-et a header adja).

### 6. `help-dialog.tsx`, `display-name-dialog.tsx`

- A help-dialog kézi `pr-8`-ja elhagyható (a `DialogHeader` adja). Funkcionálisan
  nincs más változás.

## Nem cél (YAGNI)

- Nincs generikus `Modal`/`ModalHeader` absztrakció (a shadcn `Dialog*` marad).
- Nincs livescore bevezetés.
- A match-card (lista) zászló-renderelésének egységesítése a `MatchScoreboard`-dal
  most nem cél (későbbi lehetőség).

## Tesztelés

- Vizuális: tippelhető (chevron léptetők, odds), lejátszott (`6 : 0`), élő (`ÉLŐ`),
  szimmetrikus zászlók, X nem ütközik; public-group X működik.
- `npm run check` + `npx tsc --noEmit` tiszta.
- Pure logika nem változik → nincs új unit teszt. A `MatchScoreboard` prezentációs;
  ha kell, egy egyszerű render-teszt (nevek/center megjelenik).
