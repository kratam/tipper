# Badge / achievement rendszer — tervdokumentum

**Dátum:** 2026-06-27
**Státusz:** jóváhagyott terv (implementáció előtt)
**Fázis:** 2/2 — a Phase 1 in-app értesítő rendszerre épül (lásd `2026-06-24-notifications-design.md`).

## Cél és hatókör

Játékosok teljesítményét elismerő **jelvény-rendszer** (badge / achievement). Egy
játékos meccs-, forduló- és torna-szintű eredményeiért **jelvényeket** szerez, amelyek
egy publikus **profil-oldal „trófea-szekrényében"** és a ranglistán a neve mellett
jelennek meg. Új jelvény / szintlépés in-app értesítést küld a Phase 1 rendszeren.

**Vezérlő elvek:**
- **Kevés típus, sok számláló + ritkasági szint.** 10 badge-típus, mindegyik
  bronz/ezüst/arany szinttel — nem inflálódik, mégis sokan kapnak és van benne fejlődés.
- **Csak mostantól, nincs backfill.** A rendszer élesítésekor nem osztunk visszamenőleg
  jelvényt; a szekrények organikusan, menet közben telnek. (A múltbeli adat csak a
  küszöb-kalibrációt szolgálta.)
- **Determinisztikus, pure logika** — a badge-állapot a tippek/eredmények tiszta
  függvénye, a `scoring.ts` mintájára tesztelhető.

**v1 explicit korlátok:** csak a hivatalos Ranglistából számolunk (privát csoportok/körök
nem termelnek jelvényt); nincs jelvény-csere/-piac, nincs egyedi illusztrált grafika
(Lucide ikonok), nincs jelvény-alapú token/jutalom (tisztán presztízs).

## Hatókör: csak a hivatalos Ranglista

Minden badge-evaluáció a torna **hivatalos „Ranglista" csoportjának**
(`OFFICIAL_GROUP_SLUG = "hivatalos"`, `src/lib/official-group.ts`) tippjeire és
ranglistájára szűr. Indok (prod-adat 2026-06-27):

- Gyakorlatilag mindenki a hivatalos Ranglistán játszik (FIFA WC 2026: 32 tag / 29
  tippelő); egyetlen marginális privát csoport van (2 tippelő).
- **Senki nem tippel ugyanarra a meccsre több csoportban** (0 átfedés 1652
  user-meccs kombinációból) → tiszta, egyetlen idővonal játékosonként.
- Kizárja a farmolást (nem lehet több saját csoporttal sokszorozni) és a kis-kör
  trivializálást (relatív jelvény 2 fős körben).

Később bővíthető (privát csoport / kör hatókör), de v1-ben szándékosan kimarad.

## Badge-katalógus

10 típus. A **streak-jellegűeknél** (🎲, 🎯) a szint maga a sorozathossz, és **csak az
aktuális csúcs** látszik (ha bejön a 7-es, az 5-ös eltűnik). A **többinél** a kumulált
darabszám hajtja a szintet. A küszöbök prod-adatból kalibrálva (2026-06-27, hivatalos
Ranglista, 1478 lepontozott tipp, 35 játékos).

### Abszolút jelvények (önmagukban értelmesek, akár 1 fős mezőnyben)

| Badge | Kulcs | Trigger | 🥉 Bronz | 🥈 Ezüst | 🥇 Arany | Mechanika |
|---|---|---|---|---|---|---|
| 🎲 Nyerő széria | `win_streak` | leghosszabb megszakítatlan nyerő (1X2-helyes) tipp-sorozat | 3 | 5 | 8 | streak-csúcs |
| 🎯 Telitalálat | `exact_streak` | leghosszabb megszakítatlan pontos-eredmény sorozat | 2 | 3 | 4 | streak-csúcs |
| 🎰 Jackpot | `jackpot` | nyertes tipp nagy odds-szal (min. tét = Ranglista `tokenPerMatch`) | odds ≥ 3.0 | odds ≥ 5.0 | odds ≥ 7.0 | odds-szint |
| ☀️ Nyerő nap | `perfect_day` | egy naptári napon (`date(scheduledAt)`) ≥4 tipp, mind nyert | 1 | 3 | 7 | darabszám |
| 🔮 Jósda | `oracle` | dobogós tipp pontos pozícióval | 1 | 3 | 6 | darabszám |

