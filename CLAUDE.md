# TippCasino — Sportmeccs tippjáték

Token-alapú tippjáték ahol játékosok versenysorozatok meccseire fogadnak csoportokban. Odds-alapú pontozás, csoportonként konfigurálható szabályok.

## Tech Stack

- **Framework:** Next.js 16.2.2 (App Router, Server Actions)
- **Nyelv:** TypeScript (strict)
- **DB:** Neon Postgres (`patient-leaf-69938778`, eu-central-1), Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth`), Google login
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

## Fontos fájlok

- **Architektúra:** `ARCHITECTURE.md` ← technikai részletek (DB séma, token rendszer, cron, scoring, auth, env vars)
- **Teendők:** `TODO.md` ← EZT OLVASD EL ha feladatot kapsz
- **Tervezési döntések:** `docs/DESIGN-DECISIONS.md` ← eredeti koncepció és Q&A
- **Spec:** `docs/superpowers/specs/2026-04-03-tipper-design.md`

## Scripts

| Parancs | Leírás |
|---------|--------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (`next build`, migráció nélkül) |
| `npm run lint` | Biome lint + fix |
| `npm run format` | Biome format |
| `npm run check` | Biome check |
| `npm run db:generate` | Drizzle migrations generálás |
| `npm run db:migrate` | Migrációk futtatása (lokálisan vagy Neon MCP-vel, NEM a Vercel builden) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed-odds` | Dev odds seed (prod-védett) |
| `npm run test` | Vitest run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |

## Konvenciók

- Magyar nyelvű szövegek mindig ékezetekkel
- Minden UI szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string
- Server Actions: `"use server"`, mindig `getCurrentUser()` ellenőrzés
- DB műveletek: Drizzle query API, nem raw SQL
- Commit: conventional commits (feat/fix/chore/docs)
- Tesztek: Vitest, TDD a pure logikára
- DB migrációk: deploy előtt kézzel futtatni (Neon MCP / `db:migrate`), Vercel build nem futtatja
