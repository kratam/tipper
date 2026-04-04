# TippCasino — Sportmeccs tippjáték

## Áttekintés

Token-alapú tippjáték ahol játékosok versenysorozatok meccseire fogadnak csoportokban. Odds-alapú pontozás, csoportonként konfigurálható szabályok.

## Tech Stack

- **Framework:** Next.js 16.2.2 (App Router, Server Actions)
- **Nyelv:** TypeScript (strict)
- **DB:** Neon Postgres (`patient-leaf-69938778`, eu-central-1), Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth`), Google login (saját OAuth credentials)
- **UI:** Shadcn UI (nova preset), Tailwind v4
- **i18n:** next-intl (hu default, en)
- **Linter:** Biome 2.4.10
- **Teszt:** Vitest (unit), Playwright (E2E — TODO)
- **Hosting:** Vercel Pro (GuestGuru team), deploy on push
- **API:** api-sports.io Hockey v1 (7500 req/hó)

## Kulcs URL-ek

- **Prod:** https://tippcasino.vercel.app
- **Repo:** github.com/kratam/tipper
- **Neon console:** console.neon.tech → patient-leaf-69938778
- **Vercel:** vercel.com/guestguru/tipper

## Projekt struktúra

```
src/
  app/[locale]/          — Oldalak (Next.js App Router, i18n routing)
  actions/               — Server Actions (groups, bets, podium-bets, admin)
  queries/               — Read-only DB queries
  components/            — UI komponensek + Shadcn ui/
  db/schema.ts           — Drizzle ORM séma (10 tábla, 3 enum)
  db/index.ts            — DB client
  lib/auth/              — Neon Auth (server.ts, client.ts, user-sync.ts)
  lib/scoring.ts         — Pontozási logika (pure, tesztelt)
  lib/tokens.ts          — Token kezelés (pure, tesztelt)
  lib/api-sports.ts      — api-sports.io client (games, odds, league logo)
  lib/utils.ts           — Invite code, slugify, formatDate
  i18n/                  — next-intl routing + navigation
messages/                — hu.json, en.json fordítások
tests/lib/               — Vitest unit tesztek
vercel.json              — Cron config (*/5 * * * *)
```

## Fontos fájlok

- **Spec:** `docs/superpowers/specs/2026-04-03-tipper-design.md`
- **Hátralevő munka:** `docs/plans/remaining-work.md` ← EZT OLVASD EL ha feladatot kapsz

## Env változók (.env.local)

```
DATABASE_URL=...          # Neon connection string
API_SPORTS_KEY=...        # api-sports.io kulcs
NEON_AUTH_BASE_URL=...    # https://ep-....neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=... # 32+ karakter
NEXT_PUBLIC_APP_URL=...   # http://localhost:3000 (lokál) / https://tippcasino.vercel.app (prod)
CRON_SECRET=...           # Cron endpoint védelem
```

## Konvenciók

- Magyar nyelvű szövegek mindig ékezetekkel
- Minden UI szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string
- Server Actions: `"use server"`, mindig `getCurrentUser()` ellenőrzés
- DB műveletek: Drizzle query API, nem raw SQL
- Commit: conventional commits (feat/fix/chore/docs)
- Tesztek: Vitest, TDD a pure logikára

## DB séma (11 tábla)

users, tournaments, teams, matches, match_odds, groups, group_members, bets, podium_bets, token_ledger, match_schedule_overrides

A `neon_auth` schema külön (Better Auth által kezelt): user, session, account, verification, jwks

## Token rendszer

Per-meccs token modell:
- `groups.token_per_match` — meccsenként ennyi tokent kap mindenki
- `groups.initial_tokens` — egyszeri indulótőke csatlakozáskor
- `groups.distribution_days_before` — hány nappal meccs előtt jön a kiosztás
- Carryover nincs — ami megmarad, megmarad
- `groups.odds_boost` — odds szorzó (real, default 1.0), payout = stake × odds × oddsBoost
- Vetített egyenleg (projected balance): a tippelhető összeg meccs-specifikus, aktuális egyenleg + pending kiosztások × tokenPerMatch
- Csatlakozáskor catch-up: megkapja a múltbeli meccsek tokenjeit is

## Cron sync logika

`/api/cron/sync` — minden aktív versenysorozathoz:
0. Tournament logó backfill (ha `logoUrl` NULL → `/leagues?id=` API hívás)
1. Fixtures sync (api-sports.io → matches tábla)
2. Odds sync → match_odds tábla + NULL odds_at_bet kitöltés
3. Finished meccsek pontozása → bets.payout + token_ledger
4. Cancelled meccsek → refund
5. Per-meccs token kiosztás (distributionDaysBefore napon belüli meccsekre)
6. Schedule override: hibás menetrend detektálás (>80% egy napon → override bekapcsolás), API javulás (≥90% egyezés ±2h → kikapcsolás)

## Schedule Override

Ha az API placeholder dátumokat ad (minden meccs egy napra), a `match_schedule_overrides` tábla tartalmazza a valós dátumokat.
- `tournaments.useScheduleOverrides` flag szabályozza az override alkalmazását
- Detektálás automatikus (cron sync-ben), override-ok kézi feltöltéssel (SQL/Neon MCP)
- Az override a `matches.scheduledAt`-ot írja felül közvetlenül

## Ismert korlátok

- Vercel cron: 5 percenként (GuestGuru Pro)
- api-sports.io: 7500 req/hó
- Neon Auth: saját Google OAuth credentials (Neon Console-ban konfigurálva)