**Kalibrációs alap:**
- 🎲 Nyerő széria: 3-as sorozat 27, 5-ös 16, 7-es 3, egy magányos 12-es játékos.
- 🎯 Telitalálat: pontos eredmény a tippek 8%-a; 1 db majdnem mindenkinek (28/35), 2
  egymás után már csak 7, 3 egymás után 1 játékos → ezért sorozat-alapú és exkluzív.
- 🎰 Jackpot: nyertes tippek odds-medián 1.42, p95 = 3.49, max 9.0; 3.0+ → 81, 5.0+ →
  7, 7.0+ → 4 nyertes tipp. Min. tét a 6 triviális (1–20 tokenes) potyatétet zárja ki.
- ☀️ Nyerő nap: 22 ilyen nap, 15 játékostól; napi max 6 tipp.

### Relatív jelvények (a hivatalos Ranglista mezőnyéhez mérve)

| Badge | Kulcs | Trigger | 🥉 Bronz | 🥈 Ezüst | 🥇 Arany | Mechanika |
|---|---|---|---|---|---|---|
| 🏅 Fordulógyőztes | `round_winner` | tiéd a forduló (`matches.round`) legnagyobb nettó nyereménye | 1 | 3 | 7 | darabszám |
| 👑 Bajnok | `champion` | 1. a Ranglistán a torna végén | 1 | 3 | 5 | darabszám |
| 🥈 Dobogós | `podium` | top3 a Ranglistán a torna végén | 1 | 3 | 7 | darabszám |
| ⭐ Trónfoglaló | `throne` | valaha vezetted a Ranglistát egy tornában | 1 | 3 | 10 | darabszám |
| 🔴 Piros lámpás | `red_lantern` | utolsó lettél a Ranglistán a torna végén (önironikus) | 1 | 3 | 5 | darabszám |

A relatív jelvényeknek még nincs lezárt tornás adata, így küszöbeik tapasztalati
becslések — menet közben (kódból) hangolhatók.

## Adatmodell

### Badge-katalógus — kódban (nem DB)

A definíciók verziózott kód-konstansok (`src/lib/badges/catalog.ts`), nem DB-tábla:

```ts
type TierThresholds = { bronze: number; silver: number; gold: number };
type BadgeMechanic = "streak" | "count" | "odds";

interface BadgeDef {
  key: string;                 // "win_streak", "jackpot", ...
  icon: string;                // Lucide ikon-név (pl. "dice-5", "trophy")
  mechanic: BadgeMechanic;     // hogyan képződik a szint az értékből
  thresholds: TierThresholds;  // bronz/ezüst/arany küszöb
  scope: "absolute" | "relative";
  trigger: "match" | "round" | "tournament";
}

export const BADGES: readonly BadgeDef[] = [ /* a fenti 10 */ ];
```

Indok: a küszöbök, ikonok, i18n-kulcsok és a tier-logika kód-szintűek; egy DB-katalógus
felesleges join és migrációs teher lenne. Az i18n-szövegek a `messages/*.json`-ban élnek.

### `user_badges` — per játékos, per badge-típus egy sor

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | uuid PK | |
| `userId` | uuid FK → `users.id` (cascade delete) | |
| `badgeKey` | text | a katalógus-kulcs (`win_streak`, …) |
| `tier` | smallint | elért szint: 1=bronz, 2=ezüst, 3=arany |
| `count` | integer | darabszám VAGY streak-csúcs (mechanika szerint) |
| `bestValue` | numeric, nullable | büszkeség-érték: legnagyobb behozott odds (Jackpot), leghosszabb sorozat (streak) |
| `firstEarnedAt` | timestamp | a bronz megszerzésének ideje |
| `updatedAt` | timestamp | utolsó szintlépés / count-frissítés |

- **Unique** `(userId, badgeKey)` — egy típus egy sor; a szint/szám frissül (upsert).
- **Index** `(userId)` — a profil-oldal és ranglista-ikonsor lekérdezéséhez.

Megjegyzés: a badge **nem** ír `token_ledger`-t és nem érinti a `token_type` enumot —
tisztán presztízs, a ranglista-pontszámra nincs hatása.

## Logika — derive-and-diff evaluator

A badge-állapot a tippek/eredmények **determinisztikus függvénye**. Minden triggernél:

1. **Derive:** újraszámoljuk az érintett játékos(ok) badge-állapotát a hivatalos
   Ranglista lepontozott tippjeiből / végeredményéből (pure függvények,
   `src/lib/badges/evaluate.ts`).
