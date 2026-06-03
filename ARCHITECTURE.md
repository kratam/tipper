# TippCasino — Architektúra

Technikai referencia a projekt belső működéséről. A projekt áttekintéséhez lásd [README.md](README.md).

## Projekt struktúra

```
src/
  app/[locale]/            — Oldalak (Next.js App Router, i18n routing)
    admin/                 — Tournament CRUD (admin only)
    groups/                — Csoport lista, létrehozás
    join/[code]/           — Csatlakozás meghívókóddal
    tournaments/           — Versenysorozat lista + detail + csoport detail (groups/[gSlug])
    privacy/, terms/       — Statikus oldalak
  app/api/
    auth/[...path]/        — Neon Auth proxy
    cron/periodic/         — Periodikus cron (6 óránként, 00/06/12/18 UTC)
    cron/match-finish/     — QStash-triggered meccs befejezés check
    cron/sync/             — Admin manuális sync trigger
  actions/                 — Server Actions
    admin.ts               — Tournament CRUD, sync trigger, finish with podium
    bets.ts                — Tipp leadás/módosítás, payout számítás
    groups.ts              — Csoport CRUD, token kiosztás, tag kezelés
    circles.ts             — Kör CRUD (create/join/leave/delete/rename)
    live.ts                — Real-time polling (SWR)
    podium-bets.ts         — Dobogós tipp leadás
    profile.ts             — Felhasználói profil (displayName)
  queries/                 — Read-only DB lekérdezések
    groups.ts              — getUserGroups, projected balance, profit
    circles.ts             — Kör read query-k + szűrt ranglista forrás
    bets.ts                — getUserBets, getGroupBets
    leaderboard.ts         — Ranglista számítás
    matches.ts             — Tournament meccsek, odds lekérdezés
    podium.ts              — Podium bet lookup, scoring
    tournaments.ts         — getAllTournaments, getTournamentById
  components/              — UI komponensek + Shadcn ui/
  db/
    schema.ts              — Drizzle ORM séma (13 tábla, 3 enum)
    index.ts               — DB client (Neon HTTP)
  lib/
    auth/server.ts         — Neon Auth inicializálás
    auth/client.ts         — Client-oldali auth utils
    auth/user-sync.ts      — getCurrentUser(), auto-sync DB-be
    api-sports.ts          — api-sports.io client (fixtures, odds, logo)
    sync.ts                — Shared sync logika (fixtures, odds, scoring, tokens)
    qstash.ts              — QStash client (match-finish ütemezés)
    scoring.ts             — Pontozási logika (pure, tesztelt)
    tokens.ts              — Token számítások (pure, tesztelt)
    schedule-override.ts   — Menetrend override detektálás
    leaderboard-utils.ts   — Rangsorolás segédfüggvények
    circle-leaderboard.ts  — Kör: szűrés + körön belüli újrarangsor (pure, tesztelt)
    utils.ts               — generateInviteCode, slugify, formatDate, cn
  i18n/                    — next-intl routing + navigation
messages/                  — hu.json, en.json fordítások
tests/lib/                 — Vitest unit tesztek
scripts/
  seed-dev-odds.sql        — Idempotens odds seed (determinisztikus, hashtext alapú)
  seed-dev-odds.sh         — Shell wrapper (.env.local-ból olvas, véd prod ellen)
```

## Design system (UI)

Prémium, **sötét-alapértelmezett „kaszinó" esztétika** arany kiemeléssel. A `<html>` fixen `dark` ([src/app/layout.tsx](src/app/layout.tsx)); a light tokenek a `:root`-ban készen állnak, de jelenleg nincs téma-váltó UI. Fontok: **Sora** (UI), **JetBrains Mono** (számok/odds/idő/címek), **Russo One** (logó/landing). Forrás-referencia: `docs/assets/design_handoff_tippcasino_redesign/` (hifi handoff + `styles.css` pixel-igazság), implementációs terv: `docs/superpowers/plans/2026-06-02-tippcasino-redesign.md`.

### Token-rendszer ([src/app/globals.css](src/app/globals.css))

Tiszta Tailwind v4 `@theme` + CSS custom property rendszer. A shadcn semantic tokenek értékét a dark designra hangoltuk (így minden shadcn primitív és `bg-card`/`text-muted-foreground` használat adaptál), plusz design-specifikus tokeneket adtunk:

