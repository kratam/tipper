import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
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

export const providerEnum = pgEnum("provider", ["api-sports", "odds-api"]);

export const notificationTypeEnum = pgEnum("notification_type", ["system", "badge"]);

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
  provider: providerEnum("provider").default("api-sports").notNull(),
  apiLeagueId: integer("api_league_id"),
  apiSeason: integer("api_season"),
  providerSport: text("provider_sport"),
  providerLeagueSlug: text("provider_league_slug"),
  useFlagFallback: boolean("use_flag_fallback").default(false).notNull(),
  logoUrl: text("logo_url"),
  timezone: text("timezone").default("UTC").notNull(),
  status: tournamentStatusEnum("status").default("upcoming").notNull(),
  podiumLockDate: timestamp("podium_lock_date", { withTimezone: true }).notNull(),
  goldTeamId: uuid("gold_team_id").references(() => teams.id),
  silverTeamId: uuid("silver_team_id").references(() => teams.id),
  bronzeTeamId: uuid("bronze_team_id").references(() => teams.id),
  useScheduleOverrides: boolean("use_schedule_overrides").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  nextFinishCheckAt: timestamp("next_finish_check_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: providerEnum("provider").default("api-sports").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("teams_provider_external_idx").on(table.provider, table.externalId)],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id)
      .notNull(),
    externalId: text("external_id").notNull(),
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
  (table) => [
    index("matches_tournament_status_idx").on(table.tournamentId, table.status),
    uniqueIndex("matches_tournament_external_idx").on(table.tournamentId, table.externalId),
  ],
);

export const matchOdds = pgTable(
  "match_odds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    homeOdds: decimal("home_odds", { precision: 6, scale: 2 }).notNull(),
    drawOdds: decimal("draw_odds", { precision: 6, scale: 2 }).notNull(),
    awayOdds: decimal("away_odds", { precision: 6, scale: 2 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // "Latest odds per match" is read once per match on every tournament page
  // (ORDER BY fetched_at DESC LIMIT 1, filtered by match_id). Without this the
  // planner seq-scans match_odds for each match; the table grows unbounded as
  // the odds-fetch cron appends a new row per refresh.
  (table) => [index("match_odds_match_fetched_idx").on(table.matchId, table.fetchedAt)],
);

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
    bonusGoalDiffPct: real("bonus_goal_diff_pct").default(2).notNull(),
    bonusExactScorePct: real("bonus_exact_score_pct").default(3).notNull(),
    bonusPodiumMention: integer("bonus_podium_mention").default(20).notNull(),
    bonusPodiumExact: integer("bonus_podium_exact").default(20).notNull(),
    oddsBoost: real("odds_boost").default(1.0).notNull(),
    // DB default for new rows; rows created before migration 0014 were backfilled to 100.
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
  (table) => [
    uniqueIndex("bet_unique_idx").on(table.userId, table.matchId, table.groupId),
    // Scoring/refund/flip/odds-sync filter bets by matchId on every match-finish
    // cron, and the tournament/finished-bet reads filter via a matchId subquery.
    // matchId is the non-leading column of bet_unique_idx, so those scans can't
    // use it — add a dedicated index.
    index("bets_match_idx").on(table.matchId),
  ],
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
    // The token-distribution cron reads all per-match distributions for a
    // tournament in one query (WHERE tournament_id AND type='distribution').
    // token_ledger is the fastest-growing table (a row per user × match ×
    // event), so support that read directly.
    index("token_ledger_tournament_type_idx").on(table.tournamentId, table.type),
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

export const circles = pgTable(
  "circles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    inviteCode: text("invite_code").unique().notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id)
      .notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("circle_slug_idx").on(table.slug)],
);

export const circleMembers = pgTable(
  "circle_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    circleId: uuid("circle_id")
      .references(() => circles.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("circle_user_idx").on(table.circleId, table.userId)],
);

export const notificationObjects = pgTable("notification_objects", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  // system: literál admin-szöveg; badge: null (a data-ból renderelve)
  title: text("title"),
  body: text("body"),
  // badge: template-paraméterek ({ badgeKey, ... }); system: null
  data: jsonb("data"),
  href: text("href"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationObjectId: uuid("notification_object_id")
      .references(() => notificationObjects.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_object_user_idx").on(table.notificationObjectId, table.userId),
    index("notification_user_read_idx").on(table.userId, table.readAt),
  ],
);

export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    badgeKey: text("badge_key").notNull(),
    tier: integer("tier").notNull(), // 1=bronz, 2=ezüst, 3=arany
    count: integer("count").default(0).notNull(),
    bestValue: decimal("best_value", { precision: 8, scale: 2 }),
    firstEarnedAt: timestamp("first_earned_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_badge_idx").on(table.userId, table.badgeKey),
    index("user_badges_user_idx").on(table.userId),
  ],
);

export const userBadgeEvents = pgTable(
  "user_badge_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    badgeKey: text("badge_key").notNull(),
    eventKey: text("event_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_badge_event_idx").on(table.userId, table.badgeKey, table.eventKey)],
);

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

export const circlesRelations = relations(circles, ({ one, many }) => ({
  owner: one(users, { fields: [circles.ownerId], references: [users.id] }),
  members: many(circleMembers),
}));

export const circleMembersRelations = relations(circleMembers, ({ one }) => ({
  circle: one(circles, { fields: [circleMembers.circleId], references: [circles.id] }),
  user: one(users, { fields: [circleMembers.userId], references: [users.id] }),
}));

export const notificationObjectsRelations = relations(notificationObjects, ({ many }) => ({
  recipients: many(notificationRecipients),
}));

export const notificationRecipientsRelations = relations(notificationRecipients, ({ one }) => ({
  object: one(notificationObjects, {
    fields: [notificationRecipients.notificationObjectId],
    references: [notificationObjects.id],
  }),
  user: one(users, { fields: [notificationRecipients.userId], references: [users.id] }),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
}));
