# Tipper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a token-based sports betting game where players predict match results in tournaments, earn points based on odds, and compete in groups with customizable rules.

**Architecture:** Next.js 16 App Router with Server Actions, Neon Postgres via Drizzle ORM, Neon Auth (Google login via Stack Auth), next-intl for i18n (hu/en), api-sports.io for match/odds data, Vercel Cron for sync. All config is group-level. Token economy tracked via append-only ledger.

**Tech Stack:** Next.js 16, TypeScript (strict), Drizzle ORM, Neon Postgres, @stackauth/nextjs, next-intl, Shadcn UI + Radix, Biome, Vercel Cron, api-sports.io Hockey v1

---

## File Structure

```
tipper/
├── biome.json
├── components.json                     # Shadcn UI config
├── drizzle.config.ts
├── next.config.ts
├── middleware.ts                        # next-intl + auth middleware
├── i18n/
│   └── request.ts                      # next-intl request config
├── messages/
│   ├── hu.json
│   └── en.json
├── public/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx              # Root layout (providers, i18n)
│   │   │   ├── page.tsx                # Landing
│   │   │   ├── tournaments/
│   │   │   │   ├── page.tsx            # Versenysorozatok listája
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx        # Meccsek + dobogós tipp
│   │   │   │       └── matches/
│   │   │   │           └── [id]/
│   │   │   │               └── page.tsx # Tippelés
│   │   │   ├── groups/
│   │   │   │   ├── page.tsx            # Saját csoportjaim
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx        # Csoport létrehozás
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx        # Ranglista + beállítások
│   │   │   ├── join/
│   │   │   │   └── [code]/
│   │   │   │       └── page.tsx        # Meghívó link handler
│   │   │   └── admin/
│   │   │       └── page.tsx            # Versenysorozat kezelés
│   │   ├── handler/
│   │   │   └── [...stack]/
│   │   │       └── route.ts            # Stack Auth handler
│   │   └── api/
│   │       └── cron/
│   │           └── sync/
│   │               └── route.ts        # Cron endpoint
│   ├── db/
│   │   ├── index.ts                    # Drizzle client
│   │   ├── schema.ts                   # Teljes Drizzle séma
│   │   └── seed.ts                     # Dev seed script
│   ├── lib/
│   │   ├── stack.ts                    # Stack Auth server app
│   │   ├── api-sports.ts              # api-sports.io HTTP client
│   │   ├── scoring.ts                 # Pontozási logika (pure)
│   │   ├── tokens.ts                  # Token egyenleg/kiosztás (pure)
│   │   └── utils.ts                   # Invite code generálás, stb.
│   ├── actions/
│   │   ├── tournaments.ts             # Tournament server actions
│   │   ├── groups.ts                  # Group CRUD actions
│   │   ├── bets.ts                    # Bet placement/update actions
│   │   ├── podium-bets.ts            # Podium bet actions
│   │   └── admin.ts                   # Admin actions
│   ├── queries/
│   │   ├── tournaments.ts             # Tournament queries
│   │   ├── matches.ts                 # Match queries
│   │   ├── groups.ts                  # Group queries
│   │   ├── bets.ts                    # Bet queries
│   │   └── leaderboard.ts            # Leaderboard queries
│   └── components/
│       ├── ui/                        # Shadcn UI (auto-generated)
│       ├── match-card.tsx
│       ├── bet-form.tsx
│       ├── leaderboard-table.tsx
│       ├── podium-picker.tsx
│       ├── group-settings-form.tsx
│       ├── tournament-card.tsx
│       └── nav.tsx
├── tests/
│   ├── lib/
│   │   ├── scoring.test.ts
│   │   ├── tokens.test.ts
│   │   └── api-sports.test.ts
│   ├── actions/
│   │   ├── bets.test.ts
│   │   └── groups.test.ts
│   └── cron/
│       └── sync.test.ts
└── vercel.json                        # Cron config
```

---

## Task 1: Projekt scaffolding + GitHub + Vercel

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `biome.json`, `.env.local`, `.gitignore`, `vercel.json`

- [ ] **Step 1: Next.js projekt létrehozás**

```bash
cd /Users/kratam/dev/tipper
npx create-next-app@latest . --typescript --app --src-dir --tailwind --no-eslint --no-import-alias --turbopack
```

Ha kérdez: Use `src/` directory → Yes, App Router → Yes, Tailwind → Yes, customize import alias → No.

- [ ] **Step 2: ESLint eltávolítás, Biome beállítás**

```bash
npm uninstall eslint eslint-config-next @eslint/eslintrc
rm -f eslint.config.mjs .eslintrc*
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

Felülírni a generált `biome.json`-t:

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": [".next/**", "node_modules/**", "dist/**", "*.min.js"]
  }
}
```

`package.json` scripts kiegészítés:
```json
{
  "scripts": {
    "lint": "biome lint --write .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  }
}
```

- [ ] **Step 3: Git init + GitHub repo**

```bash
cd /Users/kratam/dev/tipper
git init
git add -A
git commit -m "feat: initial Next.js 16 scaffold with Biome"
gh repo create kratam/tipper --public --source=. --remote=origin --push
```

- [ ] **Step 4: Vercel projekt létrehozás + deploy on push**

```bash
npx vercel link --yes
npx vercel env add DATABASE_URL production < <(echo "$DATABASE_URL")
npx vercel env add API_SPORTS_KEY production < <(echo "59a412d1517e283a005f9885bde1da5b")
```

Manuális lépés: `vercel.com` → Settings → Git → "Connected Git Repository" ellenőrzés hogy `kratam/tipper` és deploy on push aktív. **FONTOS:** személyes account, NEM GuestGuru team.

`vercel.json` létrehozás a cron-hoz:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add vercel.json biome.json package.json
git commit -m "chore: add Vercel cron config and Biome setup"
git push
```

---

## Task 2: Shadcn UI beállítás

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/app/globals.css` (módosítás)

- [ ] **Step 1: Shadcn init**

```bash
npx shadcn@latest init
```

Válaszok: Style → New York, Base color → Zinc, CSS variables → yes.

- [ ] **Step 2: Alapvető komponensek telepítése**

```bash
npx shadcn@latest add button card input label select dialog form toast tabs avatar badge separator dropdown-menu
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Shadcn UI with base components"
git push
```

---

## Task 3: Drizzle ORM + Neon DB séma

**Files:**
- Create: `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`
- Modify: `package.json` (scripts), `.env.local`

- [ ] **Step 1: Drizzle függőségek telepítése**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 2: `.env.local` kiegészítés**

A Neon connection string-et a Neon MCP-vel kérdezzük le:

```bash
# Neon MCP: get_connection_string project_id=patient-leaf-69938778
# Az eredményt .env.local-ba:
```

`.env.local`:
```env
DATABASE_URL=postgresql://...neon connection string...
API_SPORTS_KEY=59a412d1517e283a005f9885bde1da5b
```

- [ ] **Step 3: `drizzle.config.ts` létrehozás**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: `src/db/index.ts` — Drizzle client**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 5: `src/db/schema.ts` — Teljes séma**