| Fogalom | Utility | Megjegyzés |
|---|---|---|
| oldal háttér | `bg-background` | `#0e1320` + glow/textúra `body::before/::after` |
| felület / kártya | `bg-card` v. `bg-surface` | `#182135` |
| másod-/harmad-felület | `bg-surface-2` / `bg-surface-3` | mezők / aktív-hover |
| szöveg | `text-foreground` / `text-muted-foreground` / `text-faint` | |
| keret | `border-border` / `border-border-strong` | |
| **arany brand** | `text-gold` / `bg-gold` / `from-gold to-gold-2` / `text-gold-ink` / `bg-gold-soft` / `border-gold-line` | `primary` is erre mutat |
| **arany szöveg (olvasható)** | `text-gold-text` | téma-érzékeny: dark-ban a fényes `#f0b850`, light-ban sötétebb borostyán (`#8a5e0c`) — a fényes arany a krém háttéren megbukik kontraszton. Sima háttéren lévő arany **szövegnél** ezt használd, ne `text-gold`-ot |
| nyer / veszít | `text-win`/`bg-win-soft` · `text-loss`/`bg-loss-soft` | `destructive` = loss |

**Névütközés (FONTOS):** a shadcn **`accent` token a halvány hover-háttér** (`surface-3`), NEM az arany. Az arany brandet a **`primary` / `*-gold`** utilityk hordozzák. Arany szöveg → `text-gold`/`text-primary`; arany gomb → `Button` default variáns.

### Egységes komponensek

- **Egyetlen tab-vezérlő:** `ui/tabs.tsx` (Segmented — arany alsó-vonal aktív tabon). Minden tab-felület ezt használja.
- **Egyetlen gombrendszer:** `ui/button.tsx` (variánsok: `default`=arany gradiens, `secondary`, `ghost`, `outline`, `destructive`, `google`, `link`; méretek: `default`=38px, `sm`, `lg`=50px, `icon`, `icon-sm`).
- `ui/badge.tsx` pill-variánsok: `win`/`loss`/`active`/`upcoming`/`finished`.
- A többi shadcn primitív (`card`, `switch`, `input`, `textarea`, `dialog`) a fenti tokenekre van hangolva.

## DB séma

**13 tábla, 3 enum.** Forrás: `src/db/schema.ts`

### Enumok

| Enum | Értékek |
|------|---------|
| `tournament_status` | upcoming, active, finished |
| `match_status` | scheduled, live, finished, cancelled |
| `token_type` | distribution, bet, win, carryover, refund |

### Táblák

| Tábla | Kulcs mezők | Megjegyzés |
|-------|-------------|------------|
| `users` | googleId, email, name, displayName, avatarUrl, isAdmin | Neon Auth-ból szinkronizált |
| `tournaments` | name, slug, **provider**, apiLeagueId?, apiSeason?, **providerSport?**, **providerLeagueSlug?**, **useFlagFallback**, status, podiumLockDate, gold/silver/bronzeTeamId, useScheduleOverrides, isArchived | Versenysorozat + dobogó eredmények. `provider` diszkriminátor (`api-sports`/`odds-api`); a provider-specifikus oszlopok nullable-ek (api-sports: apiLeagueId+apiSeason; odds-api: providerSport+providerLeagueSlug). `useFlagFallback`: nemzeti csapatoknál zászló+lokalizált országnév a query-rétegben. `isArchived` elrejti a listákból (csak `finished` archiválható). |
| `teams` | **provider**, **externalId**, name, logoUrl | UNIQUE(provider, externalId) — provider-namespace. A providertől kapott (angol) név tárolva; logoUrl odds-api-nál null. |
| `matches` | tournamentId, **externalId**, home/awayTeamId, home/awayScore, status, scheduledAt, round | Index: (tournamentId, status); UNIQUE(tournamentId, externalId). `externalId` = a provider esemény-azonosítója (string). |
| `match_odds` | matchId, homeOdds, drawOdds, awayOdds, fetchedAt | decimal(6,2), többszöri lekérdezés. Index: (matchId, fetchedAt) — a "legfrissebb odds meccsenként" (`ORDER BY fetchedAt DESC LIMIT 1`) backward index scan-nel megy; a tábla a fetch-cronnal folyamatosan nő, index nélkül meccsenkénti seq scan lenne. |
| `groups` | name, slug, inviteCode, ownerId, tournamentId, tokenPerMatch(100), initialTokens(200), bonusGoalDiff(5), bonusExactScore(10), bonusPodiumMention(20), bonusPodiumExact(20), oddsBoost(1.0), isPublic, description | Csoport szabályok. Unique: (tournamentId, slug) — slug tournament-szintű |
| `group_members` | groupId, userId | Unique: (groupId, userId) |
| `bets` | userId, matchId, groupId, predictedHome/Away, stake, oddsAtBet, result flags, payout | Unique: (userId, matchId, groupId) |
| `podium_bets` | userId, tournamentId, groupId, gold/silver/bronzeTeamId | Unique: (userId, tournamentId, groupId) |
| `token_ledger` | userId, groupId, tournamentId, amount (signed), type, referenceId | Index: (userId, groupId, type) |
| `match_schedule_overrides` | matchId (UNIQUE), scheduledAt | Kézi menetrend felülírás |
| `circles` | name, slug (globálisan egyedi), inviteCode, ownerId, description? | Tournamenttől független baráti kör. Nincs szabály/token/tét. |
| `circle_members` | circleId, userId | Unique: (circleId, userId). |

