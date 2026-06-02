# Handoff: TippCasino — Prémium redesign & teljes képernyő-rendszer

## Áttekintés

Ez a csomag a **TippCasino** focitipp-app teljes vizuális újratervezését tartalmazza: egységes
design system (egy tab-, gomb-, kártya-, modal-rendszer), prémium „sötét kaszinó" esztétika arany
kiemeléssel, finomított háttér-textúra, valamint sötét/világos téma. A redesign az eredeti
inkonzisztenciáit (többféle tabbar, eltérő gombok, kilógó nyelvválasztó) szünteti meg.

A prototípus a következő képernyőket és modálokat fedi le, mind végigkattintható:
- **Onboarding:** landing → név-megadás → torna-választó
- **Torna-oldal:** hivatalos-csoport szalag, szűrő-tabok, nap-akkordeonok, match-kártyák
  (közelgő / élő / befejezett állapot), saját csoportok összegző, dobogó-tipp (emelvény + csapatválasztó)
- **Modálok:** tipp-leadás, élő meccs, befejezett meccs (Tippek/Statisztika tabokkal), súgó,
  csoport-szabályok, publikus csoport csatlakozás
- **Csoportok:** lista (saját / publikus / archivált), új csoport form, csoport-oldal
  (Ranglista / Eredmények / Beállítások tabok)

## A design fájlokról

A csomagban lévő fájlok **HTML-ben készült design-referenciák** — a kívánt megjelenést és viselkedést
bemutató prototípusok, **nem közvetlenül átmásolandó production kód**. A feladat ezeknek a designoknak
az **újraépítése a meglévő `tipper` kódbázis környezetében** (Next.js App Router + React +
TypeScript + Tailwind v4 + shadcn/ui + next-intl), annak bevett mintáit és komponenseit használva.

A prototípus React-et használ `React.createElement` formában (Babel-fordítással, build nélkül) —
ez a gyors prototípusozást szolgálta. A production implementáció a meglévő `.tsx` komponenseket
módosítsa/váltsa le, ne ezt a struktúrát.

## Fidelity: **High-fidelity (hifi)**

Pixel-pontos mockup végleges színekkel, tipográfiával, térközökkel és interakciókkal. A megadott
hex-értékek, méretek és állapotok pontosak. A fejlesztő a kódbázis meglévő könyvtáraival
(shadcn/ui, Tailwind, lucide-react) építse újra pixel-pontosan.

---

## Design tokenek

A teljes token-készlet a `styles.css`-ben él, `.tc-root[data-theme=…]` / `[data-accent=…]` /
`[data-density=…]` attribútumokra kötve. Production: ezeket Tailwind v4 `@theme` változókba és a
meglévő `globals.css` CSS-custom-property rendszerbe kell átültetni (a kódbázis már így működik).

### Színek — Sötét téma (alapértelmezett)
| Token | Érték | Használat |
|---|---|---|
| `--bg` | `#0e1320` | oldal háttér |
| `--bg-2` | `#131a2b` | háttér-gradiens alja |
| `--surface` | `#182135` | kártyák, panelek |
| `--surface-2` | `#1e2940` | másodlagos felület (tab-sáv, mezők) |
| `--surface-3` | `#25324d` | harmadlagos (aktív tab, pill) |
| `--border` | `rgba(255,255,255,0.09)` | kártya-keret |
| `--border-strong` | `rgba(255,255,255,0.16)` | hangsúlyos keret |
| `--text` | `#f2f5fb` | elsődleges szöveg |
| `--text-muted` | `#9aa7c2` | másodlagos szöveg |
| `--text-faint` | `#66718c` | halvány/meta szöveg |
| `--win` | `#39d99b` | nyertes tipp, profit + |
| `--loss` | `#ff6b81` | vesztes tipp, profit −, ÉLŐ jelzés |
| `--nav-bg` | `#0a0f1a` | felső nav háttér |

