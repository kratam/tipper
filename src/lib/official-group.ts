import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

export const SYSTEM_USER_EMAIL = "system@tippcasino.local";

export const OFFICIAL_GROUP_NAME = "Hivatalos";
export const OFFICIAL_GROUP_SLUG = "hivatalos";

export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official"] as const;

export function isReservedOfficialSlug(slug: string): boolean {
  return (RESERVED_OFFICIAL_SLUGS as readonly string[]).includes(slug);
}

let cachedSystemUserId: string | null = null;

export async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;

  // Lazy import: top-level `import { db }` would throw at module load
  // when DATABASE_URL is unset (e.g. in vitest). Importing inside the
  // function lets the constants + slug helpers be unit-testable without
  // a database connection.
  const { db } = await import("@/db");

  const row = await db.query.users.findFirst({
    where: eq(users.email, SYSTEM_USER_EMAIL),
  });

  if (!row) {
    throw new Error(
      `System user not found (email=${SYSTEM_USER_EMAIL}). ` +
        "Run scripts/backfill-official-groups.sql first.",
    );
  }

  cachedSystemUserId = row.id;
  return row.id;
}