A `neon_auth` schema külön (Better Auth által kezelt): user, session, account, verification, jwks.

### Driver és kapcsolat

`@neondatabase/serverless` **HTTP driver** (`neon()` + `drizzle-orm/neon-http`) — `src/db/index.ts`. Stateless, query-nként egy POST; ideális a Vercel serverless (rövid életű) futáshoz. A WebSocket Pool driverre **nincs ok váltani**: session-szintű (interaktív) tranzakciót nem használunk (`db.transaction()` sehol), edge runtime nincs, és a Pool sem oldaná meg a lenti cold-start hibát (ugyanaz a wake-útvonal).

**Cold-start retry:** a Neon compute 5 perc idle után scale-to-zero (`suspend_timeout_seconds: 300`). Ébresztéskor a control plane néha tranziensen HTTP 500-zal elhasal (`"Control plane request failed"`, `neon:retryable: true`), a HTTP driver pedig nem retry-zik. Ezt a `neonConfig.fetchFunction = retryingFetch` (`src/lib/db-retry-fetch.ts`) kezeli: retryable 5xx-re és hálózati hibára max 4 próbálkozás exponenciális backoff-fal — minden query automatikusan védve. Ha a cold-start 500-ak gyakorivá válnának a logban, a célzott hosszútávú eszköz a **production compute suspend timeout megemelése / scale-to-zero kikapcsolása** (compute-óra költség ↔ mindig-meleg DB), nem driver-csere.

### Migrációk

Drizzle ORM migrációk a `drizzle/` könyvtárban. **Deploy előtt kézzel kell futtatni** — a Vercel build nem futtatja (`drizzle-kit migrate` timeoutol a Neon websocket-en Vercel US → Neon EU miatt).

Séma-változás **kizárólag** `npm run db:generate` → `npm run db:migrate` úton (lokálisan). Soha `drizzle-kit push`, kézi SQL a naplón kívül, vagy Neon MCP migráció — különben a `__drizzle_migrations` napló elcsúszik a tényleges sémától. A backfill UPDATE-ek a generált `.sql`-be kerülnek. Részletek: `CLAUDE.md` → Konvenciók.

## Kör (baráti kör)

A **Kör** tournamenttől független tagsági lista (`circles` + `circle_members`), nincs
szabálya/tokenje/tétje. Minden tournamentnél automatikusan a hivatalos „Ranglista" csoport
tagokra szűrt, körön belül újrarangsorolt nézetét adja:

1. `getGroupLeaderboard(officialGroupId)` — teljes hivatalos ranglista (rank = összhelyezés).
2. `filterAndRerankLeaderboard(rows, memberIds)` ([src/lib/circle-leaderboard.ts](src/lib/circle-leaderboard.ts))
   — a kör tagjaira szűr, körön belül 1..n-re rangsorol, megőrzi az `officialRank`-et.