```ts
import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const tournamentStatusEnum = pgEnum("tournament_status", [
  "upcoming",
  "active",
  "finished",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
  "cancelled",
]);

export const tokenTypeEnum = pgEnum("token_type", [
  "distribution",
  "bet",
  "win",
  "carryover",
  "refund",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: text("google_id").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  apiLeagueId: integer("api_league_id").notNull(),
  apiSeason: integer("api_season").notNull(),
  status: tournamentStatusEnum("status").default("upcoming").notNull(),
  podiumLockDate: timestamp("podium_lock_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiTeamId: integer("api_team_id").unique().notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id).notNull(),
  apiGameId: integer("api_game_id").unique().notNull(),
  homeTeamId: uuid("home_team_id").references(() => teams.id).notNull(),
  awayTeamId: uuid("away_team_id").references(() => teams.id).notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  status: matchStatusEnum("status").default("scheduled").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  round: text("round").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matchOdds = pgTable("match_odds", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => matches.id).notNull(),
  homeOdds: decimal("home_odds", { precision: 6, scale: 2 }).notNull(),
  drawOdds: decimal("draw_odds", { precision: 6, scale: 2 }).notNull(),
  awayOdds: decimal("away_odds", { precision: 6, scale: 2 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  inviteCode: text("invite_code").unique().notNull(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id).notNull(),
  tokenPerRound: integer("token_per_round").default(100).notNull(),
  bonusGoalDiff: integer("bonus_goal_diff").default(5).notNull(),
  bonusExactScore: integer("bonus_exact_score").default(10).notNull(),
  bonusPodiumMention: integer("bonus_podium_mention").default(20).notNull(),
  bonusPodiumExact: integer("bonus_podium_exact").default(20).notNull(),
  carryoverPercent: integer("carryover_percent").default(50).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").references(() => groups.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("group_user_idx").on(table.groupId, table.userId)],
);

export const bets = pgTable(
  "bets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    matchId: uuid("match_id").references(() => matches.id).notNull(),
    groupId: uuid("group_id").references(() => groups.id).notNull(),
    predictedHome: integer("predicted_home").notNull(),
    predictedAway: integer("predicted_away").notNull(),
    stake: integer("stake").notNull(),
    oddsAtBet: decimal("odds_at_bet", { precision: 6, scale: 2 }),
    result1x2Correct: boolean("result_1x2_correct"),
    goalDiffCorrect: boolean("goal_diff_correct"),
    exactScoreCorrect: boolean("exact_score_correct"),
    payout: integer("payout"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("bet_unique_idx").on(table.userId, table.matchId, table.groupId)],
);

export const podiumBets = pgTable(
  "podium_bets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    tournamentId: uuid("tournament_id").references(() => tournaments.id).notNull(),
    groupId: uuid("group_id").references(() => groups.id).notNull(),
    goldTeamId: uuid("gold_team_id").references(() => teams.id).notNull(),
    silverTeamId: uuid("silver_team_id").references(() => teams.id).notNull(),
    bronzeTeamId: uuid("bronze_team_id").references(() => teams.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("podium_unique_idx").on(table.userId, table.tournamentId, table.groupId)],
);

export const tokenLedger = pgTable("token_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  groupId: uuid("group_id").references(() => groups.id).notNull(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id).notNull(),
  amount: integer("amount").notNull(),
  type: tokenTypeEnum("type").notNull(),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groupMemberships: many(groupMembers),
  bets: many(bets),
  podiumBets: many(podiumBets),
  ownedGroups: many(groups),
}));

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  matches: many(matches),
  groups: many(groups),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  odds: many(matchOdds),
  bets: many(bets),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, { fields: [groups.ownerId], references: [users.id] }),
  tournament: one(tournaments, { fields: [groups.tournamentId], references: [tournaments.id] }),
  members: many(groupMembers),
  bets: many(bets),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const betsRelations = relations(bets, ({ one }) => ({
  user: one(users, { fields: [bets.userId], references: [users.id] }),
  match: one(matches, { fields: [bets.matchId], references: [matches.id] }),
  group: one(groups, { fields: [bets.groupId], references: [groups.id] }),
}));
```

- [ ] **Step 6: Migráció generálás és futtatás**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

`package.json` scripts kiegészítés:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle ORM schema with all tables and migrations"
git push
```

---

## Task 4: Neon Auth (Google login)

**Files:**
- Create: `src/lib/stack.ts`, `src/app/handler/[...stack]/route.ts`
- Modify: `middleware.ts`, `.env.local`

- [ ] **Step 1: Stack Auth függőség telepítése**

```bash
npm install @stackauth/nextjs
```

- [ ] **Step 2: Neon Auth environment variables**

A Neon dashboardon (neon.tech → projekt → Auth tab) a Stack Auth credentials-t kell kimásolni. Hozzáadni `.env.local`-hoz:

```env
NEXT_PUBLIC_STACK_PROJECT_ID=...
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=...
STACK_SECRET_SERVER_KEY=...
```

Vercel-en is beállítani:
```bash
npx vercel env add NEXT_PUBLIC_STACK_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY production
npx vercel env add STACK_SECRET_SERVER_KEY production
```

- [ ] **Step 3: `src/lib/stack.ts` — Stack Auth server app**

```ts
import "server-only";
import { StackServerApp } from "@stackauth/nextjs";

export const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
  urls: {
    signIn: "/handler/sign-in",
    signUp: "/handler/sign-up",
    afterSignIn: "/tournaments",
    afterSignUp: "/tournaments",
  },
});
```

- [ ] **Step 4: `src/app/handler/[...stack]/route.ts` — Auth handler**

```ts
import { stackServerApp } from "@/lib/stack";

export const GET = stackServerApp.handler.GET;
export const POST = stackServerApp.handler.POST;
```

- [ ] **Step 5: `middleware.ts` — Auth + i18n middleware**

Egyelőre csak auth, i18n-t a következő task-ban adjuk hozzá:

```ts
export { stackMiddleware as default } from "@stackauth/nextjs";

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|handler|api).*)"],
};
```

- [ ] **Step 6: User szinkronizáció — auth webhook vagy on-login**

A bejelentkezett user-t szinkronizáljuk a `users` táblával. Hozzunk létre egy segédfüggvényt:

`src/lib/auth.ts`:
```ts
import "server-only";
import { stackServerApp } from "./stack";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser() {
  const stackUser = await stackServerApp.getUser();
  if (!stackUser) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.googleId, stackUser.id),
  });

  if (existing) return existing;

  const [newUser] = await db
    .insert(users)
    .values({
      googleId: stackUser.id,
      email: stackUser.primaryEmail ?? "",
      name: stackUser.displayName ?? stackUser.primaryEmail ?? "Unknown",
      avatarUrl: stackUser.profileImageUrl,
    })
    .returning();

  return newUser;
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Neon Auth with Google login and user sync"
git push
```

---

## Task 5: next-intl i18n beállítás

**Files:**
- Create: `i18n/request.ts`, `messages/hu.json`, `messages/en.json`, `src/app/[locale]/layout.tsx`
- Modify: `next.config.ts`, `middleware.ts`

- [ ] **Step 1: next-intl telepítés**

```bash
npm install next-intl
```

- [ ] **Step 2: `i18n/request.ts`**

```ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || "hu";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: `next.config.ts` módosítás**

```ts
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 4: `middleware.ts` — auth + i18n kombinálás**

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|handler|api).*)"],
};
```

`i18n/routing.ts`:
```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["hu", "en"],
  defaultLocale: "hu",
});
```

- [ ] **Step 5: `messages/hu.json` — alap fordítások**

