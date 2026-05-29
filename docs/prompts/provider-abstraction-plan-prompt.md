# Prompt — Adatforrás-provider absztrakció TERVEZÉSE (külön session)

> Ez egy **prompt**, amit egy friss Claude Code sessionbe másolva tervet készíttetsz.
> A **végrehajtás** külön session lesz; ez a lépés CSAK terv (semmi kódmódosítás).
> Másold be az alábbi `---` közötti blokkot.

---

Használd a **superpowers** skilleket: előbb `brainstorming` (tisztázd a szándékot és a
trade-off-okat KÉRDÉSEKKEL), majd `writing-plans` (írott, fázisos terv fájlba). Ne írj
éles kódot ebben a sessionben — a végrehajtás külön történik. A terv végén álljon meg és
kérjen jóváhagyást.

## Cél

Tervezz egy **adatforrás-provider absztrakciót** a TippCasino-hoz, hogy a jelenlegi
egyetlen forrás (api-sports.io Hockey) mellé **könnyen** beköthető legyen az
**eredmenyek.com (Flashscore)** és bármely további provider — **versenysorozatonként**
(tournament-onként) konfigurálva, hogy melyik provider szolgálja ki.

A korábbi felderítés bizonyította, hogy az eredmenyek.com belső API-ja sima HTTP-vel
elérhető (lásd a már meglévő `src/lib/eredmenyek-probe.ts`-t és a hozzá tartozó Vercel cron
probe-ot `src/app/api/cron/eredmenyek-probe/route.ts`). Egy 5 perces megbízhatósági probe
fut éles üzemben; a tervezés előtt **nézd meg a probe friss eredményeit** (Vercel runtime
log, `eredmenyek-probe`), mert a megbízhatósági adat befolyásolja, mennyire agresszíven
építünk az eredmenyek.com-ra.

## Olvasd el ezeket a fájlokat először

- `ARCHITECTURE.md` — DB séma, sync, cron, scoring, token rendszer
- `src/lib/api-sports.ts` (~128 sor) — a jelenlegi provider-kliens
- `src/lib/sync.ts` (~399 sor) — a sync logika, ami közvetlenül az api-sports-ot hívja
- `src/db/schema.ts` — `tournaments`, `teams`, `matches`, `match_odds`
- `src/lib/eredmenyek-probe.ts` — a bizonyított eredmenyek.com hívások (odds GraphQL + dc_ feed + x-fsign harvest)
- `src/app/api/cron/{nightly,match-finish,sync}/route.ts` — a cron belépési pontok
- `src/actions/admin.ts` — tournament CRUD + manuális sync

## Amit a felderítésből már tudunk (ne fedezd fel újra)

**Jelenlegi csatolási pontok (mind az api-sports-hoz kötve):**
- `api-sports.ts`: `fetchGames`, `fetchOdds`, `fetchLeagueLogoUrl`, `extract3WayOdds`,
  `mapApiStatus`, `parseRegulationScore` (3 period összegzés, OT/penalty külön).
- `sync.ts`: `syncFixtures`, `syncOdds`, `syncTournament`, `distributeTokensForTournament`,
  `backfillTournamentLogos`, segédek (`upsertTeam`, `scoreMatch`, `flipBetsForMatch`,
  `refundMatch`, `handleScheduleOverrides`). A `Tournament` típus kulcsa: `apiLeagueId:number`
  + `apiSeason:number`.
- Cron route-ok tournament-onként hívják a `syncTournament`-et — provider-agnosztikusak
  maradnak, ha a dispatch a sync-en BELÜL történik.

**Séma-ütközések (ezek a tényleges munka, mérlegeld a migrációt):**
| Mező | api-sports | eredmenyek.com | Teendő (mérlegeld) |
|---|---|---|---|
| `tournaments.apiLeagueId int` + `apiSeason int` | egész + szezon | nincs; string `tournamentId` (`zeSHfCx3`) + `stageId` (`SbLsX4y7`) | `apiProvider` discriminator enum + nullable string kulcs(ok) |
| `teams.apiTeamId int UNIQUE` | numerikus ID | nincs ID, csak csapatnév | provider-namespace-elt ID vagy név-alapú upsert |
| `matches.apiGameId int UNIQUE` | egész | 32+ karakteres string event-id (`h4EoUB7T`) | string oszlopra váltás / külön oszlop |
| `match_odds` (home/draw/away) | 1 bookmaker 3Way | sok bookmaker → választani kell (eredmenyek: geo HU = TippmixPro 498) | bookmaker-választó stratégia |
| logó | liga + csapat logó | nincs logó | fallback |

