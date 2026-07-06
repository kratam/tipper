# Dinamikus dobogó-bónusz (meccsszám-arányos)

**Dátum:** 2026-07-06
**Státusz:** jóváhagyott terv (implementáció előtt)

## Probléma

A dobogó-bónuszok (`bonusPodiumMention`, `bonusPodiumExact`) fix token-értékek.
A hivatalos WC-csoportban kézzel felhúzva `mention=100`, `exact=200` → egy
tökéletes dobogó-tipp max `3×(100+200) = 900` token. A probléma ugyanaz, mint a
[dinamikus meccs-bónusznál](2026-07-06-dinamikus-bonusz-design.md): egy fix érték
a torna elején arányos, a vége felé viszont eltörpül a felhalmozott
token-vagyonhoz képest — és ráadásul tornánként kézzel kell hangolni.

**Cél:** a dobogó-bónusz mérete kövesse a torna végi token-szintet, hogy minden
tornán arányos maradjon, de **ne** legyen a tabella döntő faktora. Mivel a
dobogó **egyszer** kerül jóváírásra (a torna végén), itt nem kell olyan óvatosnak
lenni, mint a meccsenként osztott meccs-bónusznál — a bónusz lehet bőkezűbb.

## Megoldás áttekintés

A fix token-értékeket **%-alapú, meccsszám-arányos** bónuszra cseréljük. A
per-játékos bónusz-egység:

```
egység = floor( pct / 100 × group.tokenPerMatch × meccsszám )
```

- **`meccsszám`** = a torna nem-törölt meccseinek száma. A torna végén ez pontosan
  a valós token-**floor** gerince: fejenként `initialTokens + tokenPerMatch × meccsszám`.
  (A `tokenPerMatch` minden meccs után jár, amelynek dátuma elérkezett; a torna
  végén ez az összes nem-törölt meccs.)
- **`tokenPerMatch`** csoportonként eltérhet → egy nagyobb tétű csoportban a
  dobogó-bónusz is arányosan nagyobb, ahogy a pontszámok is.
- **Két tárcsa marad**, a jelenlegi és a meccs-bónusz szerkezetével konzisztensen:
  `bonusPodiumMentionPct` (dobogóra kerülésért) és `bonusPodiumExactPct` (pontos
  pozícióért, a mention **tetejére**). Csak a szemantikájuk vált fixről százalékra.

A pontozás logikája változatlan: minden dobogóra tippelt csapatért `mentionEgység`,
és ha a pozíció is stimmel, a tetejére `exactEgység`. Tökéletes dobogó =
`3×(mention+exact)`.

### Kulcsdöntés: floor-horgony, nem tényleges pool

A meccs-bónusz a meccs aktív tippelőinek tényleges vagyonából (lifetime budget)
osztott poolból számol. A dobogó-bónuszt ezzel szemben a **determinisztikus
floorhoz** (`tokenPerMatch × meccsszám`) horgonyozzuk, nem a torna végi tényleges
összes tokenhez. Előnyök:

- **Egyszerű és előre kiszámolható:** a `meccsszám` és a `tokenPerMatch` a torna
  elején ismert, így a szabály-dialogban **konkrét token-szám** mutatható, mielőtt
  a torna véget ér — a játékos tudja, miért játszik.
- **Nem inflálódik együtt a mai magasabb meccs-bónuszokkal:** a floor stabil
  hányada a pontszám-gerincnek. (Ezt a pct megválasztásánál vesszük figyelembe —
  lásd Kalibráció.)
- Az egyszeri jellege miatt a tényleges-pool precizitása nem indokolt.

## Kalibráció (valós prod adat, FIFA WC 2026, „Ranglista" csoport)

Kontextus: 32 játékos, `tokenPerMatch=100`, `initialTokens=200`, 104 meccs
(72 kész a méréskor, ~69%). Horgony a torna végén: `tokenPerMatch × meccsszám = 10 400`.

Jelenlegi egyenlegek (72/104 meccs): medián **7 110**, p90 ~11k, max **25k**,
átlag 6 521. Torna végi becslés: floor `200 + 100×104 = 10 600`/fő; a mai magasabb
meccs-bónuszok (~+22% a medián meccs-nyereményre) felfelé tolják a végegyenlegeket
→ becsült **inflált vég-medián ~12k, top ~40k**.

Erős jel: a kézzel beállított 100/200 majdnem pontosan **1% / 2%** a `10 400`
horgonynak — tehát a horgony a helyes nagyságrend.

| mentionPct / exactPct | mention / exact (token) | tökéletes dobogó | vég-medián %-a (~12k) | top %-a (~40k) |
|---|---|---|---|---|
| 1% / 2% | 104 / 208 | 936 | ~8% | ~2,3% |
| **1,5% / 3%** | **156 / 312** | **1 404** | **~11-12%** | **~3,5%** |
| 2% / 4% | 208 / 416 | 1 872 | ~15% | ~4,7% |

**Választott default: `bonusPodiumMentionPct = 1,5`, `bonusPodiumExactPct = 3`.**
A mostani kézi 900 fölött (kompenzálja a mai bónusz-inflációt), a vég-medián
~11-12%-a, a top ~3,5%-a → érezhető, de nem döntő. **Plafon: nincs.**

## Részletes terv

### 1. Adatmodell (séma)

A `groups` táblában — a meccs-bónusz migráció mintájára:
- **Eldobjuk:** `bonus_podium_mention` (int), `bonus_podium_exact` (int).
- **Hozzáadjuk:** `bonus_podium_mention_pct` (real, default `1.5`),
  `bonus_podium_exact_pct` (real, default `3`). Az érték maga a százalék
  (`1.5` = 1,5%); `real`, hogy fél-százalék is állítható legyen.