2. **Diff:** összevetjük a tárolt `user_badges` sorral.
3. **Persist + notify:** csak a **növekményt** írjuk (új badge vagy magasabb tier /
   nagyobb count), és a növekményekre **aggregált** értesítést küldünk.

Előnyök: **idempotens** (a cron/QStash újra futhat, nem duplikál), robusztus a
sorrend-független pontozásra (késő meccs is helyesen rekonstruálja a sorozatot), és
tesztelhető. A `derive` réteg pure (DB nélkül), a tippek/eredmények listáját kapja
bemenetként → Vitest-tel fedhető, mint a `scoring.ts`.

### Pure derive-függvények (`src/lib/badges/evaluate.ts`)

- `computeWinStreak(orderedBets)` → leghosszabb 1X2-helyes sorozat.
- `computeExactStreak(orderedBets)` → leghosszabb pontos-eredmény sorozat.
- `computeJackpots(bets, minStake)` → nyertes, odds-küszöböt elérő tippek + max odds.
- `computePerfectDays(betsByDay)` → ≥4 tippes, hibátlan napok száma.
- `tierFor(def, value)` → érték → bronz/ezüst/arany (vagy 0).

A relatív badge-ek (`round_winner`, `champion`, `podium`, `throne`, `red_lantern`) a
ranglista-/forduló-aggregátumokból számolnak (lásd Trigger-pontok).

### Idempotens pers-réteg (`src/lib/badges/award.ts`)

`awardBadges(userId, derivedState)` — összeveti a `user_badges` sorokkal, upsert-eli a
növekményt, és visszaadja a ténylegesen új/emelkedett jelvények listáját az
értesítéshez. A persist nem-tranzakciós (Neon HTTP), de a `(userId, badgeKey)` unique +
„csak előre" (monoton növő tier/count) frissítés idempotenssé teszi.

## Trigger-pontok

| Mikor | Hol | Badge-ek |
|---|---|---|
| meccs lepontozva | `scoreMatch` után — `src/lib/sync.ts:~478`, a `token_ledger` insert ágában | 🎲 `win_streak`, 🎯 `exact_streak`, 🎰 `jackpot` |
| forduló lezárult | új `evaluateRoundIfComplete(tournamentId, round)` a `syncFixtures` végén | ☀️ `perfect_day`, 🏅 `round_winner`, ⭐ `throne` |
| torna lezárva | `finishTournament` után — `src/actions/admin.ts:~258` | 👑 `champion`, 🥈 `podium`, 🔴 `red_lantern`, 🔮 `oracle` |

**Forduló-zárás detektálása:** egy meccs lepontozása után megnézzük, hogy a meccs
`round` értékéhez tartozó **összes** meccs `finished`/`cancelled`-e
(`isRoundComplete(tournamentId, round)`); ha igen és még nem értékeltük, lefut a
forduló-szintű evaluáció. Idempotenciát a derive-and-diff biztosítja (újrafutásra nem
duplikál). A `round` a legtöbb tornán ISO-dátum (`YYYY-MM-DD`), override-nál logikai
(`SF`/`QF`); a 🏅 Fordulógyőztes a `round` mezőt, a ☀️ Nyerő nap a `date(scheduledAt)`
naptári napot használja.

**Fordulógyőztes nettója:** a forduló `token_ledger` `win`/`refund` − `bet` egyenlege
játékosonként (a hivatalos Ranglista-csoportban), a legnagyobb nettó nyer. Holtverseny
esetén mindkét/minden élen lévő játékos megkapja.

