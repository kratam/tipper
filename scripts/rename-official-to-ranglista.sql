-- One-shot data migration: rename existing official groups from 'Hivatalos' to 'Ranglista'.
-- Run once per environment (dev + production) via Neon SQL editor or psql.
-- Idempotent: only updates rows that still have the old name.
UPDATE groups
SET name = 'Ranglista'
WHERE is_official = true
  AND name = 'Hivatalos';