- Séma-változás **kizárólag** `db:generate` → `db:migrate` úton (CLAUDE.md), a
  migrációt kézzel futtatjuk deploy előtt (a Vercel build nem futtatja). A régi
  token-értékeket **nem** konvertáljuk (token↔% nem egyértelmű).

### 2. Pontozás (`src/lib/scoring.ts`)

- Új pure helper:
  ```
  computePodiumUnit(pct, tokenPerMatch, matchCount)
    → Math.floor((pct / 100) * tokenPerMatch * matchCount)
  ```
  (lefelé kerekítés, a meccs-bónusz `distributeBonusPools` mintájára).
- **`calculatePodiumPoints` változatlan marad** — továbbra is abszolút token
  `bonusPodiumMention` / `bonusPodiumExact` értékeket kap a `settings`-ben. Csak a
  hívóhely számolja ki ezeket a pct-ből. Így a függvény és a meglévő tesztjei
  érintetlenek.

### 3. `finishTournament` refaktor (`src/actions/admin.ts`)

- A pontozás elején egyszer lekérjük a **`matchCount`**-ot: a torna nem-törölt
  meccseinek száma (a jelenlegi státuszok: `finished` / `scheduled`; cancelled
  nincs — ha később lesz törölt/cancelled státusz, azt kizárjuk).
- A meglévő per-`bet` → per-`group` ciklusban, csoportonként:
  ```
  mentionUnit = computePodiumUnit(group.bonusPodiumMentionPct, group.tokenPerMatch, matchCount)
  exactUnit   = computePodiumUnit(group.bonusPodiumExactPct,   group.tokenPerMatch, matchCount)
  points = calculatePodiumPoints(prediction, actual,
             { bonusPodiumMention: mentionUnit, bonusPodiumExact: exactUnit })
  ```
- A ledger-beszúrás változatlan (`type: "win"`, `referenceId: bet.id`, csak ha
  `points > 0`). A `computePodiumUnit` a group.id-től és a torna-szintű
  `matchCount`-tól függ, ezért újrafuttatásra determinisztikus.

### 4. Kerekítés + edge case-ek

- Egység: **lefelé kerekítés** (`Math.floor`).
- `pct = 0` → az adott szint egysége 0 (nincs jóváírás, a szabály-dialogban a sor
  kimarad).
- `matchCount = 0` (elvi eset) → egység 0.

### 5. UI / i18n

Frissítendő hivatkozások (`bonusPodiumMention` / `bonusPodiumExact` → `*Pct`):

- **Csoport-beállítás** (`src/components/group-detail-tabs.tsx`) és **létrehozás**
  (`src/components/create-group-form.tsx`): a két token-input helyett **%-input**,
  megfelelő label/help szöveggel. Az űrlap-default `bonusPodiumMentionPct: 1.5`,
  `bonusPodiumExactPct: 3`.
- **Szabály-dialog** (`src/lib/group-rules.ts`, `buildRuleSections` +
  `GroupRules` típus): a `+100` formátum helyett a **kiszámolt token-érték**
  (`≈ 156` / `≈ 312`), a csoport `tokenPerMatch × aktuális meccsszám` alapján —
  konkrét, és pontosan azt mutatja, amit a játékos kap. Ehhez a `matchCount`-ot át
  kell adni a `buildRuleSections`-nek (a `GroupRules` mellé paraméterként, nem a
  típusba, mert torna-szintű adat). A `bonusPodiumMention`/`bonusPodiumExact` sorok
  most a pct mezőkből számolják az értéket; a magyarázat frissül (dinamikus, a
  torna végi tokenszinthez igazodik).
- Típus-hivatkozások frissítése: `src/components/tournament-tabs.tsx`,
  `src/components/public-groups-section.tsx`,
  `src/components/public-group-dialog.tsx`, `src/components/bet-form.tsx`,
  `src/queries/groups.ts`, `src/actions/groups.ts`, `src/actions/tip-matrix.ts`,
  `src/app/[locale]/tournaments/[slug]/page.tsx`,
  `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`.
- **Seed** (`src/lib/official-group.ts`): `bonusPodiumMention: 20` /
  `bonusPodiumExact: 20` → `bonusPodiumMentionPct: 1.5` / `bonusPodiumExactPct: 3`.
- **i18n** (`messages/hu.json`, `messages/en.json`): a dobogó-bónusz label- és
  help-kulcsok szövege (fix token → „a torna végi tokenszinthez igazodik",
  %-alapú), a `howToPlay` / szabály-magyarázó szövegek. Minden magyar szöveg
  ékezetesen.

### 6. Migráció + élő viselkedés

- A dobogó **egyszer, a `finishTournament`-ben** pontozódik.
- **Már befejezett tornák érintetlenek:** a jégkorong VB-k `win` sorai maradnak
  (a régi fix értékkel), nincs visszamenőleges átszámolás.
- A **futó WC** befejezésekor már az új dinamikus képlet fut — a 104 (nem-törölt)
  meccs és a csoportok `tokenPerMatch` / pct értékei alapján.

### 7. Tesztek (TDD)

- `computePodiumUnit` pure teszt (`src/lib/scoring.test.ts`): kerekítés (floor),
  `pct = 0`, változó `matchCount` / `tokenPerMatch`, fél-százalék.
- `calculatePodiumPoints` meglévő tesztjei **változatlanul** állnak (abszolút
  értékekkel hívva).
- `buildRuleSections` teszt (`src/lib/group-rules.test.ts`): a dobogó-sor a
  `matchCount`-ból számolt token-értéket mutatja; `pct = 0` → nincs sor; üres
  dobogó-szekció kimarad.

## Nyitott kérdések

Nincs — minden döntés lezárva a brainstorming során (horgony = floor,
default 1,5% / 3%, két tárcsa megtartva).
