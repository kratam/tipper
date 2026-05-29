# Adatforrás-provider absztrakció — Design spec

> Brainstorming kimenet. Implementációs terv: [docs/plans/2026-05-29-provider-abstraction.md](../../plans/2026-05-29-provider-abstraction.md).
> eredmenyek.com felderítési tudás (parkolva): [docs/research/2026-05-29-eredmenyek-flashscore-research.md](../../research/2026-05-29-eredmenyek-flashscore-research.md).

**Dátum:** 2026-05-29
**Státusz:** jóváhagyásra vár

## Cél

A TippCasino jelenleg egyetlen adatforrásból (api-sports.io Hockey) szinkronizál. A cél egy **provider-absztrakció**, amivel **versenysorozatonként** beköthető további forrás, a sync/scoring/token logika újraírása nélkül. Második (elsődlegessé váló) provider: **odds-api.io**. Az eredmenyek.com **parkolva** (tudás a research doksiban).

**Hatókör:** az absztrakció rétege, séma-migráció, api-sports kiemelése a réteg mögé, **odds-api provider** beépítése, és a logóhiányt pótló **zászló-fallback** (nemzeti tornáknál).

## Igazolt odds-api tények (2026-05-29, éles kulccsal ellenőrizve)

- Base: `https://api.odds-api.io/v3`, auth `?apiKey=`. Rate limit 5000 req/óra.
- `GET /leagues?sport=football` → 406 liga; **World Cup = `international-world-cup`** (104 esemény).
- `GET /events?sport=football&league=<slug>` → meccslista; mezők: `id, home, away, homeId, awayId, date, status, scores, league, sport`. Státusz: `pending` / `live` / `settled`. **Figyelem:** `pending` eseménynél `scores={home:0,away:0}` (nem null) → score-t csak `settled`-nél vegyük.
- `GET /odds?eventId=<id>&bookmakers=<csv>` (a `bookmakers` paraméter KÖTELEZŐ) → `bookmakers[<név>] = [{name:"ML", odds:[{home,draw,away}]}, …]` (string oddsok).
- `GET /bookmakers` → érvényes nevek. **„Pinnacle" NINCS**; van **`TippmixPRO`** (magyar!) és `Bet365` → preferált sorrend: `["TippmixPRO","Bet365"]`.
- Csapatnevek = országnevek (Mexico, South Africa, Brazil…). Pár alias kell (`Korea Republic`, `USA`, `Bosnia and Herzegovina`).

## Kulcsdöntések (brainstormingból)

1. **Hatókör:** absztrakció + odds-api beépítés; eredmenyek parkolva.
2. **Séma:** discriminator enum + nullable provider-specifikus oszlopok.
3. **Egy torna = egy provider** (nincs cross-provider). → `matches` nem kap provider-oszlopot (tornából levezethető); `teams` igen (globális tábla).
4. **Csapat-identitás:** provider-namespace (`UNIQUE(provider, externalId)`), nincs cross-provider merge.
5. **Egyszerűsített név-modell:** a `teams.name` oszlop **marad** (nincs kétnyelvű tárolás). A nemzeti csapatok lokalizált nevét (HU) **az ország-kódból származtatjuk** a query-rétegben (ugyanaz az `i18n-iso-countries` lib, ami a zászlót adja). Klubcsapatnál a tárolt (angol) név marad.
6. **Zászló-média fallback:** per-torna **`useFlagFallback`** kapcsoló; ha be van kapcsolva és a név országra mappel → flagcdn zászló a `logoUrl` helyett, és lokalizált országnév — query-rétegben.

## Architektúra

### Provider-interfész — `src/lib/providers/types.ts`

```ts
import type { routing } from "@/i18n/routing";
type Locale = (typeof routing.locales)[number]; // "hu" | "en"

export type ProviderId = "api-sports" | "odds-api";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface NormalizedTeam {
  externalId: string;
  name: string;            // a provider által adott (angol) név
  logoUrl: string | null;  // odds-api: null → query-rétegbeli zászló
}

export interface NormalizedGame {
  externalId: string;
  status: MatchStatus;
  scheduledAt: Date;
  home: NormalizedTeam;
  away: NormalizedTeam;
  homeScore: number | null; // pontozás-releváns végeredmény (hoki: regulation)
  awayScore: number | null;
}

export interface NormalizedOdds {
  externalGameId: string;
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

export type ProviderTournamentConfig =
  | { provider: "api-sports"; leagueId: number; season: number }
  | { provider: "odds-api"; sport: string; leagueSlug: string };

export interface MatchProvider {
  readonly id: ProviderId;
  fetchFixtures(cfg: ProviderTournamentConfig, locales: Locale[]): Promise<NormalizedGame[]>;
  fetchOdds(cfg: ProviderTournamentConfig): Promise<NormalizedOdds[]>;
  fetchTournamentLogo?(cfg: ProviderTournamentConfig): Promise<string | null>;
}
```

- **Kötelező:** `fetchFixtures`, `fetchOdds`. **Opcionális:** `fetchTournamentLogo` (api-sports liga-logó; odds-api: nincs).
- **Registry:** `getProvider(id)` (`src/lib/providers/index.ts`).
- **Config-feloldás:** pure `toProviderConfig(tournamentRow)`.

### sync.ts provider-agnosztikus

