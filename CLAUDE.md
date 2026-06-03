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

- **Architektúra:** `ARCHITECTURE.md` ← technikai részletek (DB séma, token rendszer, **Kör/baráti kör**, cron, scoring, auth, env vars)
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
| `npm run db:migrate` | Migrációk futtatása (lokálisan, NEM a Vercel builden) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed-odds` | Dev odds seed (prod-védett) |
| `npm run test` | Vitest run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |

## Konvenciók

- Magyar nyelvű szövegek mindig ékezetekkel
- Minden UI szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string
- **Design system:** sötét-alapértelmezett „kaszinó" téma, tokenek a `globals.css @theme`-ben (részletek: `ARCHITECTURE.md` → Design system). **Egyetlen** Segmented tab (`ui/tabs.tsx`) és **egyetlen** Button-rendszer (`ui/button.tsx`) — ne hozz létre ad-hoc tabot/gombot. Arany brand = `text-gold`/`bg-gold`/`primary`; a shadcn `accent` token a halvány hover-háttér (nem arany). Új UI mindig ezeket a tokeneket/utilityket használja, ne raw hexet.
- Server Actions: `"use server"`, mindig `getCurrentUser()` ellenőrzés
- DB műveletek: Drizzle query API, nem raw SQL
- Commit: conventional commits (feat/fix/chore/docs)
- Tesztek: Vitest, TDD a pure logikára
- DB migrációk: séma-változás **kizárólag** `db:generate` → `db:migrate` úton. Soha ne menjen ki séma-változás `drizzle-kit push`-csal, kézi SQL-lel vagy Neon MCP migrációval — különben a `drizzle.__drizzle_migrations` napló elcsúszik a tényleges sémától, és a `db:migrate` némán elhasal (status 1, üres stderr), mert újra le akarja futtatni a már létező objektumokat. Deploy előtt a migrációkat kézzel kell futtatni, a Vercel build nem futtatja.
- Neon branch-ek: `production` (default) és `dev`. Az `.env.local` a `dev` branch-re mutat. Ha a `dev` séma/napló elcsúszik, a legtisztább javítás a `dev` branch `reset_from_parent`-ja (production pontos másolata lesz, naplóstul).
