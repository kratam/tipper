-- Seed script: realistic match odds for dev/test environments
-- Idempotent: only inserts where no odds exist yet
-- Odds model: jégkorong csoportkör, bookmaker margin ~8%
--   - home_odds / away_odds: 1.20–6.50, csapatarány-alapú
--   - draw_odds: 4.00–7.50 (jégkorong-specifikus tartomány)
--   - Determinisztikus véletlenszerűség: hashtext(match_id) alapján

WITH team_ratings AS (
  SELECT name, rating FROM (VALUES
    ('Canada',          95),
    ('Sweden',          92),
    ('USA',             90),
    ('Finland',         88),
    ('Switzerland',     85),
    ('Germany',         82),
    ('Czech Republic',  80),
    ('Denmark',         78),
    ('Norway',          75),
    ('Slovakia',        73),
    ('Austria',         72),
    ('France',          68),
    ('Latvia',          65),
    ('Slovenia',        62),
    ('Hungary',         60),
    ('Great Britain',   58),
    ('Italy',           57),
    ('Kazakhstan',      55)
  ) t(name, rating)
),
match_data AS (
  SELECT
    m.id,
    COALESCE(hr.rating, 70)                          AS hr,
    COALESCE(ar.rating, 70)                          AS ar,
    -- determinisztikus "véletlen" 0.0–1.0 per meccs
    (abs(hashtext(m.id::text)) % 1000)::float / 1000.0 AS rnd
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
  LEFT JOIN team_ratings hr ON hr.name = ht.name
  LEFT JOIN team_ratings ar ON ar.name = at.name
  WHERE NOT EXISTS (
    SELECT 1 FROM match_odds o WHERE o.match_id = m.id
  )
),
computed AS (
  SELECT
    id,
    rnd,
    -- rating diff normalizálva -1..+1 (pozitív = hazai erősebb)
    LEAST(1.0, GREATEST(-1.0, (hr * 1.05 - ar) / 40.0)) AS diff
  FROM match_data
)
INSERT INTO match_odds (id, match_id, home_odds, draw_odds, away_odds, fetched_at)
SELECT
  gen_random_uuid(),
  id,
  -- home_odds
  ROUND(GREATEST(1.20, LEAST(6.50,
    CASE
      WHEN diff >= 0 THEN 1.20 + (1.0 - diff) * 2.80 + rnd * 0.40
      ELSE                2.50 + (-diff)        * 3.20 + rnd * 0.50
    END
  ))::numeric, 2),
  -- draw_odds: közel meccs → alacsonyabb draw odds
  ROUND(GREATEST(4.00, LEAST(7.50,
    5.50 - ABS(diff) * 1.20 + (rnd - 0.5) * 0.80
  ))::numeric, 2),
  -- away_odds (diff tükrözve)
  ROUND(GREATEST(1.20, LEAST(6.50,
    CASE
      WHEN diff <= 0 THEN 1.20 + (1.0 + diff) * 2.80 + rnd * 0.40
      ELSE                2.50 + diff          * 3.20 + rnd * 0.50
    END
  ))::numeric, 2),
  -- fetched_at: 5–175 perccel ezelőtt (változatos, de régebbi mint 3 óra)
  NOW() - ((abs(hashtext(id::text)) % 170 + 5) || ' minutes')::interval
FROM computed;
