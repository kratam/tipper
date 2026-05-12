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
    cron/nightly/          — Éjszakai cron (naponta 03:00 UTC)
    cron/match-finish/     — QStash-triggered meccs befejezés check
    cron/sync/             — Admin manuális sync trigger
  actions/                 — Server Actions
    admin.ts               — Tournament CRUD, sync trigger, finish with podium
    bets.ts                — Tipp leadás/módosítás, payout számítás
    groups.ts              — Csoport CRUD, token kiosztás, tag kezelés
    live.ts                — Real-time polling (SWR)
    podium-bets.ts         — Dobogós tipp leadás
    profile.ts             — Felhasználói profil (displayName)
  queries/                 — Read-only DB lekérdezések
    groups.ts              — getUserGroups, projected balance, profit
    bets.ts                — getUserBets, getGroupBets
    leaderboard.ts         — Ranglista számítás
    matches.ts             — Tournament meccsek, odds lekérdezés
    podium.ts              — Podium bet lookup, scoring
    tournaments.ts         — getAllTournaments, getTournamentById
  components/              — UI komponensek + Shadcn ui/
  db/
    schema.ts              — Drizzle ORM séma (11 tábla, 3 enum)
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
    utils.ts               — generateInviteCode, slugify, formatDate, cn
  i18n/                    — next-intl routing + navigation
messages/                  — hu.json, en.json fordítások
tests/lib/                 — Vitest unit tesztek
scripts/
  seed-dev-odds.sql        — Idempotens odds seed (determinisztikus, hashtext alapú)
  seed-dev-odds.sh         — Shell wrapper (.env.local-ból olvas, véd prod ellen)