Megjelenés: a tournament oldalon a hivatalos Ranglista alatt kör-kártyák (mini szűrt
ranglista); rákattintva a kör-detail oldal (`tournaments/[slug]/circles/[circleSlug]`,
Ranglista + Eredmények, csak olvasható). A Ranglista tab a körön belüli helyezést mutatja, a
hivatalos összhelyezést pedig badge-ként (`GroupLeaderboardContent` opcionális `officialRank`).
Kezelés: `/circles` (létrehozás, meghívókód, tagok, kilépés/törlés). Csatlakozás:
`/join/[code]` — előbb csoport-, majd kör-kódként. A kör nem ír token-ledgert, így a
tét/scoring/token logikára nincs hatása.

**Csoport vs. kör magyarázat:** a két fogalom különbségét közérthetően a
[`GroupVsCircleNote`](src/components/group-vs-circle-note.tsx) komponens írja le (kör = csak
szűri a hivatalos ranglistát; csoport = külön szabály → külön token és külön tét). A
`groupVsCircle` i18n namespace-ből olvas, és négy helyen jelenik meg: `/groups`, `/circles`,
`/groups/new`, `/circles/new`. Ugyanezt a help modal (`help.sections`) és a landing
(`landing.groupVsCircleNote`) is tartalmazza saját szöveggel.

## Token rendszer

### Kiosztás

- **`tokenPerMatch`** (default: 100) — meccsenként ennyi tokent kap mindenki
- **`initialTokens`** (default: 200) — egyszeri indulótőke csatlakozáskor
- Kiosztás időpontja: `DATE(scheduledAt) <= CURRENT_DATE` → per-meccs `distribution` ledger bejegyzés
- Csatlakozáskor catch-up: megkapja a múltbeli meccsek tokenjeit is
- Idempotens: (userId, groupId, type='distribution', referenceId=matchId) egyediség

### Vetített egyenleg (projected balance)

A maximális új stake amit a user a célmeccsre tehet. **Cumulative budget modell**: minden cutoff dátumra `D' ≥ célmeccs.dátum` a lifetime keret:

```
maxBudget(D') = initialTokens
              + tokenPerMatch × { nem-cancelled meccsek date ≤ D' }
              + Σ (bets.payout − bets.stake) RESOLVED tétekre date ≤ D'
```

ahol **RESOLVED** = `bets.payout IS NOT NULL` (a scoring lefutott). A `payout` mező már tartalmazza a `bonusGoalDiff` és `bonusExactScore` bónuszt is.

Aktív tétek (még `payout IS NULL`, nem-cancelled meccs) csökkentik a slacket:

```
slack(D')  = maxBudget(D') − Σ stake ACTIVE tétekre date ≤ D'
projected = min slack(D') minden constraint dátumra
```

Ezáltal:
- A **nyeremények** (stake refund + net payout + bónuszok) újra feltehetők.
- **Elvesztett tét** nem rakható fel újra (a netPayout = −stake csökkenti a kapot).
- **Future-day bet** lefoglalhatja a múltbeli nyereményt és a jövőbeli kiosztásokat is, de így megnöveli a kötelezettséget a korábbi napokra → korlátozza azokat is.
- A **scoring cron** lefutása előtt (`finished` meccs, `payout IS NULL`) a tét még active-ként van kezelve — nem szabadítható fel addig amíg az eredmény nem dőlt el.

Implementáció: [src/lib/tokens.ts](src/lib/tokens.ts) `computeProjectedFromCumulativeBudget`, query layer: [src/queries/groups.ts](src/queries/groups.ts) `getProjectedBalance` / `getBatchProjectedBalances`.

### Odds boost

`groups.oddsBoost` (real, default 1.0) — szorzó a payout-ra: `payout = stake × odds × oddsBoost`

A hivatalos **Ranglista** csoport `oddsBoost` értéke **1.15** (+15% kifizetés) — lásd `createOfficialGroup` ([src/lib/official-group.ts](src/lib/official-group.ts)). A scoring a csoport *aktuális* `oddsBoost`-jával számol, így ez érték-módosításkor a még le nem pontozott tétekre is hat (a már tárolt payout nem változik).

## Pontozás (scoring)

Pure függvények: `src/lib/scoring.ts` (tesztelve)

### Meccs tipp (1X2)