### Színek — Világos téma (`[data-theme="light"]`)
| Token | Érték |
|---|---|
| `--bg` | `#f4efe3` (meleg off-white) |
| `--surface` | `#fffdf8` |
| `--surface-2` | `#fbf6ec` |
| `--text` | `#221c10` |
| `--text-muted` | `#6c6149` |
| `--win` | `#18936a` · `--loss` | `#d64560` |
| `--nav-bg` | `#0e1320` (a nav sötét marad mindkét témában) |

### Accent színek (`[data-accent=…]`) — alapértelmezett: `gold`
| Accent | `--accent` | `--accent-2` | `--accent-ink` (szöveg az accent-en) |
|---|---|---|---|
| gold | `#f0b850` | `#d99a2e` | `#2a1c05` |
| ruby | `#f2657e` | `#d23f5d` | `#2a0610` |
| azure | `#4fb3f7` | `#2b86e0` | `#04162a` |
| violet | `#b08bff` | `#8b5cf6` | `#16082a` |

Származtatott: `--accent-soft = color-mix(accent 16%, transparent)`,
`--accent-line = color-mix(accent 38%, transparent)`.

### Térköz / sűrűség (`[data-density=…]`) — alapértelmezett: `regular`
| Density | `--pad-card` | `--gap` | `--row-h` |
|---|---|---|---|
| compact | 11px | 8px | 34px |
| regular | 15px | 12px | 40px |
| comfy | 20px | 17px | 46px |

### Sarkok
`--radius` (alap **14px**, tweakkel 4–24px), `--radius-sm = radius × 0.55`, `--radius-pill = 999px`.
Megjegyzés: a kör-avatarok és a státusz-badge-ek szándékosan teljesen kerekek (nem követik a tokent).