```

## DB séma

**11 tábla, 3 enum.** Forrás: `src/db/schema.ts`

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
| `tournaments` | name, slug, apiLeagueId, apiSeason, status, podiumLockDate, gold/silver/bronzeTeamId, useScheduleOverrides | Versenysorozat + dobogó eredmények |
| `teams` | apiTeamId (UNIQUE), name, logoUrl | api-sports.io-ból upsert |
| `matches` | tournamentId, apiGameId (UNIQUE), home/awayTeamId, home/awayScore, status, scheduledAt, round | Index: (tournamentId, status) |
| `match_odds` | matchId, homeOdds, drawOdds, awayOdds, fetchedAt | decimal(6,2), többszöri lekérdezés |
| `groups` | name, slug, inviteCode, ownerId, tournamentId, tokenPerMatch(100), initialTokens(200), bonusGoalDiff(5), bonusExactScore(10), bonusPodiumMention(20), bonusPodiumExact(20), oddsBoost(1.0), isPublic, description | Csoport szabályok. Unique: (tournamentId, slug) — slug tournament-szintű |
| `group_members` | groupId, userId | Unique: (groupId, userId) |
| `bets` | userId, matchId, groupId, predictedHome/Away, stake, oddsAtBet, result flags, payout | Unique: (userId, matchId, groupId) |
| `podium_bets` | userId, tournamentId, groupId, gold/silver/bronzeTeamId | Unique: (userId, tournamentId, groupId) |
| `token_ledger` | userId, groupId, tournamentId, amount (signed), type, referenceId | Index: (userId, groupId, type) |
| `match_schedule_overrides` | matchId (UNIQUE), scheduledAt | Kézi menetrend felülírás |

A `neon_auth` schema külön (Better Auth által kezelt): user, session, account, verification, jwks.

### Migrációk

Drizzle ORM migrációk a `drizzle/` könyvtárban. **Deploy előtt kézzel kell futtatni** — a Vercel build nem futtatja (`drizzle-kit migrate` timeoutol a Neon websocket-en Vercel US → Neon EU miatt).

Migráció alkalmazás: Neon MCP `run_sql` tool-lal, vagy lokálisan `npm run db:migrate`.
Migráció generálás: `npm run db:generate` (interaktív, lokálisan).

## Token rendszer

### Kiosztás

- **`tokenPerMatch`** (default: 100) — meccsenként ennyi tokent kap mindenki
- **`initialTokens`** (default: 200) — egyszeri indulótőke csatlakozáskor
- Kiosztás időpontja: `DATE(scheduledAt) <= CURRENT_DATE` → per-meccs `distribution` ledger bejegyzés
- Csatlakozáskor catch-up: megkapja a múltbeli meccsek tokenjeit is
- Idempotens: (userId, groupId, type='distribution', referenceId=matchId) egyediség

### Vetített egyenleg (projected balance)

Nap-szintű, egy nap összes meccsére ugyanaz:
```
projected = actual + pending_meccsek × tokenPerMatch
```
Ahol `pending` = meccsek ahol `DATE(scheduledAt) <= DATE(targetMatch.scheduledAt)` és még nincs distribution ledger bejegyzés.

Előre tippelés: bármikor lehet, a keret a meccs napjáig esedékes összes kiosztást tartalmazza.

### Odds boost

`groups.oddsBoost` (real, default 1.0) — szorzó a payout-ra: `payout = stake × odds × oddsBoost`

## Pontozás (scoring)

Pure függvények: `src/lib/scoring.ts` (tesztelve)

### Meccs tipp (1X2)

1. Ha az 1X2 kimenetel **hibás** → payout = 0
2. Ha **helyes**: `payout = round(stake × oddsAtBet × oddsBoost)`
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
| `/api/cron/nightly` | Vercel cron, naponta 03:00 UTC | Teljes sync + QStash ütemezés |
| `/api/cron/match-finish` | QStash POST | Meccs befejezés detektálás + pontozás |
| `/api/cron/sync` | Admin panel (manuális) | Teljes sync (admin trigger) |

### Éjszakai cron (`/api/cron/nightly`)

Naponta egyszer fut (03:00 UTC), `vercel.json` cron:

1. **Logo backfill** — ha `logoUrl` NULL → `/leagues?id=` API hívás
2. **Full sync** — minden active + upcoming versenysorozatra:
   - Fixtures sync (api-sports.io → matches upsert)
   - Odds sync (→ match_odds + NULL `oddsAtBet` kitöltés)
   - Schedule override detektálás/alkalmazás
   - Finished meccsek pontozása (safety net)
   - Cancelled meccsek refund
3. **Token kiosztás** — `DATE(scheduledAt) <= CURRENT_DATE`, idempotens
4. **QStash ütemezés** — mai meccsekre `scheduledAt + 2h30m` időpontra match-finish check

### Match-finish check (`/api/cron/match-finish`)

QStash-ből hívva, POST. Csak fixtures sync (1 API hívás/tournament, odds nélkül):

- **Finished** meccs → pontozás + payout
- **Cancelled** meccs → refund
- **Még live** → QStash self-reschedule 10 perc múlva
- **Még van mai meccs** → QStash reschedule a következő meccs várható végére
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

## API integráció

**api-sports.io Hockey v1** — 7500 req/hó

| Függvény | Endpoint | Visszatérés |
|----------|----------|-------------|
| `fetchGames(leagueId, season)` | `/games?league=&season=` | Meccsek + eredmények |
| `fetchOdds(leagueId, season)` | `/odds?league=&season=` | 3-way odds |
| `fetchLeagueLogoUrl(leagueId)` | `/leagues?id=` | Logo URL |

Segédfüggvények: `parseRegulationScore` (3 period), `mapApiStatus`, `extract3WayOdds`.

## Env változók

```
DATABASE_URL              — Neon connection string
API_SPORTS_KEY            — api-sports.io kulcs
NEON_AUTH_BASE_URL        — https://ep-....neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET   — 32+ karakter
NEXT_PUBLIC_APP_URL       — http://localhost:3000 (lokál) / https://tippcasino.vercel.app (prod)
CRON_SECRET               — Vercel cron endpoint védelem (Bearer token)
QSTASH_TOKEN              — Upstash QStash API token
```

## Ismert korlátok

- **Vercel cron**: naponta 1× (03:00 UTC), QStash-sel kiegészítve
- **api-sports.io**: 7500 request/hó
- **Neon Auth**: saját Google OAuth credentials (Neon Console-ban konfigurálva)
- **Eredmény**: csak regulation time (3 period), overtime nem számít
