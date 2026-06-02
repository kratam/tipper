# TippCasino — Teendők

> **Utolsó frissítés:** 2026-06-02

## Kész

- [x] **Prémium redesign (Fázis 0–9)** — Teljes UI újraépítés a `docs/assets/design_handoff_tippcasino_redesign` hifi handoff szerint: sötét-alapértelmezett „kaszinó" token-rendszer (`globals.css @theme`), Sora + JetBrains Mono fontok, egységes Segmented tab + Button rendszer, minden képernyő tiszta Tailwind utility rebuild-del. Részletek: `ARCHITECTURE.md` → Design system; terv: `docs/superpowers/plans/2026-06-02-tippcasino-redesign.md`. Auth-mögötti képernyők vizuális finomhangolása élő bejelentkezéssel még ajánlott.

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