1. Ha az 1X2 kimenetel **hibás** → payout = 0
2. Ha **helyes**: `payout = round(stake × oddsAtBet × oddsBoost)`
   - A tétre ható **effektív lekötött odds** = `oddsAtBet × oddsBoost` (= `payout / stake`).
     Ezt jeleníti meg a UI a tippek mellett (`src/lib/odds-display.ts` → `formatEffectiveOdds`):
     bet-form (lekötött 🔒 + jelenlegi), BetRow (`@odds`), és a csoport-oldal
     Ranglista/Eredmények tabok Odds oszlopa. Tervdok:
     `docs/superpowers/specs/2026-05-29-locked-odds-display-design.md`.
3. **Gólkülönbség bónusz**: `+bonusGoalDiff` (default: 5) ha a gólkülönbség egyezik
4. **Pontos eredmény bónusz**: `+bonusExactScore` (default: 10) ha pontos találat
5. Bónuszok additívak (nem szorzódnak)

### Dobogós tipp

- Említett csapat (bármelyik dobogós helyen): `+bonusPodiumMention` (default: 20)
- Pontos pozíció: `+bonusPodiumExact` (default: 20)
- Maximum per csapat: 40 pont (említett + pontos)

### Eredmény számítás

- Csak rendes játékidő (3 period) — hosszabbítás nem számít
- Ha `oddsAtBet` NULL (nem volt odds a tipp leadásakor) → payout = 0

## Cron sync

Event-driven architektúra QStash-sel a Neon compute optimalizálás érdekében. A DB csak akkor ébred fel amikor tényleg szükséges.

### Endpointok

| Endpoint | Trigger | Feladat |
|----------|---------|---------|
| `/api/cron/periodic` | Vercel cron, 6 óránként (00/06/12/18 UTC) | Teljes sync + QStash ütemezés |
| `/api/cron/match-finish` | QStash POST | Meccs befejezés detektálás + pontozás |
| `/api/cron/sync` | Admin panel (manuális) | Teljes sync (admin trigger) |

### Periodikus cron (`/api/cron/periodic`)

6 óránként fut (`0 */6 * * *` → 00/06/12/18 UTC), `vercel.json` cron:

1. **Logo backfill** — ha `logoUrl` NULL → `/leagues?id=` API hívás
2. **Full sync** — minden active + upcoming versenysorozatra:
   - Fixtures sync (api-sports.io → matches upsert)
   - Odds sync (→ match_odds + NULL `oddsAtBet` kitöltés)
   - Schedule override detektálás/alkalmazás
   - Finished meccsek pontozása (safety net)
   - Cancelled meccsek refund
3. **Token kiosztás** — `DATE(scheduledAt) <= CURRENT_DATE`, idempotens
4. **QStash ütemezés** — a **következő 6 órás ablakban** (`scheduledAt ∈ [now, now+6h)`) kezdődő meccsekre, `scheduledAt + sport-hossz` időpontra match-finish check. Az ablak-szűrés miatt a 4 napi futás átfedés nélkül fedi le a napot → nincs duplikált QStash üzenet ugyanarra a meccsre.

**Meccs-hossz sportonként** (`expectedMatchDurationMs`, `src/lib/match-duration.ts`): `providerSport="football"` → **1h55m**, egyébként (jégkorong / api-sports `providerSport=NULL`) → **2h30m**. A bucketelés meccsenként a torna sportja szerint számolja a várható véget.

### Match-finish check (`/api/cron/match-finish`)

QStash-ből hívva, POST. Csak fixtures sync (1 API hívás/tournament, odds nélkül):

- **Finished** meccs → pontozás + payout
- **Cancelled** meccs → refund
- **Még live** → QStash self-reschedule 10 perc múlva
- **Még van mai meccs** → QStash reschedule a következő meccs várható végére (sport-függő hossz)
- **Minden kész** → stop → Neon elalszik

### Shared sync logika

`src/lib/sync.ts` — mindhárom endpoint által használt függvények:
- `syncTournament()` — fixtures + odds + schedule overrides
- `syncFixtures()` — csak fixtures (match-finish használja)
- `syncOdds()` — csak odds
- `distributeTokensForTournament()` — token kiosztás
- `backfillTournamentLogos()` — logo feltöltés

