import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Enums
export const tournamentStatusEnum = pgEnum("tournament_status", ["upcoming", "active", "finished"]);

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
  displayName: text("display_name"),
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
  logoUrl: text("logo_url"),
  timezone: text("timezone").default("UTC").notNull(),
  status: tournamentStatusEnum("status").default("upcoming").notNull(),
  podiumLockDate: timestamp("podium_lock_date", { withTimezone: true }).notNull(),
  goldTeamId: uuid("gold_team_id").references(() => teams.id),
  silverTeamId: uuid("silver_team_id").references(() => teams.id),
  bronzeTeamId: uuid("bronze_team_id").references(() => teams.id),
  useScheduleOverrides: boolean("use_schedule_overrides").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiTeamId: integer("api_team_id").unique().notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id)
      .notNull(),
    apiGameId: integer("api_game_id").unique().notNull(),
    homeTeamId: uuid("home_team_id")
      .references(() => teams.id)
      .notNull(),
    awayTeamId: uuid("away_team_id")
      .references(() => teams.id)
      .notNull(),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    status: matchStatusEnum("status").default("scheduled").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    round: text("round").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("matches_tournament_status_idx").on(table.tournamentId, table.status)],
);

export const matchOdds = pgTable("match_odds", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  homeOdds: decimal("home_odds", { precision: 6, scale: 2 }).notNull(),
  drawOdds: decimal("draw_odds", { precision: 6, scale: 2 }).notNull(),
  awayOdds: decimal("away_odds", { precision: 6, scale: 2 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    inviteCode: text("invite_code").unique().notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id)
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id)
      .notNull(),
    tokenPerMatch: integer("token_per_match").default(100).notNull(),
    initialTokens: integer("initial_tokens").default(200).notNull(),
    bonusGoalDiff: integer("bonus_goal_diff").default(5).notNull(),
    bonusExactScore: integer("bonus_exact_score").default(10).notNull(),
    bonusPodiumMention: integer("bonus_podium_mention").default(20).notNull(),
    bonusPodiumExact: integer("bonus_podium_exact").default(20).notNull(),
    oddsBoost: real("odds_boost").default(1.0).notNull(),
    lossPercentage: integer("loss_percentage").default(90).notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    isOfficial: boolean("is_official").default(false).notNull(),
  },
  (table) => [uniqueIndex("group_tournament_slug_idx").on(table.tournamentId, table.slug)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("group_user_idx").on(table.groupId, table.userId)],
);

export const bets = pgTable(
  "bets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
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
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id)
      .notNull(),
    goldTeamId: uuid("gold_team_id")
      .references(() => teams.id)
      .notNull(),
    silverTeamId: uuid("silver_team_id")
      .references(() => teams.id)
      .notNull(),
    bronzeTeamId: uuid("bronze_team_id")
      .references(() => teams.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("podium_unique_idx").on(table.userId, table.tournamentId)],
);

export const tokenLedger = pgTable(
  "token_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id)
      .notNull(),
    amount: integer("amount").notNull(),
    type: tokenTypeEnum("type").notNull(),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("token_ledger_user_group_type_idx").on(table.userId, table.groupId, table.type),
  ],
);

export const matchScheduleOverrides = pgTable("match_schedule_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .unique()
    .notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
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

export const matchOddsRelations = relations(matchOdds, ({ one }) => ({
  match: one(matches, { fields: [matchOdds.matchId], references: [matches.id] }),
}));

export const betsRelations = relations(bets, ({ one }) => ({
  user: one(users, { fields: [bets.userId], references: [users.id] }),
  match: one(matches, { fields: [bets.matchId], references: [matches.id] }),
  group: one(groups, { fields: [bets.groupId], references: [groups.id] }),
}));

export const matchScheduleOverridesRelations = relations(matchScheduleOverrides, ({ one }) => ({
  match: one(matches, {
    fields: [matchScheduleOverrides.matchId],
    references: [matches.id],
  }),
}));
