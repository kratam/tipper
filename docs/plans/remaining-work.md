# Tipper — Hátralevő munka

> **Utolsó frissítés:** 2026-04-03
> **Használat:** Új session-ben mondd: "Folytasd a docs/plans/remaining-work.md tervet"

## Jelenlegi állapot

- **Repo:** github.com/kratam/tipper
- **Deploy:** https://tippcasino.vercel.app (Vercel Pro, GuestGuru team, auto deploy on push)
- **DB:** Neon `patient-leaf-69938778` (eu-central-1), Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth@0.2.0-beta.1`), Google login, saját OAuth credentials
- **Stack:** Next.js 16.2.2, TypeScript, Shadcn UI (nova), Tailwind v4, Biome 2.4.10, next-intl, Vitest
- **Tesztek:** 34/34 zöld (pure logic: scoring, tokens, api-sports parsing)
- **DB tartalom:** 2 versenysorozat (VB 2025 — 64 meccs finished, VB 2026 — 56 meccs scheduled), 16+ csapat
- **Migráció:** `drizzle/0001_mixed_amazoness.sql` — tournament podium mezők (gold/silver/bronze_team_id), **FUTTATANDÓ PROD-ON**

### Ami működik (2026-04-03 session után)

**Korábban is működött:**
- Landing page (hu/en), locale váltás
- Google bejelentkezés → user sync
- Nav: bejelentkezett állapot, sign out, admin link, mobile menu
- Tournaments lista + detail — meccs lista fordulónként
- Meccs detail oldal — csapatok, odds, eredmény, meglévő tippek
- Bet create / update / cancel — token levonás / visszatérítés
- Csoport létrehozás / csatlakozás (invite code) / beállítások (owner only) / tag eltávolítás
- Join page — error handling (nem található, már tag, sikeres)
- Leaderboard — token egyenleg alapú ranglista
- Admin: tournament CRUD, státusz váltás
- Cron sync: fixtures upsert, odds sync, NULL odds_at_bet kitöltés, pontozás, cancelled refund
- i18n: hu.json + en.json fordítások

**Ma hozzáadva:**
- Token kiosztás a cron-ban (per-round distribution + carryover)
- Token kiosztás csoport létrehozáskor és csatlakozáskor
- Smart cron — API hívás csak live/near-start/near-end meccsek esetén, egyébként skip
- Admin sync auth javítás — `triggerSync` server action a közvetlen fetch helyett
- Dobogós tipp UI — `PodiumForm` komponens csapat választóval, per-group
- Dobogós tipp pontozás — `finishTournament` action: dobogó megadás + podium bet scoring
- Tournament lezárás az admin panelről dobogó kiválasztással
- Csoport elhagyás (`leaveGroup` action + UI gomb)
- Error boundary (`error.tsx`)
- next/image domain whitelist (`media.api-sports.io`)
- Tournament status megjelenítés bug javítás (i18n vs enum)
- Hardcoded angol szöveg → i18n kulcs (`settingsLocked`)
- Team upsert race condition → `onConflictDoUpdate`
- DB séma: `tournaments.gold_team_id / silver_team_id / bronze_team_id`

---

## Teendők deploy előtt

### DB migráció futtatás

A `drizzle/0001_mixed_amazoness.sql` migráció hozzáadja a tournament podium mezőket. Futtatás:
```bash
npx drizzle-kit migrate
```
Vagy a Neon console-on a SQL kézzel.

### VB 2025 státusz

A Jégkorong VB 2025 minden meccse `finished`, de a tournament státusza valószínűleg `active`. Állítsd `finished`-re az admin panelről.

---

## Hátralevő munka (jövőbeli session-ök)

### Magas prioritás

#### Tesztelési infrastruktúra
1. **Neon test branch** — `mcp__Neon__create_branch(projectId: "patient-leaf-69938778", branchName: "test")` → `.env.test.local`
2. **E2E tesztek (Playwright)** — `npm i -D @playwright/test`, auth cookie inject, kritikus flow-k:
   - Tournament → meccs → tipp leadás → egyenleg csökken
   - Csoport létrehozás → meghívó → csatlakozás
   - Admin: tournament létrehozás, sync, finish with podium

### Közepes prioritás

#### Unit test bővítés
- `tests/lib/utils.test.ts` — `generateInviteCode`, `slugify`, `formatDate`
- Token distribution logika tesztek (ha pure function-ré refaktoráljuk)

#### Biome warning-ok
Ezek korábban is ott voltak, nem blokkolók:
- `<img>` → `<Image>` a `tournament-tabs.tsx` és `podium-form.tsx`-ben (select dropdown-ban nehéz next/image-et használni)
- `!` non-null assertion-ök a config fájlokban (`drizzle.config.ts`, `db/index.ts`, `lib/auth/server.ts`)
- `vitest.config.ts`: `"path"` → `"node:path"`

### Alacsony prioritás

#### Kód minőség
- Odds sync a 2026-os VB-hez: ha az API-ban még nincsenek oddsok, az admin felületen lehessen kézzel megadni
- `tournament-tabs.tsx` `<img>` → `<Image>` cseréje (ahol a next/image remote pattern megengedi)

---

## Ami NINCS benne (MVP utáni, spec szerint)

- Real-time eredményfrissítés (WebSocket/SSE)
- Push notification tipp határidő előtt
- Foci VB (második versenysorozat)
- UI helper: "oszd el a tokeneimet egyenlően"
- Több bookmaker odds összehasonlítás
- Játékos statisztikák / történet
- Mobil app