**eredmenyek.com konkrét végpontok (a probe-ban kipróbálva, működnek):**
- Odds: `GET https://global.ds.lsapp.eu/odds/pq_graphql?_hash=ope2&eventId=<ID>&bookmakerId=498&betType=HOME_DRAW_AWAY&betScope=FULL_TIME` → JSON `home/draw/away` value + opening + change. Auth NÉLKÜL.
- Detail/score/status: `GET https://global.flashscore.ninja/15/x/feed/dc_1_<ID>` + `x-fsign` header → `DA`=státusz (1=scheduled, 2=live, 3=finished), `DC`=kezdés ts, `DE`/`DF`=hazai/vendég score.
- `x-fsign` böngésző nélkül: homepage → `core_15_*.js` → `feed_sign` regex (lásd `harvestFsign`).
- **Nyitott RE-pont:** egy torna teljes meccs-listájának böngésző-mentes enumerálása
  (a feed Service Worker cache-ből jön; a DOM `g_*` sorokból viszont kinyerhető). Ezt a
  tervben kezeld: vagy pin-eld a feedet, vagy headless böngészős enumeráló lépés,
  vagy kézi mapping a kezdéshez.

**Lokalizáció / csapatnevek (FONTOS, bizonyítva):** a Flashscore közös, globális
event/team ID-kat használ az összes lokalizált projekten. eredmenyek.com = magyar projekt
(`15`) → magyar nevek („Csehország", „Nagy-Britannia"). Ugyanaz az event-id működik az
angol projekten (`2` = flashscore.com) is, és a feed lokalizáltan jön (pl. `MIV` mező:
proj 15 = „Mexikóváros", proj 2 = „Mexico City"). → Mindkét nyelv lehúzható ugyanarra az
ID-re kulcsolva. A bookmaker is geo/projekt-függő (proj 15 → TippmixPro; proj 2/GB →
bet365). **Követelmény:** a `teams` tárolja a magyar ÉS az angol nevet is (pl. `nameHu`,
`nameEn`), mert az app már next-intl hu/en — a provider-absztrakció adjon meg locale-listát,
és a normalizált team hozzon mindkét nevet. (Az api-sports csak egy — angol — nevet ad, ezt
a migráció kezelje: a meglévő nevet melyik mezőbe.)

**Pozitívum:** a soccer és a hockey is 3-way (home/draw/away) → a meglévő `calculateBetPayout`
és scoring változtatás nélkül illik. A hoki-specifikus regulation/OT logika hoki-only marad.

## Amit a tervnek le kell fednie

1. A **provider-interfész** (pl. `MatchProvider`): normalizált alakok (NormalizedGame,
   NormalizedOdds 3-way, NormalizedTeam), és mely műveletek kötelezők/opcionálisak
   (fixtures, odds, scores, logo, enumeráció).
2. Hogyan lesz a `sync.ts` **provider-agnosztikus** (a normalizált alakot fogyasztja),
   és hogyan dispatch-el tournament-onként az `apiProvider` alapján.
3. **Séma-migráció pontos lépései** (a fenti ütközések), Drizzle `db:generate` →
   `db:migrate` úton — és a meglévő api-sports adatok migrációja/kompatibilitása.
4. **Team-identitás** stratégia provider-ek között (név-normalizálás, ütközések, logók)
   ÉS **többnyelvű csapatnevek** (hu + en, lásd a Lokalizáció szakaszt): hogyan tárolja a
   séma, hogyan adja a provider-interfész, és hogyan migrálódik a meglévő api-sports név.
5. **Bookmaker-választás** eredmenyek.com-nál + odds-normalizálás.
6. Az **x-fsign self-heal** beépítése a JS-harvest köré (a probe `harvestFsign`-ját újrahasznosítva), és hibakezelés (401 → re-harvest → retry).
7. A meccs-**enumeráció** megoldása (lásd nyitott RE-pont).
8. **Fázisokra bontás** kockázat szerint, mindegyik fázis önállóan szállítható és tesztelhető.
9. **Tesztstratégia** (TDD): tiszta normalizáló/parser függvények unit-tesztje (Vitest),
   a meglévő scoring-tesztek érintetlenül maradjanak.

## Projekt-megkötések (tartsd be a tervben)

- **TDD** a pure logikára (Vitest); 80%+ a normalizáló/parser rétegen.
- DB séma-változás **kizárólag** `db:generate` → `db:migrate` (soha `drizzle-kit push`,
  soha kézi SQL/Neon MCP migráció). Deploy előtt a migráció kézzel fut.
- Minden UI szöveg magyar, ékezetekkel, `useTranslations()/getTranslations()` — nincs hardcoded string.
- Server Actions: `"use server"` + `getCurrentUser()` ellenőrzés.
- Immutabilitás, sok kis fájl, Biome.
- Konzisztencia: ha view/derived/shared logikát módosítasz, ELLENŐRIZD az összes hívót.

## Kimenet

- Tedd a kész tervet egy fájlba: `docs/plans/provider-abstraction-plan.md` (vagy a
  `writing-plans` skill konvenciója szerint), fázisokkal, fájlonkénti változással,
  migrációs lépésekkel, teszt-tervvel és kockázatokkal.
- A terv VÉGÉN állj meg és kérj jóváhagyást — a kódolás külön session lesz.

---