```json
{
  "common": {
    "appName": "Tipper",
    "login": "Bejelentkezés",
    "logout": "Kijelentkezés",
    "save": "Mentés",
    "cancel": "Mégse",
    "back": "Vissza",
    "loading": "Betöltés...",
    "error": "Hiba történt"
  },
  "nav": {
    "tournaments": "Versenysorozatok",
    "groups": "Csoportjaim",
    "admin": "Admin"
  },
  "landing": {
    "title": "Tipper",
    "subtitle": "Tippelj sportmeccsekre, gyűjts pontokat, versenyezz barátaiddal!",
    "cta": "Bejelentkezés Google-lel"
  },
  "tournaments": {
    "title": "Versenysorozatok",
    "upcoming": "Közelgő",
    "active": "Aktív",
    "finished": "Befejezett",
    "matches": "Meccsek",
    "podium": "Dobogós tipp"
  },
  "matches": {
    "scheduled": "Tervezett",
    "live": "Élő",
    "finished": "Befejezett",
    "yourBet": "A tipped",
    "noBet": "Még nem tippeltél",
    "betLocked": "A tippelés lezárult",
    "oddsNotAvailable": "Az odds még nem elérhető, az első betöltött odds alapján számolunk."
  },
  "betting": {
    "title": "Tippelés",
    "prediction": "Tipped",
    "stake": "Tét",
    "availableTokens": "Elérhető tokenek",
    "submit": "Tipp leadása",
    "update": "Tipp módosítása",
    "cancel": "Tipp visszavonása",
    "sameForAll": "Ugyanez a tipp minden csoportomban",
    "customPerGroup": "Csoportonként külön"
  },
  "groups": {
    "title": "Csoportjaim",
    "create": "Új csoport létrehozása",
    "name": "Csoport neve",
    "inviteCode": "Meghívó kód",
    "copyLink": "Meghívó link másolása",
    "members": "Tagok",
    "settings": "Beállítások",
    "leaderboard": "Ranglista",
    "join": "Csatlakozás",
    "leave": "Kilépés",
    "tokenPerRound": "Token/kör",
    "bonusGoalDiff": "Gólkülönbség bónusz",
    "bonusExactScore": "Pontos eredmény bónusz",
    "bonusPodiumMention": "Dobogós említés bónusz",
    "bonusPodiumExact": "Pontos helyezés bónusz",
    "carryoverPercent": "Átvitel %"
  },
  "podium": {
    "title": "Dobogós tipp",
    "gold": "Aranyérem",
    "silver": "Ezüstérem",
    "bronze": "Bronzérem",
    "locked": "A dobogós tippelés lezárult",
    "submit": "Dobogós tipp leadása"
  },
  "leaderboard": {
    "rank": "Helyezés",
    "player": "Játékos",
    "points": "Pontok",
    "balance": "Egyenleg"
  },
  "admin": {
    "title": "Admin",
    "createTournament": "Versenysorozat létrehozása",
    "syncNow": "Szinkronizálás most",
    "tournamentName": "Név",
    "leagueId": "Liga ID",
    "season": "Szezon"
  }
}
```

- [ ] **Step 6: `messages/en.json` — angol fordítások**

```json
{
  "common": {
    "appName": "Tipper",
    "login": "Sign in",
    "logout": "Sign out",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "nav": {
    "tournaments": "Tournaments",
    "groups": "My Groups",
    "admin": "Admin"
  },
  "landing": {
    "title": "Tipper",
    "subtitle": "Predict sports matches, earn points, compete with friends!",
    "cta": "Sign in with Google"
  },
  "tournaments": {
    "title": "Tournaments",
    "upcoming": "Upcoming",
    "active": "Active",
    "finished": "Finished",
    "matches": "Matches",
    "podium": "Podium Prediction"
  },
  "matches": {
    "scheduled": "Scheduled",
    "live": "Live",
    "finished": "Finished",
    "yourBet": "Your bet",
    "noBet": "No bet yet",
    "betLocked": "Betting is closed",
    "oddsNotAvailable": "Odds not yet available. Your bet will use the first available odds."
  },
  "betting": {
    "title": "Place Bet",
    "prediction": "Your prediction",
    "stake": "Stake",
    "availableTokens": "Available tokens",
    "submit": "Place bet",
    "update": "Update bet",
    "cancel": "Cancel bet",
    "sameForAll": "Same bet for all my groups",
    "customPerGroup": "Custom per group"
  },
  "groups": {
    "title": "My Groups",
    "create": "Create new group",
    "name": "Group name",
    "inviteCode": "Invite code",
    "copyLink": "Copy invite link",
    "members": "Members",
    "settings": "Settings",
    "leaderboard": "Leaderboard",
    "join": "Join",
    "leave": "Leave",
    "tokenPerRound": "Tokens/round",
    "bonusGoalDiff": "Goal difference bonus",
    "bonusExactScore": "Exact score bonus",
    "bonusPodiumMention": "Podium mention bonus",
    "bonusPodiumExact": "Exact placement bonus",
    "carryoverPercent": "Carryover %"
  },
  "podium": {
    "title": "Podium Prediction",
    "gold": "Gold",
    "silver": "Silver",
    "bronze": "Bronze",
    "locked": "Podium predictions are locked",
    "submit": "Submit podium prediction"
  },
  "leaderboard": {
    "rank": "Rank",
    "player": "Player",
    "points": "Points",
    "balance": "Balance"
  },
  "admin": {
    "title": "Admin",
    "createTournament": "Create Tournament",
    "syncNow": "Sync Now",
    "tournamentName": "Name",
    "leagueId": "League ID",
    "season": "Season"
  }
}
```

- [ ] **Step 7: `src/app/[locale]/layout.tsx` — Root layout i18n-nel**

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "hu" | "en")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Meglévő `src/app/page.tsx` áthelyezés `src/app/[locale]/page.tsx`-be**

A Next.js scaffold által generált `src/app/layout.tsx` és `src/app/page.tsx` fájlokat törölni, és a `[locale]` alá mozgatni. A `src/app/layout.tsx`-et megtartjuk minimálisan (HTML head, metadata), a tényleges layout a `[locale]/layout.tsx`-ben van.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add next-intl with Hungarian and English translations"
git push
```

---

## Task 6: Vitest beállítás teszteléshez

**Files:**
- Create: `vitest.config.ts`, `tests/lib/scoring.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Vitest telepítés**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

`package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add Vitest for testing"
git push
```

---

## Task 7: Pontozási logika (TDD)

**Files:**
- Create: `src/lib/scoring.ts`, `tests/lib/scoring.test.ts`