A `Tournament` típus kap `provider` + provider-config mezőket. `syncFixtures`/`syncOdds` a `getProvider(cfg.provider)`-en át kér normalizált alakot; a `fetch` alatti upsert/score/refund/flip/token logika **változatlan**. A „finished → regulation score" döntés a providerbe kerül (api-sports hoki-specifikus). meccs-lookup: `(tournamentId, externalId)`. `upsertTeam(provider, externalId, name, logoUrl)` a `(provider, externalId)` kulcsra.

### Séma-migráció (Drizzle `db:generate` → `db:migrate`)

`providerEnum = pgEnum("provider", ["api-sports", "odds-api"])`.

| Tábla | Változás |
|---|---|
| `tournaments` | + `provider` (notNull, default `'api-sports'`); `apiLeagueId`/`apiSeason` → **nullable**; + `providerSport text` + `providerLeagueSlug text` nullable; + `useFlagFallback boolean` notNull default `false` |
| `matches` | + `externalId text`; backfill `= api_game_id::text`; + UNIQUE(`tournamentId`,`externalId`); drop `api_game_id` |
| `teams` | + `provider` (notNull, default `'api-sports'`); `name` **marad**; + `externalId text` backfill `= api_team_id::text`; + UNIQUE(`provider`,`externalId`); drop `api_team_id` |

**Biztonságos sorrend:** új oszlopok → backfill UPDATE-ek → új unique-ok → régi oszlopok drop. A backfill a **generált migrációs fájlba** kerül (a `db:migrate` futtatja és naplózza). Dev branchen `reset_from_parent`, ha elcsúszik.

### Csapat-display (név + logó) — query-réteg

Pure `src/lib/providers/team-country.ts`:
- `countryCodeFromName(name): string | null` — `i18n-iso-countries` (en+hu) + kis ALIAS map (`Korea Republic`→`KR`, `USA`→`US`, `Bosnia and Herzegovina`→`BA`, stb.).
- `resolveCountryDisplay(name, locale): { name: string; flagUrl: string } | null` — `getName(code, locale)` + `https://flagcdn.com/w80/<code>.png`.

`src/queries/team-display.ts` `withTeamDisplay(team, locale, useFlagFallback)`:
```
ha useFlagFallback és resolveCountryDisplay(team.name, locale) = c:
   → { ...team, name: c.name, logoUrl: team.logoUrl ?? c.flagUrl }
különben: team változatlan (name + logoUrl már jelen van)
```
A `TeamLogo` komponensek és a nem-zászlós utak (api-sports hoki) **változatlanok** — `team.name`/`logoUrl` mindig jelen van, nincs oszlop-átnevezés. A `flagcdn.com` host a `next.config` `remotePatterns`-be kerül.

### Bookmaker / odds-normalizálás (odds-api)

`GET /odds?eventId=&bookmakers=TippmixPRO,Bet365`. Preferált sorrend `["TippmixPRO","Bet365"]` → első elérhető `ML` 3-way; fallback bármely jelen lévő bookmaker `ML` piaca. Pure `selectOddsApiOdds`, tesztelt. Tornaszintű `fetchOdds`: `fetchEvents` → `pending` események → per-event `/odds` (104 « 5000/óra; a `/odds/multi` batch dokumentált, de nem verifikált → későbbi optimalizáció).

### Státusz/score normalizálás (odds-api)

`pending→scheduled`, `live→live`, `settled→finished`. `cancelled` **nincs** odds-api-ban → refund-út nem automatikus (dokumentált korlát). Score csak `settled`-nél (`scores.periods.fulltime ?? scores.home/away`); `pending`-nél a `{0,0}`-t IGNORÁLJUK (null).

## Fázisok

1. **Interfész + api-sports kiemelés** — séma változatlan, provider hardcode `'api-sports'`. Viselkedés 0 változás.
2. **Séma-migráció + read-path** — externalId, teams.provider; `team-country` + query-réteg név/zászló feloldás (`useFlagFallback`); `next.config` + `i18n-iso-countries`. Még api-sports-only.
3. **odds-api provider** — kliens (`/events`, `/odds`, `/leagues`), status/score/bookmaker normalizálók, provider + registry. (A World Cup-lefedettség már igazolva.)
4. **Admin UI** — provider-választó (api-sports / odds-api), feltételes mezők (api-sports: leagueId/season; odds-api: sport/leagueSlug), `useFlagFallback` kapcsoló, hu/en fordítások.

## Tesztstratégia (TDD)

Vitest unit a pure rétegre: api-sports normalize, odds-api normalize (status/score/3-way/bookmaker-választó), `countryCodeFromName`/`resolveCountryDisplay`, `toProviderConfig`. Mockolt `fetch` a kliensekre. A meglévő scoring/tokens/scheduling tesztek **érintetlenek**. Cél 80%+ a `src/lib/providers/**` rétegen.

## Kockázatok

- **`cancelled` státusz** odds-api-ban nincs → refund odds-api tornán nem automatikus (dokumentált korlát).
- **Migrációs backfill** (int→text, sorrend, unique-ok) → több lépcsős migráció, dev-branch próba (`reset_from_parent`).
- **Read-path** — `team.name`/`logoUrl` mindig jelen (nincs átnevezés) → kis churn; csak a zászlós tornak kapnak query-rétegbeli felülírást.
- **Országnév-aliasok** (Korea Republic, USA…) — a `countryCodeFromName` ALIAS mapje + teszt a háló; ismeretlen név → angol név + inicálé fallback.
- **odds-api score-szemantika** (ET/penalty a `fulltime`-ban?) — feltételezés: `fulltime` = rendes játékidő csoportkörben; knockoutnál validálandó.