**Trónfoglaló:** a forduló-záráskor lekérdezzük a hivatalos Ranglista pillanatnyi 1.
helyezettjét; ha még nincs `throne` jelvénye az adott tornára, megkapja. (A „valaha
vezetett" állapot tornánként egyszer számít az aranyhoz vezető darabszámba.)

## Értesítés-integráció

A meglévő `createNotificationForUser({ type: "badge", data, href })` hívása
(`src/lib/notifications.ts`). Egy trigger-menetben **gyűjtjük** a játékos növekményeit,
és **aggregáltan** küldünk:

- **1 jelvény:** konkrét szöveg — `data = { badgeKey, tier, count, bestValue?, href }`.
- **több jelvény:** összevont — `data = { aggregate: true, count: N, items: [...] }` →
  „N új jelvényt szereztél!".

A `href` a saját profil trófea-szekrényére mutat.

**Phase 1 hiányosság javítása:** a `src/lib/notification-display.ts`
`notificationContent` badge-ága jelenleg **nem adja át a `data`-t** a `t()`-nek. Bővíteni
kell, hogy az ICU-interpoláció működjön:

```ts
if (n.type === "badge") {
  const data = (n.data ?? {}) as { badgeKey?: string; aggregate?: boolean; [k: string]: unknown };
  if (data.aggregate) {
    return {
      title: t("badge.aggregate.title"),
      body: t("badge.aggregate.body", { count: Number(data.count) }),
    };
  }
  const badgeKey = data.badgeKey ?? "unknown";
  return {
    title: t(`badge.${badgeKey}.title`, data),
    body: t(`badge.${badgeKey}.body`, data),
  };
}
```

## UI

### Profil-oldal — `/[locale]/u/[userId]`

Új, **publikus profil-oldal** (eddig csak becenév-állítás létezett). Tartalom:

- **Fejléc:** avatar + becenév (`users.displayName`).
- **Trófea-szekrény:** mind a 10 badge rácsban; a megszerzettek a tier-színükben (Lucide
  ikon + bronz/ezüst/arany), számmal (`×7`) / streak-csúccsal; a meg-nem-szerzettek
  halványan (a fejlődés célként látszik). Badge-re koppintva tooltip/popover: leírás,
  szint, dátum.
- **Statisztikák:** összes tipp, találati arány (1X2), legjobb nyerő sorozat, legnagyobb
  behozott odds (Jackpot), eddigi torna-helyezések. Új query-réteg
  (`src/queries/profile.ts`), a hivatalos Ranglista adataiból.

**Láthatóság:** csak az nézheti, akivel a megtekintőnek **közös hivatalos Ranglistája
vagy köre** van (a baráti-kör szellemében). Egyébként 404 / „nem elérhető".

### Ranglista ikon-sor

A ranglista-soroknál a becenév mellé a játékos **legfeljebb 3 legmagasabb** jelvénye
(tier szerint rendezve, Lucide ikon a tier-színben). A névre/ikonra koppintva a
profil-oldalra navigál. A `GroupLeaderboardContent` és a kör-nézet kap egy opcionális
badge-ikon listát játékosonként (batch-lekérdezés, N+1 nélkül).

### Grafika

**Lucide ikonok + arany tiering**, custom rajz nélkül. Javasolt ikon-hozzárendelés:
🎲 `dice-5`, 🎯 `target`, 🎰 `coins`/`gem`, ☀️ `sun`/`sunrise`, 🔮 `sparkles`,
🏅 `medal`, 👑 `crown`, 🥈 `award`, ⭐ `star`, 🔴 `flame`/`circle-dot`. A tier-színek a
design-tokenekből (arany = `text-gold`; bronz/ezüst dedikált tokenként a `globals.css
@theme`-be). Később egyedi illusztrált szettre cserélhető a katalógus `icon` mezőjén át.

## Tesztelés

- **Unit (Vitest), pure logika:** `computeWinStreak`, `computeExactStreak`,
  `computeJackpots`, `computePerfectDays`, `tierFor`, és a relatív aggregátorok
  (forduló-nettó, ranglista-helyezés → badge). Élek: holtverseny, sorrend-független
  pontozás, küszöb-határok, üres mezőny.
- **Diff-réteg:** `awardBadges` idempotencia (kétszeri futás nem duplikál; szint csak
  előre lép).
- **Smoke (kézi):** dev Ranglistán tipp lepontozása → harang-értesítés + profil-szekrény
  frissül + ranglista-ikon megjelenik.

## Migráció

Egy új tábla (`user_badges`), nincs új enum. Séma-változás **kizárólag**
`npm run db:generate` → `npm run db:migrate` úton (CLAUDE.md konvenció). A `dev` Neon
branchen futtatva; a Vercel preview a Neon-integráció automatikus branchén megy. **Prod
deploy előtt a migrációt kézzel kell futtatni** (a Vercel build nem migrál).

## Branch / deploy

UI-t tartalmaz → **`feat/badges` feature branch + PR** (Vercel preview a Neon auto-branch
DB-vel). A prod-migrációt és a deployt a felhasználó kezeli.

## Mi marad ki (YAGNI, v1)

Visszamenőleges (backfill) kiosztás; privát csoport / kör hatókör; jelvény-alapú
token/jutalom; egyedi illusztrált grafika; jelvény-ritkasági statisztika („a játékosok
3%-ának van"); jelvény-megosztás külső platformra; admin badge-szerkesztő UI.
