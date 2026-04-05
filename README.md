# TippCasino

Token-alapú sportmeccs tippjáték. Játékosok versenysorozatok meccseire fogadnak csoportokban, odds-alapú pontozással.

**Prod:** https://tippcasino.vercel.app

## Tech Stack

Next.js 16 (App Router) | TypeScript | Neon Postgres + Drizzle ORM | Neon Auth (Google login) | Shadcn UI + Tailwind v4 | next-intl (hu/en) | Vercel Pro

## Fejlesztés

```bash
# Függőségek
npm install

# Dev server
npm run dev

# Lint + format
npm run check

# Tesztek
npm run test
npm run test:coverage

# DB
npm run db:generate    # Migráció generálás
npm run db:migrate     # Migrációk futtatása
npm run db:studio      # Drizzle Studio
npm run db:seed-odds   # Dev odds seed (prod-védett)
```

### Env változók

Másold `.env.local.example`-t `.env.local`-ba (vagy lásd [ARCHITECTURE.md](ARCHITECTURE.md#env-változók) a teljes listáért).

## Dokumentáció

| Fájl | Tartalom |
|------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technikai referencia: DB séma, token rendszer, cron sync, scoring, auth flow |
| [TODO.md](TODO.md) | Hátralevő teendők |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Eredeti koncepció és tervezési döntések |