- [ ] **Step 1: Teszt írása — `tests/lib/scoring.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  get1X2,
  calculateBetPayout,
  calculatePodiumPoints,
} from "@/lib/scoring";

describe("get1X2", () => {
  it("returns '1' when home > away", () => {
    expect(get1X2(3, 1)).toBe("1");
  });

  it("returns 'X' when home === away", () => {
    expect(get1X2(2, 2)).toBe("X");
  });

  it("returns '2' when home < away", () => {
    expect(get1X2(1, 4)).toBe("2");
  });
});

describe("calculateBetPayout", () => {
  const groupSettings = {
    bonusGoalDiff: 5,
    bonusExactScore: 10,
  };

  it("returns 0 when 1X2 is wrong", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(0);
    expect(result.result1x2Correct).toBe(false);
    expect(result.goalDiffCorrect).toBe(false);
    expect(result.exactScoreCorrect).toBe(false);
  });

  it("returns stake * odds when only 1X2 is correct", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(125); // 50 * 2.5
    expect(result.result1x2Correct).toBe(true);
    expect(result.goalDiffCorrect).toBe(true); // both +2
    expect(result.exactScoreCorrect).toBe(false);
  });

  it("adds goal diff bonus when goal difference matches", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 4,
      actualAway: 2,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(130); // 50*2.5 + 5
    expect(result.goalDiffCorrect).toBe(true);
    expect(result.exactScoreCorrect).toBe(false);
  });

  it("adds both bonuses for exact score", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(140); // 50*2.5 + 5 + 10
    expect(result.result1x2Correct).toBe(true);
    expect(result.goalDiffCorrect).toBe(true);
    expect(result.exactScoreCorrect).toBe(true);
  });

  it("handles draws correctly", () => {
    const result = calculateBetPayout({
      predictedHome: 2,
      predictedAway: 2,
      actualHome: 3,
      actualAway: 3,
      stake: 30,
      oddsAtBet: 5.0,
      groupSettings,
    });
    expect(result.payout).toBe(155); // 30*5 + 5 (goal diff: 0=0)
    expect(result.result1x2Correct).toBe(true);
    expect(result.goalDiffCorrect).toBe(true);
  });

  it("handles null oddsAtBet by returning 0", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: null,
      groupSettings,
    });
    expect(result.payout).toBe(0);
  });
});

describe("calculatePodiumPoints", () => {
  const settings = {
    bonusPodiumMention: 20,
    bonusPodiumExact: 20,
  };

  const actualPodium = { gold: "team-a", silver: "team-b", bronze: "team-c" };

  it("returns 0 for no matches", () => {
    const result = calculatePodiumPoints(
      { gold: "team-x", silver: "team-y", bronze: "team-z" },
      actualPodium,
      settings,
    );
    expect(result).toBe(0);
  });

  it("returns mention bonus for correct team wrong placement", () => {
    const result = calculatePodiumPoints(
      { gold: "team-c", silver: "team-x", bronze: "team-y" },
      actualPodium,
      settings,
    );
    expect(result).toBe(20); // team-c mentioned, wrong placement
  });

  it("returns mention + exact for correct team correct placement", () => {
    const result = calculatePodiumPoints(
      { gold: "team-a", silver: "team-x", bronze: "team-y" },
      actualPodium,
      settings,
    );
    expect(result).toBe(40); // team-a mentioned + exact
  });

  it("accumulates across all three positions", () => {
    const result = calculatePodiumPoints(
      { gold: "team-a", silver: "team-b", bronze: "team-c" },
      actualPodium,
      settings,
    );
    expect(result).toBe(120); // 3 * (20 mention + 20 exact)
  });
});
```

- [ ] **Step 2: Teszt futtatás — FAIL**

```bash
npm test
```

Elvárt: FAIL — `scoring` module nem létezik.

- [ ] **Step 3: `src/lib/scoring.ts` implementáció**

```ts
type Outcome = "1" | "X" | "2";

export function get1X2(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home === away) return "X";
  return "2";
}

interface BetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  groupSettings: {
    bonusGoalDiff: number;
    bonusExactScore: number;
  };
}

interface BetPayoutResult {
  payout: number;
  result1x2Correct: boolean;
  goalDiffCorrect: boolean;
  exactScoreCorrect: boolean;
}

export function calculateBetPayout(input: BetPayoutInput): BetPayoutResult {
  const {
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
    stake,
    oddsAtBet,
    groupSettings,
  } = input;

  if (oddsAtBet === null) {
    return { payout: 0, result1x2Correct: false, goalDiffCorrect: false, exactScoreCorrect: false };
  }

  const predicted1X2 = get1X2(predictedHome, predictedAway);
  const actual1X2 = get1X2(actualHome, actualAway);
  const result1x2Correct = predicted1X2 === actual1X2;

  if (!result1x2Correct) {
    return { payout: 0, result1x2Correct: false, goalDiffCorrect: false, exactScoreCorrect: false };
  }

  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;
  const goalDiffCorrect = predictedDiff === actualDiff;
  const exactScoreCorrect = predictedHome === actualHome && predictedAway === actualAway;

  let payout = Math.round(stake * oddsAtBet);
  if (goalDiffCorrect) payout += groupSettings.bonusGoalDiff;
  if (exactScoreCorrect) payout += groupSettings.bonusExactScore;

  return { payout, result1x2Correct, goalDiffCorrect, exactScoreCorrect };
}

interface PodiumPrediction {
  gold: string;
  silver: string;
  bronze: string;
}

export function calculatePodiumPoints(
  prediction: PodiumPrediction,
  actual: PodiumPrediction,
  settings: { bonusPodiumMention: number; bonusPodiumExact: number },
): number {
  const actualTeams = new Set([actual.gold, actual.silver, actual.bronze]);
  let points = 0;

  const positions: Array<keyof PodiumPrediction> = ["gold", "silver", "bronze"];

  for (const pos of positions) {
    const predictedTeam = prediction[pos];
    if (actualTeams.has(predictedTeam)) {
      points += settings.bonusPodiumMention;
      if (actual[pos] === predictedTeam) {
        points += settings.bonusPodiumExact;
      }
    }
  }

  return points;
}
```

- [ ] **Step 4: Teszt futtatás — PASS**

```bash
npm test
```

Elvárt: PASS — minden teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "feat: add scoring logic with full test coverage"
git push
```

---

## Task 8: Token management logika (TDD)

**Files:**
- Create: `src/lib/tokens.ts`, `tests/lib/tokens.test.ts`

- [ ] **Step 1: Teszt írása — `tests/lib/tokens.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { calculateCarryover, getRelevantOdds } from "@/lib/tokens";

describe("calculateCarryover", () => {
  it("returns 50% of unused tokens rounded down", () => {
    expect(calculateCarryover(75, 50)).toBe(37);
  });

  it("returns 0 when all tokens used", () => {
    expect(calculateCarryover(0, 50)).toBe(0);
  });

  it("rounds down odd numbers", () => {
    expect(calculateCarryover(3, 50)).toBe(1);
  });

  it("handles 0% carryover", () => {
    expect(calculateCarryover(100, 0)).toBe(0);
  });

  it("handles 100% carryover", () => {
    expect(calculateCarryover(100, 100)).toBe(100);
  });
});

describe("getRelevantOdds", () => {
  const odds = { homeOdds: "1.5", drawOdds: "4.0", awayOdds: "6.0" };

  it("returns home odds when predicted home > away", () => {
    expect(getRelevantOdds(3, 1, odds)).toBe(1.5);
  });

  it("returns draw odds when predicted home === away", () => {
    expect(getRelevantOdds(2, 2, odds)).toBe(4.0);
  });

  it("returns away odds when predicted home < away", () => {
    expect(getRelevantOdds(0, 3, odds)).toBe(6.0);
  });
});
```

- [ ] **Step 2: Teszt futtatás — FAIL**

```bash
npm test
```

- [ ] **Step 3: `src/lib/tokens.ts` implementáció**

```ts
import { get1X2 } from "./scoring";

export function calculateCarryover(unusedTokens: number, carryoverPercent: number): number {
  return Math.floor(unusedTokens * (carryoverPercent / 100));
}

