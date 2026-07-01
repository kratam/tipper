# TippCasino — Teendők

> **Utolsó frissítés:** 2026-06-29

## Kész

- [x] **Prémium redesign (Fázis 0–9)** — Teljes UI újraépítés a `docs/assets/design_handoff_tippcasino_redesign` hifi handoff szerint: sötét-alapértelmezett „kaszinó" token-rendszer (`globals.css @theme`), Sora + JetBrains Mono fontok, egységes Segmented tab + Button rendszer, minden képernyő tiszta Tailwind utility rebuild-del. Részletek: `ARCHITECTURE.md` → Design system; terv: `docs/superpowers/plans/2026-06-02-tippcasino-redesign.md`. Auth-mögötti képernyők vizuális finomhangolása élő bejelentkezéssel még ajánlott.
- [x] **Adatréteg egységesítés — Fázis 0+1** (PR #7) — TanStack Query kliens-adat-réteg bevezetése; a MatchCard és a TipMatrix egy közös `matches` igazságforrásra állítva (a meccs-vége konzisztencia-bug javítva); HydrationBoundary prefetch, központi query-kulcs registry, tippadás utáni invalidáció. Részletek: `ARCHITECTURE.md` → Kliens adat-réteg; spec/terv: `docs/superpowers/{specs,plans}/2026-06-29-adatreteg-*`.

## Deploy előtt

- [ ] **DB migráció futtatása** — `drizzle/0001_mixed_amazoness.sql` (tournament podium mezők). Futtatás: `npx drizzle-kit migrate` vagy Neon console SQL.
- [ ] **VB 2025 lezárása** — A Jégkorong VB 2025 minden meccse finished, de a tournament státusza valószínűleg active. Állítsd `finished`-re az admin panelről.

## Magas prioritás

### Tesztelési infrastruktúra

- [ ] **Neon test branch** — `mcp__Neon__create_branch(projectId: "patient-leaf-69938778", branchName: "test")` → `.env.test.local`
- [ ] **E2E tesztek (Playwright)** — `npm i -D @playwright/test`, auth cookie inject, kritikus flow-k:
  - Tournament → meccs → tipp leadás → egyenleg csökken
  - Csoport létrehozás → meghívó → csatlakozás
  - Admin: tournament létrehozás, sync, finish with podium

## Közepes prioritás

### Adatréteg egységesítés — hátralévő fázisok

A Fázis 0+1 (PR #7) lefektette a TanStack-réteget; a folytatás külön PR-ekben:

- [ ] **Fázis 2-3** — leaderboard + balance + notification a TanStack-be; az **SWR teljes kivezetése** (`swr-provider.tsx`, `use-leaderboard-polling.ts`, `swr` dependency).
- [ ] **Fázis 4** — a `router.refresh()` és `onBetMutated` kivezetése (a cross-surface frissülést teljesen az `invalidateAfterBet` viszi); a `tipMatrix` query bevonása a meccs-ablak pollingba (lásd `ARCHITECTURE.md` → Ismert korlátok: TipMatrix passzív frissülés).
- [ ] **Fázis 5 (opcionális)** — szerver-oldali cache a drága aggregációkra (`"use cache"` + `revalidateTag`, **nem** `unstable_cache`).

### Unit test bővítés

- [ ] `tests/lib/utils.test.ts` — `generateInviteCode`, `slugify`, `formatDate`
- [ ] Token distribution logika tesztek (ha pure function-ré refaktoráljuk)

### Biome warning-ok

Nem blokkolók:
- [ ] `<img>` → `<Image>` a `tournament-tabs.tsx` és `podium-form.tsx`-ben (select dropdown-ban nehéz next/image-et használni)
- [ ] `!` non-null assertion-ök a config fájlokban (`drizzle.config.ts`, `db/index.ts`, `lib/auth/server.ts`)
- [ ] `vitest.config.ts`: `"path"` → `"node:path"`

## Alacsony prioritás

- [ ] Odds sync a 2026-os VB-hez (ha API-ban még nincsenek oddsok → kézi megadás admin felületen)
- [ ] `tournament-tabs.tsx` `<img>` → `<Image>` (ahol next/image remote pattern megengedi)

## MVP utáni (nincs tervezve)

- Real-time eredményfrissítés (WebSocket/SSE)
- Push notification tipp határidő előtt
- Foci VB (második versenysorozat)
- UI helper: "oszd el a tokeneimet egyenlően"
- Több bookmaker odds összehasonlítás
- Játékos statisztikák / történet
- Mobil app
