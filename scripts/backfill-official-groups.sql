-- Backfill SQL for the official tournament group feature.
-- Idempotent — safe to run multiple times.
-- Run via Neon MCP run_sql or `psql` against the target DB.

-- 1. System user (owner of all official groups).
INSERT INTO users (email, google_id, name, is_admin, display_name)
VALUES (
  'system@tippcasino.local',
  'system',
  'TippCasino',
  true,
  'TippCasino'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Official group for every tournament that doesn't have one yet.
INSERT INTO groups (
  name, slug, invite_code, owner_id, tournament_id,
  token_per_match, initial_tokens,
  bonus_goal_diff, bonus_exact_score,
  bonus_podium_mention, bonus_podium_exact,
  odds_boost, is_public, is_official
)
SELECT
  'Hivatalos',
  'hivatalos',
  encode(gen_random_bytes(6), 'hex'),
  (SELECT id FROM users WHERE email = 'system@tippcasino.local'),
  t.id,
  100, 200, 5, 10, 20, 20, 1.1, true, true
FROM tournaments t
WHERE NOT EXISTS (
  SELECT 1 FROM groups g
  WHERE g.tournament_id = t.id AND g.is_official = true
);