### Tipográfia
- **UI font:** Sora (alapértelmezett) — váltható Archivo / Manrope tweakkel
- **Mono:** JetBrains Mono (címsorok, számok, odds, tét, idő) — váltható Space Mono / IBM Plex Mono
- **Brand:** Russo One (csak a „TippCasino" logó-felirat és a landing cím)
- Skála: oldalcím 26–27px/700 mono · kártyacím 14–16px/700 · törzs 13.5–14px · meta 11–12px ·
  micro-label 10px/700 uppercase letter-spacing 0.12em

### Árnyékok
- `--shadow-card`: `0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 28px -22px rgba(0,0,0,0.9)`
- `--shadow` (modal): `0 18px 40px -24px rgba(0,0,0,0.85)`

### Háttér
Fix réteg (`.tc-bg`): radiális accent-glow felül + lineáris bg-gradiens, FÖLÖTTE nagyon halvány
(`opacity ~0.022`) keresztcsíkos argyle-textúra, radiális maszkkal felülre húzva. Tweakkel kikapcsolható.

---

## Egységes komponensek (a design system magja)

> A redesign fő célja az **egységesség** volt. Minden tabbar UGYANAZ a komponens, minden gomb ugyanaz
> a rendszer. Production: ezek legyenek egyetlen-egy újrahasznosított komponens (a kódbázis már
> használ shadcn-alapokat — `button.tsx`, stb. — ezeket bővítsd/egységesítsd).

### Segmented (az EGYETLEN tab-vezérlő) — `.seg` / `.seg-item`
- Konténer: `--surface-2` háttér, 1px `--border`, 4px belső padding, 4px gap, grid (egyenlő oszlopok).
- Elem: `--row-h` magas, 14px/600 szöveg, `--text-muted` → aktívban `--text`.
- **Aktív állapot:** `--surface-3`→`--surface` gradiens háttér + belső accent-keret
  (`box-shadow … 0 0 0 1px var(--accent-line) inset`) + **arany alsó-vonal** (`::before`, glow-val).
- Mobilon (≤560px): vízszintesen görgethető (`overflow-x:auto`, `max-content` oszlopok), scrollbar rejtve.
- Mindenhol ezt használja: torna-szűrő, meccs-modal tabok, csoport-oldal tabok, új-csoport form.

### Button — `.btn` + variáns
- Alap: 38px magas, `--radius-sm`, 14px/650, `:active` 1px lefelé.
- `.btn-primary`: accent→accent-2 gradiens, `--accent-ink` szöveg, accent-árnyék, 750 súly.
- `.btn-secondary`: `--surface-2` háttér, `--border` keret.
- `.btn-ghost`: átlátszó, hoverre `--surface-2`.
- `.btn-outline`: átlátszó, `--border-strong` keret.
- `.btn-danger`: `--loss-soft` háttér, `--loss` szöveg (csoport törlése).
- `.btn-google`: fehér háttér, sötét szöveg (csak a landing belépés gombja).
- Méret: `.btn-sm` = 32px.
- **Fontos:** minden `<button>`-ön `appearance:none` (különben világos témában a natív fehér háttér
  átüt — ez volt egy konkrét bug-forrás).

### Card / panel — `.panel`, `.match`, `.gcard`, `.acc-card`
`--surface` háttér, 1px `--border`, `--radius`, `--shadow-card`. Hoverre 2px emelkedés + accent-keret.

### Accordion kártya — `.acc-card` / `.acc-head` / `.acc-body`
A Ranglista ÉS Eredmények tab UGYANEZT használja (egységesség!). `.acc-body` mindig **tömör**
`--surface` háttérrel (a kiemelt `.me` sornál is, hogy a lenyitott rész ne legyen áttetsző).

### Pill / badge — `.pill`, `.status-badge`
Mono 11px, `--surface-3` háttér. Variánsok: `.pill-win`/`.pill-loss` (profit), státusz: active/upcoming/finished.

### Avatar — `.avatar`
Kör, kezdőbetűk, megadott háttérszín. Mindenhol azonos (nav, ranglista, fogadás-sorok, csoport-kártyák).

### Switch, NumInput, textarea, name-input
Beállítás-űrlapokhoz; `--surface-2` háttér, accent-gradiens a bekapcsolt switchen.

---

## Képernyők

> Pontos felépítést lásd a forrásfájlokban (alább). Itt a lényeg és a layout.

### 1. Landing (`src/landing.jsx` → `Landing`)
- Teljes képernyő (NINCS nav), függőlegesen középre, `min-height:100vh`, 56px gap.
- Hero: logó 104px (accent drop-shadow glow), brand-gradiens cím (Russo One, clamp 48–80px),
  alcím (max 440px, `--text-muted`), Google-belépés gomb (50px, fehér, valódi színes Google-G SVG).
- 3 feature-kártya (`repeat(3,1fr)`, mobilon 1 oszlop): ikon (accent-soft korong) + cím + leírás.
  Tartalom: „Tippelj" (target ikon), „Versenyezz" (users), „Nyerj" (trophy).
- Lábléc: Adatvédelem · Felhasználási feltételek.

### 2. Név-megadás modal (`NameModal`)
Első belépéskor. Hero-fejléc (users ikon + „Üdv a fedélzeten!"), középre igazított becenév-input
(max 20 kar, számláló), „Kezdés" gomb (csak nem-üres névnél aktív).

### 3. Torna-választó (`TournamentPicker`)
`.tour-row` sorok: accent-gradiens trophy-ikon (aktívnál) / dim (jövőbeli), név + meta
(dátum · csapatszám), jobbra státusz-badge + „N csoportod" + chevron. Csak az aktív kattintható.

### 4. Torna-oldal (`src/app.jsx`)
- **Nav** (sticky, `--nav-bg`, blur): brand (logó + Russo One gradiens név, mobilon csak logó) ·
  linkek (Tornák / Csoportok) · jobbra súgó-ikon, nyelv-pill (HU), felhasználó-pill (avatar + név +
  kijelentkezés-ikon; mobilon csak avatar).
- **Oldalfejléc:** accent-gradiens korona-badge (46px) + „FIFA WC 2026" (mono 27px).
- **Hivatalos-csoport szalag** (`.ribbon`): accent-keret, gradiens fejléc-háttér; fejléc =
  korona + helyezés-stat + „köv. 3 nap" jegyzet + „Részletek →" (a csoport oldalára visz) + chevron.
  Lenyitva: „Ranglista" + Szabályok gomb, majd a ranglista-lista — **az egész lista kattintható**,
  alul „Csoport megnyitása →", a csoport oldalára navigál.
- **Szűrő-tabok** (Segmented): Közelgő / Lejátszott / Mind / Dobogósok.
- **Nap-akkordeonok** (`.day`): fejléc = dátum + „N/M tipp" (teljesnél `--win`) + chevron; lenyitva
  3-oszlopos match-grid (mobilon 2, majd 1).
- **Match-kártya** (`.match`) — három állapot:
  - *közelgő:* idő + helyszín, csapatok zászlóval, 1/X/2 odds (érték-szín: kék→lila→narancs az odds
    nagysága szerint), saját tipp (célkereszt + eredmény) vagy „Nincs tipp" (bal accent-sáv).
  - *élő:* bal `--loss`-sáv, pulzáló „ÉLŐ" jelzés az idő helyén.
  - *befejezett:* eredmény az idő helyén, a saját tipp nyert/vesztett színezve, profit-pill.
  - Kattintásra: közelgő → tipp-modal; élő/befejezett → meccs-modal.
- **Saját csoportok összegző** (`OwnGroupsSummary`, csak a „Közelgő"/„Mind" nézet alján):
  „Csoportjaim" szekciócím + kártyarács. Kártya: ikon (hivatalosnál arany korona) + név + taglétszám +
  helyezés (#N / összes) · mini top-3 ranglista érmekkel · profit + „hiányzó tipp"/„köv. 3 nap kész".
- **Dobogós tab** (`PodiumTab`): emelvény — 2. (bal, ezüst), 1. (közép, arany, legmagasabb 124px),
  3. (jobb, bronz); CSS `order`-rel rendezve. Üres hely = szaggatott + „Válassz"; kitöltve =
  zászló-korong + név. Kattintásra `TeamPickerModal` (kereshető csapatlista, már kiválasztottak
  letiltva). Alul „Dobogó-tipp leadása" (csak mindhárom kitöltve).

### 5. Tipp-leadás modal (`BetModal`, `src/app.jsx`)
Csapatnevek sora, alatta a léptetős eredmény-beállító **a zászlók a léptetők mellett** (haza zászló —
léptető — `:` — léptető — vendég zászló), 1/X/2 cellák (a tippelt kimenetel kiemelve), elválasztó,
„Ranglista" + egyenleg, tét-preset gombok (10/50/100/250), elsődleges „Tipp leadása/módosítása".

### 6. Meccs-modal — élő / befejezett (`MatchResultModal`, `src/match-detail.jsx`)
Scoreboard (zászló + név | középen eredmény vagy pulzáló ÉLŐ | zászló + név), majd Segmented
**Tippek / Statisztika**:
- *Tippek (élő):* tét szerint rendezett fogadás-sorok (avatar, név, tipp, odds, tét/nyeremény);
  saját sor kiemelve; „Összes (N)" kibontás.
- *Tippek (befejezett):* „Dobogó" (🥇🥈🥉) + „Körülötted" ablak (a saját helyezés köré), profit
  +/− színezve; „Teljes ranglista (N)" kibontás.
- *Statisztika:* „1–X–2 megoszlás" — KÉT vízszintes sáv (db szerint és tét szerint), lekerekített
  **gradiens szegmensek** mono 1/X/2 címkével + legend; „Eredmény-tippek" (leggyakoribb, átlag,
  pontos találat **célkereszt-ikonnal** [NEM emoji], helyes kimenetel); „Tét" (legnagyobb/össz/átlag).

### 7. Súgó modal (`HelpModal`, `src/app.jsx`)
Hero-fejléc (accent-glow), 3 számozott lépés, „Pontozás" + zseton-modell KV-sorok, „Értem" gomb.

### 8. Csoport-oldal (`src/group-page.jsx` → `GroupDetail`)
- Fejléc: torna-breadcrumb (vissza a listára) + csoportnév (mono 26px) + „N hiányzó tipp" + szabályok-ikon.
- Segmented: **Ranglista / Eredmények / Beállítások**.
- *Ranglista:* profit-rangsor accordion-kártyákban (érem/`#N`, avatar, név, profit); lenyitva a
  játékos meccsenkénti tippbontása (`MatchRow`).
- *Eredmények:* befejezett meccsek accordion-kártyákban (zászlók + eredmény); lenyitva **inline** a
  fogadás-sorok (ki mit tippelt + nyeremény) — UGYANAZ a kártya, mint a Ranglistánál.
- *Beállítások:* „Pontozás" kártya NumInput-okkal (odds-szorzó, veszteség%, bónuszok), „Láthatóság"
  (publikus switch + leírás textarea), „Tagok" (avatar + név + eltávolítás-ikon), Mentés/Kilépés,
  „Veszélyzóna" (csoport törlése).
- **Csoport-szabályok modal** (`GroupRulesModal`): kezdő egyenleg / kifizetés / dobogó-tipp KV-sorok.

### 9. Groups lista (`src/group-list.jsx` → `GroupsList`)
- Cím + „Új csoport" gomb.
- „Csoportjaim" rács: `.gcard` — **gradiens fejléc** (`#1e3a5f`→`#2d1b69`, sarokban accent-glow) név +
  torna + profit-badge; törzs leírás + taglétszám + státusz-badge.
- „Publikus csoportok" rács: szaggatott keret + glóbusz; kattintásra `JoinPublicModal`.
- „Archivált tornák (N)" lenyitható szekció.
- **Új csoport modal** (`NewGroupModal`): név-input, torna-választó (segmented), pontozási sablon
  (Laza/Standard/Hardcore), publikus switch, Mégse/Létrehozás.
- **Publikus csatlakozás modal** (`JoinPublicModal`): gradiens fejléc, leírás, info-jegyzet, Csatlakozás.

---

## Interakciók & viselkedés

- **Navigáció** (prototípusban `screen` state-tel, production: Next.js App Router útvonalakkal):
  landing → tournaments → tournament → groups-list → group. A `screen` localStorage-ban perzisztált
  (reload megőrzi a pozíciót) — production: ez természetesen az URL-ből jön.
- **Modálok:** overlay (`rgba(5,8,15,0.66)` + blur), kattintás a háttérre vagy X = zárás; tartalom
  `stopPropagation`. Belépő animáció: overlay fade 0.18s, modal pop (10px fel + scale .98→1) 0.2s
  `cubic-bezier(.2,.8,.2,1)`.
- **Hover:** kártyák 2px emelkedés + accent-keret; gombok világosodás/háttérváltás.
- **Aktív tab:** arany alsó-vonal + accent-keret + kiemelt háttér (lásd Segmented).
- **Form-validáció:** „Kezdés"/„Létrehozás"/„Dobogó-tipp" gombok csak a kötelező mezők kitöltésekor
  aktívak (opacity + pointer-events).
- **prefers-reduced-motion:** az ÉLŐ-pulzálás és belépő-animációk mögé tegyél `@media` gate-et
  (a prototípus a pulzálást mindig futtatja — production finomítsa).

## Reszponzivitás
- ≤700px: nav tömörödik (brand-felirat, „HU" szöveg, felhasználónév eltűnik — csak ikon/avatar marad);
  oldalcímek kisebbek.
- ≤560px: Segmented tabok vízszintesen görgethetők; match-grid 1 oszlop.
- ≤400px: súgó-ikon elrejtve.
- Globális `overflow-x:hidden` a vízszintes túlcsordulás ellen.
- Hit-targetek ≥34px (compact) … 46px (comfy); a mobil minimumot tartsd ≥44px-en ahol kritikus.

## State (prototípus → production)
- `screen` → útvonal (App Router).
- `filter` (torna-szűrő), `tab` (modal/csoport tabok), `open`/`expanded` (akkordeonok) → lokális UI state.
- `sel` (dobogó kiválasztás), `picker` (nyitott csapatválasztó), `modalMatch`, `showHelp`, `showName` →
  lokális state / útvonal-paraméter.
- Beállítások (`s`, `isPublic`, `desc`) → form state + server action (a kódbázisban már van
  `placePodiumBet`, `podium-bets` action minta).
- A tweak-rendszer (téma/accent/sűrűség/sarok/font) prototípus-eszköz — production NEM kell, de a
  sötét/világos témaváltás igen (a kódbázis `next-themes`/`.dark` mintát használ).

## Pontozási modell (a kódból kiolvasva, a statisztikákhoz használt)
Kifizetés = `tét × odds × oddsBoost`, **+ gólkülönbség-bónusz** (helyes különbségnél),
**+ pontos-eredmény-bónusz** (pontos eredménynél). Téves tippnél részleges **visszatérítés**
(`tét × (100 − lossPercentage)%`). Csoportonként konfigurálható (lásd Beállítások / Szabályok modal).
Dobogó-tippnél: helyes csapat említése + pontos helyezés bónusz. **Ezek a számértékek példák** a
prototípusban — a tényleges szabályokat a csoport-beállítások adják.

## Assetek
- `tippcasino-logo.png` — a meglévő logó (a kódbázis `public/`-jából). Nav, landing, token-ikon
  (a „zseton" = a logó kicsinyítve).
- **Zászlók:** `flagcdn.com/w40/<iso>.png` (ugyanaz a forrás, mint az eredeti app). Skót zászló: `gb-sct`,
  angol: `gb-eng`.
- **Ikonok:** lucide-stílusú vonalas SVG-k (a prototípusban kézzel; production: `lucide-react`, ami
  már függőség). NINCS dekoratív emoji — kivétel a ranglista-érmek (🥇🥈🭉), ami bevett konvenció;
  ha teljes emoji-mentesség kell, cseréld stilizált arany/ezüst/bronz jelvényre.
- **Fontok:** Google Fonts — Sora, Archivo, Manrope, JetBrains Mono, Space Mono, IBM Plex Mono,
  Russo One. Production: `next/font` (a kódbázis már így tölti a Geist + Russo One fontokat).

## Fájlok ebben a csomagban
| Fájl | Tartalom |
|---|---|
| `TippCasino.html` | belépési pont — fontok, script-sorrend, bundler-thumbnail |
| `styles.css` | **a teljes design system** — tokenek, témák, minden komponens-stílus |
| `src/data.js` | a screenshotból újraépített adat (meccsek, fogadások, csoportok, csapatok, tornák) + pontozási logika |
| `src/icons.jsx` | lucide-stílusú vonalas ikon-készlet |
| `src/kit.jsx` | **közös primitívek:** Segmented (tab), Btn, Avatar, TokenIcon |
| `src/app.jsx` | torna-oldal, nav, szalag, match-kártya, tipp-modal, súgó, App-routing, tweak-panel |
| `src/match-detail.jsx` | élő/befejezett meccs-modal (Tippek/Statisztika) |
| `src/group-page.jsx` | csoport-oldal (Ranglista/Eredmények/Beállítások) + szabályok-modal + Switch/NumInput |
| `src/podium.jsx` | dobogó-tab + csapatválasztó + saját csoportok összegző |
| `src/group-list.jsx` | groups lista + új csoport form + publikus csatlakozás |
| `src/landing.jsx` | landing + torna-választó + név-megadás modal |
| `tweaks-panel.jsx` | prototípus-eszköz (téma/tweak vezérlők) — **production NEM kell** |

### Implementációs megjegyzés
A meglévő `tipper` kódbázis komponensei (`tournament-tabs.tsx`, `match-card.tsx`, `bet-form.tsx`,
`group-detail-tabs.tsx`, `podium-form.tsx`, `nav.tsx`, `group-card.tsx`, stb.) felelnek a fenti
képernyőknek — ezeket kell a redesign szerint frissíteni, a `styles.css` tokeneket a Tailwind
`@theme` + `globals.css` rendszerbe átültetve. A legfontosabb egységesítés: **egyetlen** Segmented
tab-komponens és **egyetlen** Button-rendszer az egész appban.