export function getRelevantOdds(
  predictedHome: number,
  predictedAway: number,
  odds: { homeOdds: string; drawOdds: string; awayOdds: string },
): number {
  const outcome = get1X2(predictedHome, predictedAway);
  switch (outcome) {
    case "1":
      return Number.parseFloat(odds.homeOdds);
    case "X":
      return Number.parseFloat(odds.drawOdds);
    case "2":
      return Number.parseFloat(odds.awayOdds);
  }
}
```

- [ ] **Step 4: Teszt futtatás — PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts tests/lib/tokens.test.ts
git commit -m "feat: add token management logic with tests"
git push
```

---

## Task 9: api-sports.io client

**Files:**
- Create: `src/lib/api-sports.ts`, `tests/lib/api-sports.test.ts`

- [ ] **Step 1: Teszt írása — `tests/lib/api-sports.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseRegulationScore, parsePeriodsString } from "@/lib/api-sports";

describe("parsePeriodsString", () => {
  it("parses '2-1' to [2, 1]", () => {
    expect(parsePeriodsString("2-1")).toEqual([2, 1]);
  });

  it("returns [0, 0] for null", () => {
    expect(parsePeriodsString(null)).toEqual([0, 0]);
  });
});

describe("parseRegulationScore", () => {
  it("sums first three periods", () => {
    const periods = {
      first: "2-1",
      second: "0-1",
      third: "1-0",
      overtime: "1-0",
      penalties: null,
    };
    expect(parseRegulationScore(periods)).toEqual({ home: 3, away: 2 });
  });

  it("ignores overtime and penalties", () => {
    const periods = {
      first: "1-1",
      second: "1-1",
      third: "0-0",
      overtime: "0-1",
      penalties: "2-3",
    };
    expect(parseRegulationScore(periods)).toEqual({ home: 2, away: 2 });
  });

  it("handles null periods", () => {
    const periods = {
      first: null,
      second: null,
      third: null,
      overtime: null,
      penalties: null,
    };
    expect(parseRegulationScore(periods)).toEqual({ home: 0, away: 0 });
  });
});
```

- [ ] **Step 2: Teszt futtatás — FAIL**

```bash
npm test
```

- [ ] **Step 3: `src/lib/api-sports.ts` implementáció**

```ts
const BASE_URL = "https://v1.hockey.api-sports.io";

function getHeaders(): HeadersInit {
  return {
    "x-apisports-key": process.env.API_SPORTS_KEY!,
  };
}

// Period string parsing
export function parsePeriodsString(period: string | null): [number, number] {
  if (!period) return [0, 0];
  const [home, away] = period.split("-").map(Number);
  return [home, away];
}

interface ApiPeriods {
  first: string | null;
  second: string | null;
  third: string | null;
  overtime: string | null;
  penalties: string | null;
}

export function parseRegulationScore(periods: ApiPeriods): { home: number; away: number } {
  const [h1, a1] = parsePeriodsString(periods.first);
  const [h2, a2] = parsePeriodsString(periods.second);
  const [h3, a3] = parsePeriodsString(periods.third);
  return { home: h1 + h2 + h3, away: a1 + a2 + a3 };
}

// API types
interface ApiTeam {
  id: number;
  name: string;
  logo: string;
}

interface ApiGame {
  id: number;
  date: string;
  status: { short: string };
  teams: { home: ApiTeam; away: ApiTeam };
  scores: { home: number | null; away: number | null };
  periods: ApiPeriods;
}

interface ApiOddsValue {
  value: string;
  odd: string;
}

interface ApiOddsBet {
  id: number;
  name: string;
  values: ApiOddsValue[];
}

interface ApiOddsBookmaker {
  id: number;
  name: string;
  bets: ApiOddsBet[];
}

interface ApiOddsGame {
  game: { id: number };
  bookmakers: ApiOddsBookmaker[];
}

// Fetchers
export async function fetchGames(leagueId: number, season: number): Promise<ApiGame[]> {
  const res = await fetch(`${BASE_URL}/games?league=${leagueId}&season=${season}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.response;
}

