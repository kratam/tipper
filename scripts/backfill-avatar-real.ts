#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Backfill: a users.avatar_is_real oszlop feltöltése a meglévő userekre.
//
// A Google generált monogram-avatarokat (kevés szín) elkülöníti a valódi
// feltöltött fotóktól (sok szín) — lásd src/lib/avatar-detect.ts. Login-kor a
// user-sync ugyanezt teszi automatikusan; ez a szkript a meglévő sorokra.
//
// Futtatás (a DATABASE_URL a cél branch-re mutasson):
//   node scripts/backfill-avatar-real.ts            # DRY-RUN (csak kiír, nem ír DB-t)
//   node scripts/backfill-avatar-real.ts --apply    # élesben frissít
// ─────────────────────────────────────────────────────────────────────────────
import { neon } from "@neondatabase/serverless";
import { detectAvatarIsReal } from "../src/lib/avatar-detect.ts";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const sql = neon(databaseUrl);

const rows = (await sql`
  SELECT id, COALESCE(display_name, name) AS name, avatar_url
  FROM users
  WHERE avatar_url IS NOT NULL
`) as Array<{ id: string; name: string; avatar_url: string }>;

console.log(`${rows.length} avataros user — mód: ${apply ? "APPLY" : "DRY-RUN"}\n`);

let real = 0;
let generated = 0;
let unknown = 0;

for (const u of rows) {
  const isReal = await detectAvatarIsReal(u.avatar_url);
  const label = isReal === null ? "??? (ismeretlen)" : isReal ? "FOTÓ" : "generált";
  console.log(`${label.padEnd(16)} ${u.name}`);
  if (isReal === null) unknown++;
  else if (isReal) real++;
  else generated++;

  if (apply && isReal !== null) {
    await sql`UPDATE users SET avatar_is_real = ${isReal} WHERE id = ${u.id}`;
  }
}

console.log(
  `\nÖsszes: ${rows.length} | valódi fotó: ${real} | generált: ${generated} | ismeretlen: ${unknown}`,
);
if (!apply) console.log("(DRY-RUN — semmit nem írtam. Éles: --apply)");