**Home/away flip kezelése:** az api-sports `/games` időnként megfordítja a `teams.home`/`teams.away` értékeket az eredeti import után. A `syncFixtures` UPDATE ága a `homeTeamId`/`awayTeamId` mezőket is frissíti (nem csak az insertnél), és scheduled/live meccsen flip-eli a nyitott (még nem pontozott) tippek `predicted_home`/`predicted_away` értékeit + újraszámolja az `oddsAtBet`-et. Ezzel a csapat-szándék megőrződik, és az odds szinkronban marad az API jelenlegi `Home`/`Away` konvenciójával.

### QStash (`src/lib/qstash.ts`)

Upstash QStash message queue a célzott API hívásokhoz. Free tier: 500 msg/nap.
- `scheduleMatchFinishCheck(delaySeconds)` — POST ütemezés `/api/cron/match-finish`-re
- Env: `QSTASH_TOKEN`

**Callback URL prioritás** (`getCallbackBaseUrl`):
1. `NEXT_PUBLIC_APP_URL` — explicit override
2. `VERCEL_PROJECT_PRODUCTION_URL` — csak ha `VERCEL_ENV=production` (stabil prod domain, pl. `tippcasino.vercel.app`)
3. `VERCEL_URL` — preview deploy (deployment-specifikus URL)
4. `http://localhost:3000` — lokál

A deployment-specifikus `VERCEL_URL`-t prod-ban **nem szabad** használni: új deploy után stale (404), és a Vercel deployment protection 401-et adhat rá, így a QStash hívások némán failed lesznek.

## Schedule override

Ha az API placeholder dátumokat ad (minden meccs egy napra):

- **Detektálás**: `>80%` scheduled meccs azonos napon → `useScheduleOverrides = true`
- **API javulás**: `≥90%` API dátum ±2 órán belül van az override-hoz képest → kikapcsolás
- Override-ok a `match_schedule_overrides` táblában, kézi feltöltéssel (SQL/Neon MCP)
- Ha a flag be van kapcsolva: `matches.scheduledAt` és `round` felülírása override-ból

## Auth flow

1. Google login → Neon Auth (`@neondatabase/auth`)
2. `getCurrentUser()` (server-only): session olvasás cookie-ból, közvetlen fetch a Neon Auth API-ra
3. Auto-sync: ha nincs user a `users` táblában → `INSERT ... ON CONFLICT DO UPDATE`
4. Server Components-ben nincs `cookies().set()` — közvetlen fetch a session endpoint-ra

## Provider-absztrakció

Versenysorozatonként konfigurálható adatforrás a `src/lib/providers/` rétegben. A `sync.ts` provider-agnosztikus: tornánként a `tournament.provider` alapján dispatch-el.