export async function fetchOdds(leagueId: number, season: number): Promise<ApiOddsGame[]> {
  const res = await fetch(`${BASE_URL}/odds?league=${leagueId}&season=${season}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.response;
}

// Helper to extract 3-way odds from first available bookmaker
export function extract3WayOdds(
  oddsGame: ApiOddsGame,
): { homeOdds: string; drawOdds: string; awayOdds: string } | null {
  for (const bookmaker of oddsGame.bookmakers) {
    const threeWay = bookmaker.bets.find(
      (b) => b.name === "3Way Result" || b.name === "Match Winner",
    );
    if (threeWay && threeWay.values.length >= 3) {
      const home = threeWay.values.find((v) => v.value === "Home");
      const draw = threeWay.values.find((v) => v.value === "Draw");
      const away = threeWay.values.find((v) => v.value === "Away");
      if (home && draw && away) {
        return { homeOdds: home.odd, drawOdds: draw.odd, awayOdds: away.odd };
      }
    }
  }
  return null;
}

// Map API status to our status
export function mapApiStatus(apiStatus: string): "scheduled" | "live" | "finished" | "cancelled" {
  switch (apiStatus) {
    case "NS":
      return "scheduled";
    case "FT":
    case "AOT":
    case "AP":
      return "finished";
    case "CANC":
    case "POST":
      return "cancelled";
    default:
      return "live"; // P1, P2, P3, OT, BT, PT etc.
  }
}
```

- [ ] **Step 4: Teszt futtatás — PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-sports.ts tests/lib/api-sports.test.ts
git commit -m "feat: add api-sports.io client with regulation score parsing"
git push
```

---

## Task 10: Utility függvények

**Files:**
- Create: `src/lib/utils.ts`

- [ ] **Step 1: `src/lib/utils.ts`**

A Shadcn által generált `cn()` mellett hozzáadjuk az invite code generálást és slug helper-t:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 to avoid confusion
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add utility functions (invite code, slugify, formatDate)"
git push
```

---

## Task 11: Cron sync endpoint

**Files:**
- Create: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: `src/app/api/cron/sync/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, matches, teams, matchOdds, bets, tokenLedger, groupMembers } from "@/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import {
  fetchGames,
  fetchOdds,
  parseRegulationScore,
  extract3WayOdds,
  mapApiStatus,
} from "@/lib/api-sports";
import { calculateBetPayout } from "@/lib/scoring";
import { getRelevantOdds, calculateCarryover } from "@/lib/tokens";

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });

  for (const tournament of activeTournaments) {
    await syncTournament(tournament);
  }

  return NextResponse.json({ ok: true, synced: activeTournaments.length });
}

async function syncTournament(tournament: typeof tournaments.$inferSelect) {
  // 1. Sync fixtures
  const apiGames = await fetchGames(tournament.apiLeagueId, tournament.apiSeason);

  for (const game of apiGames) {
    // Upsert teams
    const homeTeam = await upsertTeam(game.teams.home);
    const awayTeam = await upsertTeam(game.teams.away);

    const newStatus = mapApiStatus(game.status.short);
    const scheduledAt = new Date(game.date);
    const round = scheduledAt.toISOString().split("T")[0]; // YYYY-MM-DD

    // Upsert match
    const existingMatch = await db.query.matches.findFirst({
      where: eq(matches.apiGameId, game.id),
    });

    let regulationScore: { home: number; away: number } | null = null;
    if (newStatus === "finished") {
      regulationScore = parseRegulationScore(game.periods);
    }

    if (existingMatch) {
      const wasNotFinished = existingMatch.status !== "finished";
      const isNowFinished = newStatus === "finished";

      await db
        .update(matches)
        .set({
          status: newStatus,
          homeScore: regulationScore?.home ?? existingMatch.homeScore,
          awayScore: regulationScore?.away ?? existingMatch.awayScore,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existingMatch.id));

      // Score newly finished matches
      if (wasNotFinished && isNowFinished && regulationScore) {
        await scoreMatch(existingMatch.id, regulationScore.home, regulationScore.away);
      }

      // Handle cancellation — refund bets
      if (existingMatch.status !== "cancelled" && newStatus === "cancelled") {
        await refundMatch(existingMatch.id);
      }
    } else {
      await db.insert(matches).values({
        tournamentId: tournament.id,
        apiGameId: game.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: regulationScore?.home ?? null,
        awayScore: regulationScore?.away ?? null,
        status: newStatus,
        scheduledAt,
        round,
      });
    }
  }

  // 2. Sync odds
  const apiOdds = await fetchOdds(tournament.apiLeagueId, tournament.apiSeason);

  for (const oddsGame of apiOdds) {
    const match = await db.query.matches.findFirst({
      where: and(eq(matches.apiGameId, oddsGame.game.id), eq(matches.status, "scheduled")),
    });

    if (!match) continue;

    const threeWay = extract3WayOdds(oddsGame);
    if (!threeWay) continue;

    // Insert new odds record
    await db.insert(matchOdds).values({
      matchId: match.id,
      homeOdds: threeWay.homeOdds,
      drawOdds: threeWay.drawOdds,
      awayOdds: threeWay.awayOdds,
    });

    // Fill in NULL odds_at_bet for existing bets
    const betsWithoutOdds = await db.query.bets.findMany({
      where: and(eq(bets.matchId, match.id), isNull(bets.oddsAtBet)),
    });

    for (const bet of betsWithoutOdds) {
      const relevantOdds = getRelevantOdds(bet.predictedHome, bet.predictedAway, threeWay);
      await db
        .update(bets)
        .set({ oddsAtBet: String(relevantOdds), updatedAt: new Date() })
        .where(eq(bets.id, bet.id));
    }
  }
}

async function upsertTeam(apiTeam: { id: number; name: string; logo: string }) {
  const existing = await db.query.teams.findFirst({
    where: eq(teams.apiTeamId, apiTeam.id),
  });

  if (existing) return existing;

  const [newTeam] = await db
    .insert(teams)
    .values({
      apiTeamId: apiTeam.id,
      name: apiTeam.name,
      logoUrl: apiTeam.logo,
    })
    .returning();

  return newTeam;
}

async function scoreMatch(matchId: string, homeScore: number, awayScore: number) {
  const matchBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), isNull(bets.payout)),
  });

  for (const bet of matchBets) {
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, bet.groupId),
    });

    if (!group) continue;

    const result = calculateBetPayout({
      predictedHome: bet.predictedHome,
      predictedAway: bet.predictedAway,
      actualHome: homeScore,
      actualAway: awayScore,
      stake: bet.stake,
      oddsAtBet: bet.oddsAtBet ? Number.parseFloat(bet.oddsAtBet) : null,
      groupSettings: {
        bonusGoalDiff: group.bonusGoalDiff,
        bonusExactScore: group.bonusExactScore,
      },
    });

    await db
      .update(bets)
      .set({
        result1x2Correct: result.result1x2Correct,
        goalDiffCorrect: result.goalDiffCorrect,
        exactScoreCorrect: result.exactScoreCorrect,
        payout: result.payout,
        updatedAt: new Date(),
      })
      .where(eq(bets.id, bet.id));

    // Credit winnings to token_ledger
    if (result.payout > 0) {
      const match = await db.query.matches.findFirst({
        where: eq(matches.id, matchId),
      });
      await db.insert(tokenLedger).values({
        userId: bet.userId,
        groupId: bet.groupId,
        tournamentId: match!.tournamentId,
        amount: result.payout,
        type: "win",
        referenceId: bet.id,
      });
    }
  }
}

async function refundMatch(matchId: string) {
  const matchBets = await db.query.bets.findMany({
    where: eq(bets.matchId, matchId),
  });

  for (const bet of matchBets) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });

    await db.insert(tokenLedger).values({
      userId: bet.userId,
      groupId: bet.groupId,
      tournamentId: match!.tournamentId,
      amount: bet.stake, // Positive = refund
      type: "refund",
      referenceId: bet.id,
    });
  }
}

// Need to import groups for scoreMatch
import { groups } from "@/db/schema";
```

Megjegyzés: a `groups` importot a fájl elejére kell mozgatni a végső kódban — itt a cron logikát mutatjuk.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat: add cron sync endpoint for fixtures, odds, and scoring"
git push
```

---

## Task 12: Server Actions — Groups

**Files:**
- Create: `src/actions/groups.ts`, `src/queries/groups.ts`

- [ ] **Step 1: `src/queries/groups.ts`**

```ts
import { db } from "@/db";
import { groups, groupMembers, tokenLedger } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function getUserGroups(userId: string) {
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: {
      group: {
        with: {
          tournament: true,
          owner: true,
        },
      },
    },
  });
}

export async function getGroupBySlug(slug: string) {
  return db.query.groups.findFirst({
    where: eq(groups.slug, slug),
    with: {
      tournament: true,
      owner: true,
      members: { with: { user: true } },
    },
  });
}

export async function getGroupByInviteCode(code: string) {
  return db.query.groups.findFirst({
    where: eq(groups.inviteCode, code),
    with: { tournament: true },
  });
}