- **Interfész:** `MatchProvider` (`types.ts`) — `fetchFixtures(cfg, locales)`, `fetchOdds(cfg)`, opcionális `fetchTournamentLogo(cfg)`. Normalizált alakok: `NormalizedGame` / `NormalizedOdds` / `NormalizedTeam`.
- **Config-feloldás:** pure `toProviderConfig(tournamentRow)` a nullable provider-oszlopokból építi a diszkriminált `ProviderTournamentConfig`-ot; `getProvider(id)` registry (`index.ts`).
- **`api-sports`** (`providers/api-sports.ts`): a meglévő `lib/api-sports.ts` klienst csomagolja; finished meccsnél regulation score, egyébként nyers/null.
- **`odds-api`** (`providers/odds-api/`): odds-api.io kliens (`/events`, `/odds/multi`, `/leagues`), státusz `pending→scheduled`/`live→live`/`settled→finished`, score csak settled-nél (`fulltime ?? top-level`), bookmaker-preferencia `TippmixPRO`→`Bet365`→bármely `ML` piac. Odds tornaszinten: a pending események ID-jait **10-es batchekben** kéri le a `/odds/multi`-n (a rate limit miatt — lásd lent).
- **Zászló-fallback** (`providers/team-country.ts` + `queries/team-display.ts`): ha a torna `useFlagFallback=true` és a csapatnév országra mappel (`i18n-iso-countries` + alias-map), a query-réteg lokalizált országnevet + flagcdn zászlót ad a tárolt név/logó helyett. `useFlagFallback=false` esetén no-op. Az UK tagnemzetek (Scotland/England/Wales/Észak-Írország) nem ISO-országok → kézi `gb-sct`/`gb-eng`/`gb-wls`/`gb-nir` flagcdn-zászló + magyar név. Aliasok: Korea Republic, USA, Bosnia and Herzegovina, Ivory Coast, Cape Verde, Turkiye, IR Iran, Congo DR, Curacao.
- **Meg-nem-határozott meccsek** (`isPlaceholderTeam` / `matchParticipantsKnown` a `team-display.ts`-ben): az odds-api a teljes kieséses bracket-et előre visszaadja seed-placeholderekkel (`1A`, `2B`, `W73`, `RU101`, `3A/3B/3C…`). Ezek a meccsek **látszanak**, de a fogadás le van tiltva (UI: „A csapatok még nem ismertek"; szerver: `placeBet` elutasít), amíg a valódi csapatok ki nem derülnek. Amint az odds-api kitölti a résztvevőket, a meccs automatikusan fogadhatóvá válik.

### api-sports.io Hockey v1 — 7500 req/hó

| Függvény | Endpoint | Visszatérés |
|----------|----------|-------------|
| `fetchGames(leagueId, season)` | `/games?league=&season=` | Meccsek + eredmények |
| `fetchOdds(leagueId, season)` | `/odds?league=&season=` | 3-way odds |
| `fetchLeagueLogoUrl(leagueId)` | `/leagues?id=` | Logo URL |

Segédfüggvények: `parseRegulationScore` (3 period), `mapApiStatus`, `extract3WayOdds`.

### odds-api.io v3 — 100 req/óra (a jelenlegi kulcs csomagja)

Base `https://api.odds-api.io/v3`, auth `?apiKey=`. World Cup slug `international-world-cup` (104 esemény). Kliens: `fetchEvents(sport, leagueSlug)`, `fetchMultiEventOdds(eventIds[], bookmakers)` → `/odds/multi?eventIds=<vesszős>` (max **10** eventId/hívás, tömb válasz, elemenként a `/odds` alakjával), `fetchEventOdds(eventId, bookmakers)` (egyes esemény, fallback), `fetchLeagues(sport)`. A `bookmakers` paraméter kötelező.

**Rate limit (FONTOS):** a kulcs csomagja **100 kérés/óra** (nem 5000 — a kódnév-spec tévedett). Ezért az odds-szinkron `/odds/multi`-val batchel (104 esemény → ~11 hívás), nem eseményenként (ami 104 hívással túllépné a limitet → `HTTP 429`).

## Env változók

```
DATABASE_URL              — Neon connection string
API_SPORTS_KEY            — api-sports.io kulcs
ODDS_API_KEY              — odds-api.io kulcs (odds-api provider esetén szükséges)
NEON_AUTH_BASE_URL        — https://ep-....neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET   — 32+ karakter
NEXT_PUBLIC_APP_URL       — http://localhost:3000 (lokál) / https://tippcasino.vercel.app (prod)
CRON_SECRET               — Vercel cron endpoint védelem (Bearer token)
QSTASH_TOKEN              — Upstash QStash API token
```

## Ismert korlátok

- **Vercel cron**: 6 óránként (00/06/12/18 UTC), QStash-sel kiegészítve
- **api-sports.io**: 7500 request/hó
- **Neon Auth**: saját Google OAuth credentials (Neon Console-ban konfigurálva)
- **Eredmény**: csak regulation time (3 period), overtime nem számít
- **odds-api provider — nincs `cancelled` státusz**: az odds-api csak `pending`/`live`/`settled`-et küld, így törölt/halasztott mérkőzések **nem kapnak automatikus visszatérítést** odds-api tornán (kézi vagy későbbi finomítás). api-sports tornáknál a `CANC`/`POST` → refund változatlanul működik.
- **odds-api provider — nincs liga-logó**: az odds-api nem ad logót, így odds-api torna logóját az adminban kézzel kell beállítani.
- **odds-api odds-szinkron**: az odds `/odds/multi` batchben (10 eventId/hívás) megy a 100/órás limit miatt; egy teljes World Cup odds-sync ~11 odds-hívás + 2 `/events` (a `syncFixtures` és `syncOdds` külön kéri az eseménylistát) ≈ 13 kérés. A rolling órás ablakot a kézi „sync now" gyors ismétlése kimerítheti → `HTTP 429`; ilyenkor a fixtures már létrejött, az odds a következő (nem rate-limitelt) syncen feltöltődik.