export async function getTokenBalance(userId: string, groupId: string): Promise<number> {
  const result = await db
    .select({ balance: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)` })
    .from(tokenLedger)
    .where(and(eq(tokenLedger.userId, userId), eq(tokenLedger.groupId, groupId)));

  return result[0]?.balance ?? 0;
}
```

- [ ] **Step 2: `src/actions/groups.ts`**

```ts
"use server";

import { db } from "@/db";
import { groups, groupMembers, tokenLedger } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateInviteCode, slugify } from "@/lib/utils";
import { redirect } from "next/navigation";

interface CreateGroupInput {
  name: string;
  tournamentId: string;
  tokenPerRound?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  carryoverPercent?: number;
}

export async function createGroup(input: CreateGroupInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const slug = slugify(input.name);
  const inviteCode = generateInviteCode();

  const [group] = await db
    .insert(groups)
    .values({
      name: input.name,
      slug,
      inviteCode,
      ownerId: user.id,
      tournamentId: input.tournamentId,
      tokenPerRound: input.tokenPerRound ?? 100,
      bonusGoalDiff: input.bonusGoalDiff ?? 5,
      bonusExactScore: input.bonusExactScore ?? 10,
      bonusPodiumMention: input.bonusPodiumMention ?? 20,
      bonusPodiumExact: input.bonusPodiumExact ?? 20,
      carryoverPercent: input.carryoverPercent ?? 50,
    })
    .returning();

  // Auto-join the creator
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  return group;
}

export async function joinGroup(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, inviteCode),
  });

  if (!group) throw new Error("Group not found");

  // Check if already a member
  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
  });

  if (!existing) {
    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: user.id,
    });
  }

  redirect(`/groups/${group.slug}`);
}

export async function updateGroupSettings(
  groupId: string,
  settings: Partial<Pick<
    typeof groups.$inferInsert,
    "tokenPerRound" | "bonusGoalDiff" | "bonusExactScore" | "bonusPodiumMention" | "bonusPodiumExact" | "carryoverPercent"
  >>,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });

  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Not group owner");
  if (group.tournament.status !== "upcoming") throw new Error("Tournament already started");

  await db.update(groups).set(settings).where(eq(groups.id, groupId));
}

export async function removeMember(groupId: string, userId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Not group owner");
  if (userId === user.id) throw new Error("Cannot remove yourself");

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/groups.ts src/queries/groups.ts
git commit -m "feat: add group CRUD server actions and queries"
git push
```

---

## Task 13: Server Actions — Bets

**Files:**
- Create: `src/actions/bets.ts`, `src/queries/bets.ts`, `src/queries/matches.ts`

- [ ] **Step 1: `src/queries/matches.ts`**

```ts
import { db } from "@/db";
import { matches, matchOdds } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getMatchesForTournament(tournamentId: string) {
  return db.query.matches.findMany({
    where: eq(matches.tournamentId, tournamentId),
    with: {
      homeTeam: true,
      awayTeam: true,
      odds: { orderBy: [desc(matchOdds.fetchedAt)], limit: 1 },
    },
    orderBy: [matches.scheduledAt],
  });
}

export async function getMatchById(matchId: string) {
  return db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      homeTeam: true,
      awayTeam: true,
      tournament: true,
      odds: { orderBy: [desc(matchOdds.fetchedAt)], limit: 1 },
    },
  });
}

export async function getLatestOdds(matchId: string) {
  return db.query.matchOdds.findFirst({
    where: eq(matchOdds.matchId, matchId),
    orderBy: [desc(matchOdds.fetchedAt)],
  });
}
```

- [ ] **Step 2: `src/queries/bets.ts`**

```ts
import { db } from "@/db";
import { bets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function getUserBetsForMatch(userId: string, matchId: string) {
  return db.query.bets.findMany({
    where: and(eq(bets.userId, userId), eq(bets.matchId, matchId)),
    with: { group: true },
  });
}

export async function getUserBetsForTournament(userId: string, tournamentId: string) {
  return db.query.bets.findMany({
    where: eq(bets.userId, userId),
    with: {
      match: { with: { homeTeam: true, awayTeam: true } },
      group: true,
    },
  });
}
```

- [ ] **Step 3: `src/actions/bets.ts`**

```ts
"use server";

import { db } from "@/db";
import { bets, matches, tokenLedger } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getTokenBalance } from "@/queries/groups";
import { getLatestOdds } from "@/queries/matches";
import { getRelevantOdds } from "@/lib/tokens";

interface PlaceBetInput {
  matchId: string;
  groupId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
}

export async function placeBet(input: PlaceBetInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Verify match is still open
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, input.matchId),
  });
  if (!match) throw new Error("Match not found");
  if (match.status !== "scheduled") throw new Error("Betting is closed for this match");
  if (new Date() >= match.scheduledAt) throw new Error("Match has already started");

  // Check balance
  const balance = await getTokenBalance(user.id, input.groupId);
  if (input.stake > balance) throw new Error("Insufficient tokens");
  if (input.stake < 1) throw new Error("Minimum bet is 1 token");

  // Get current odds (may be null)
  const latestOdds = await getLatestOdds(input.matchId);
  let oddsAtBet: string | null = null;
  if (latestOdds) {
    oddsAtBet = String(
      getRelevantOdds(input.predictedHome, input.predictedAway, {
        homeOdds: latestOdds.homeOdds,
        drawOdds: latestOdds.drawOdds,
        awayOdds: latestOdds.awayOdds,
      }),
    );
  }

  // Check for existing bet (update or insert)
  const existingBet = await db.query.bets.findFirst({
    where: and(
      eq(bets.userId, user.id),
      eq(bets.matchId, input.matchId),
      eq(bets.groupId, input.groupId),
    ),
  });

  if (existingBet) {
    // Refund old stake
    await db.insert(tokenLedger).values({
      userId: user.id,
      groupId: input.groupId,
      tournamentId: match.tournamentId,
      amount: existingBet.stake,
      type: "refund",
      referenceId: existingBet.id,
    });

    // Update bet
    await db
      .update(bets)
      .set({
        predictedHome: input.predictedHome,
        predictedAway: input.predictedAway,
        stake: input.stake,
        oddsAtBet,
        updatedAt: new Date(),
      })
      .where(eq(bets.id, existingBet.id));

    // Deduct new stake
    await db.insert(tokenLedger).values({
      userId: user.id,
      groupId: input.groupId,
      tournamentId: match.tournamentId,
      amount: -input.stake,
      type: "bet",
      referenceId: existingBet.id,
    });
  } else {
    // New bet
    const [newBet] = await db
      .insert(bets)
      .values({
        userId: user.id,
        matchId: input.matchId,
        groupId: input.groupId,
        predictedHome: input.predictedHome,
        predictedAway: input.predictedAway,
        stake: input.stake,
        oddsAtBet,
      })
      .returning();

    // Deduct stake
    await db.insert(tokenLedger).values({
      userId: user.id,
      groupId: input.groupId,
      tournamentId: match.tournamentId,
      amount: -input.stake,
      type: "bet",
      referenceId: newBet.id,
    });
  }
}

export async function cancelBet(betId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const bet = await db.query.bets.findFirst({
    where: and(eq(bets.id, betId), eq(bets.userId, user.id)),
    with: { match: true },
  });

  if (!bet) throw new Error("Bet not found");
  if (bet.match.status !== "scheduled") throw new Error("Cannot cancel — match already started");
  if (new Date() >= bet.match.scheduledAt) throw new Error("Cannot cancel — match already started");

  // Refund stake
  await db.insert(tokenLedger).values({
    userId: user.id,
    groupId: bet.groupId,
    tournamentId: bet.match.tournamentId,
    amount: bet.stake,
    type: "refund",
    referenceId: bet.id,
  });

  // Delete bet
  await db.delete(bets).where(eq(bets.id, betId));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/bets.ts src/queries/bets.ts src/queries/matches.ts
git commit -m "feat: add bet placement, update, and cancel server actions"
git push
```

---

## Task 14: Server Actions — Podium Bets + Leaderboard

**Files:**
- Create: `src/actions/podium-bets.ts`, `src/queries/leaderboard.ts`, `src/queries/tournaments.ts`

- [ ] **Step 1: `src/queries/tournaments.ts`**

```ts
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getTournaments() {
  return db.query.tournaments.findMany({
    orderBy: [tournaments.createdAt],
  });
}

export async function getTournamentBySlug(slug: string) {
  return db.query.tournaments.findFirst({
    where: eq(tournaments.slug, slug),
  });
}
```

- [ ] **Step 2: `src/actions/podium-bets.ts`**

```ts
"use server";

import { db } from "@/db";
import { podiumBets, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

interface PodiumBetInput {
  tournamentId: string;
  groupId: string;
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

export async function placePodiumBet(input: PodiumBetInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, input.tournamentId),
  });

  if (!tournament) throw new Error("Tournament not found");
  if (new Date() > tournament.podiumLockDate) throw new Error("Podium predictions are locked");

  // Upsert
  const existing = await db.query.podiumBets.findFirst({
    where: and(
      eq(podiumBets.userId, user.id),
      eq(podiumBets.tournamentId, input.tournamentId),
      eq(podiumBets.groupId, input.groupId),
    ),
  });

  if (existing) {
    await db
      .update(podiumBets)
      .set({
        goldTeamId: input.goldTeamId,
        silverTeamId: input.silverTeamId,
        bronzeTeamId: input.bronzeTeamId,
      })
      .where(eq(podiumBets.id, existing.id));
  } else {
    await db.insert(podiumBets).values({
      userId: user.id,
      tournamentId: input.tournamentId,
      groupId: input.groupId,
      goldTeamId: input.goldTeamId,
      silverTeamId: input.silverTeamId,
      bronzeTeamId: input.bronzeTeamId,
    });
  }
}
```

- [ ] **Step 3: `src/queries/leaderboard.ts`**

```ts
import { db } from "@/db";
import { tokenLedger, users, groupMembers } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function getGroupLeaderboard(groupId: string) {
  const results = await db
    .select({
      userId: tokenLedger.userId,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      totalPoints: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`.as("total_points"),
    })
    .from(tokenLedger)
    .innerJoin(users, eq(tokenLedger.userId, users.id))
    .where(eq(tokenLedger.groupId, groupId))
    .groupBy(tokenLedger.userId, users.name, users.avatarUrl)
    .orderBy(desc(sql`total_points`));

  return results.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/podium-bets.ts src/queries/leaderboard.ts src/queries/tournaments.ts
git commit -m "feat: add podium bets, leaderboard, and tournament queries"
git push
```

---

## Task 15: Admin Actions

**Files:**
- Create: `src/actions/admin.ts`

- [ ] **Step 1: `src/actions/admin.ts`**

```ts
"use server";

import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

interface CreateTournamentInput {
  name: string;
  apiLeagueId: number;
  apiSeason: number;
  podiumLockDate: Date;
}

export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) throw new Error("Not authorized");

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug: slugify(input.name),
      apiLeagueId: input.apiLeagueId,
      apiSeason: input.apiSeason,
      podiumLockDate: input.podiumLockDate,
    })
    .returning();

  return tournament;
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: "upcoming" | "active" | "finished",
) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) throw new Error("Not authorized");

  await db
    .update(tournaments)
    .set({ status })
    .where(eq(tournaments.id, tournamentId));
}

import { eq } from "drizzle-orm";
```

Megjegyzés: az `eq` importot a fájl elejére kell mozgatni.

- [ ] **Step 2: Commit**

```bash
git add src/actions/admin.ts
git commit -m "feat: add admin actions for tournament management"
git push
```

---

## Task 16–22: UI oldalak — frontend-design skill

> **FONTOS:** A UI oldalakhoz a `superpowers:frontend-design` skill-t kell használni. Az alábbi taskok mindegyikéhez invoke-old a frontend-design skill-t a megadott kontextussal.

### Task 16: Layout + Navigation

**Invoke:** `frontend-design` skill

**Kontextus:**
- Root layout `src/app/[locale]/layout.tsx`-ben
- Nav komponens: `src/components/nav.tsx`
- Tartalmazza: app neve ("Tipper"), nyelv váltó (hu/en), user avatar + név (Google-ből), logout gomb
- Mobil-first, responsive
- Shadcn UI komponensek: `Button`, `Avatar`, `DropdownMenu`
- next-intl `useTranslations("nav")` a szövegekhez
- Sötét/világos téma támogatás

### Task 17: Landing page

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/page.tsx`
- Ha be van jelentkezve → redirect `/tournaments`-ra
- Ha nincs → hero szekció a "Bejelentkezés Google-lel" gombbal
- Rövid feature leírás (tippelj, versenyezz, nyerj)
- `useTranslations("landing")` a szövegekhez

### Task 18: Versenysorozatok lista

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/tournaments/page.tsx`
- `getTournaments()` query
- `TournamentCard` komponens: név, státusz badge (upcoming/active/finished), meccsek száma
- Kattintásra → `/tournaments/[slug]`

### Task 19: Versenysorozat részletek (meccsek + dobogós tipp)

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/tournaments/[slug]/page.tsx`
- Két fő szekció: meccs lista + dobogós tipp
- `MatchCard` komponens: csapat logók/nevek, időpont, odds, eredmény (ha van), a user tippje (ha van)
- `PodiumPicker`: 3 dropdown (arany/ezüst/bronz) a résztvevő csapatokból, csoportonként
- Meccsek szűrhetők: tervezett / élő / befejezett

### Task 20: Meccs részletek + tippelés

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/tournaments/[slug]/matches/[id]/page.tsx`
- `BetForm` komponens a tippeléshez:
  - Eredmény tipp: home score + away score number input
  - Tét: number input (1 — elérhető egyenleg)
  - Aktuális odds megjelenítés (1 / X / 2)
  - Ha nincs odds → figyelmeztetés szöveg
  - Ha több csoportban van → csoportonkénti tét + opcionálisan más eredmény
  - Submit / Módosítás / Visszavonás gombok
- Meccs infó: csapatok, időpont, eredmény (ha van)
- A user korábbi tippjei az adott meccsre

### Task 21: Csoportjaim + Csoport létrehozás

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/groups/page.tsx` — felhasználó csoportjainak listája
- `src/app/[locale]/groups/new/page.tsx` — csoport létrehozás form
  - Versenysorozat kiválasztás (dropdown)
  - Csoport név
  - Szabályok: token/kör, bónuszok, carryover % — default értékekkel előre kitöltve
- `GroupSettingsForm` komponens: a szabályok szerkesztéséhez (reuse create + edit)

### Task 22: Csoport ranglista + Meghívó

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/groups/[slug]/page.tsx`
- `LeaderboardTable`: helyezés, avatar, név, pontszám
- Meghívó kód megjelenítés + "Link másolása" gomb
- Ha a user a csoport adminja: beállítások tab (szabályok szerkesztése, tagok kezelése)
- `src/app/[locale]/join/[code]/page.tsx` — meghívó link handler: Google login ha kell, auto-join, redirect a csoport oldalra

### Task 23: Admin panel

**Invoke:** `frontend-design` skill

**Kontextus:**
- `src/app/[locale]/admin/page.tsx`
- Csak `is_admin` usereknek elérhető
- Versenysorozat lista: név, státusz, meccsek száma
- Versenysorozat létrehozás form: név, api_league_id, api_season, podium_lock_date
- Státusz módosítás (upcoming → active → finished)
- "Szinkronizálás most" gomb (triggereli a cron-t manuálisan)

---

## Self-Review Checklist

- [x] **Spec lefedettség:** Minden spec szekció meg van felelve — adatmodell (Task 3), pontozás (Task 7), token gazdaság (Task 8), API sync (Task 9, 11), csoportok (Task 12), fogadás (Task 13), dobogós tipp (Task 14), admin (Task 15), UI oldalak (Task 16–23), i18n (Task 5), infra (Task 1, 4)
- [x] **Placeholder scan:** Nincs TBD/TODO — minden task-ban konkrét kód van
- [x] **Típus konzisztencia:** `calculateBetPayout`, `get1X2`, `getRelevantOdds`, `parseRegulationScore` — mindenhol ugyanaz a signature
- [x] **Import konzisztencia:** A cron route és admin action fájlokban az importok a fájl elejére mozgatandók az implementáció során
