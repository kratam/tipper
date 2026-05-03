import { and, eq } from "drizzle-orm";
import { groupMembers, groups, users } from "@/db/schema";
import { distributeInitialTokens } from "@/lib/tokens";
import { generateInviteCode } from "@/lib/utils";

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

/**
 * Create the official group for a tournament. Idempotent — if one already
 * exists for this tournament, returns it. The system user is the owner but
 * NOT inserted into group_members (so it doesn't appear as a member).
 */
export async function createOfficialGroup(tournamentId: string) {
  const { db } = await import("@/db");

  const existing = await db.query.groups.findFirst({
    where: and(eq(groups.tournamentId, tournamentId), eq(groups.isOfficial, true)),
  });
  if (existing) return existing;

  const ownerId = await getSystemUserId();

  const [created] = await db
    .insert(groups)
    .values({
      name: OFFICIAL_GROUP_NAME,
      slug: OFFICIAL_GROUP_SLUG,
      inviteCode: generateInviteCode(),
      ownerId,
      tournamentId,
      tokenPerMatch: 100,
      initialTokens: 200,
      bonusGoalDiff: 5,
      bonusExactScore: 10,
      bonusPodiumMention: 20,
      bonusPodiumExact: 20,
      oddsBoost: 1.1,
      isPublic: true,
      isOfficial: true,
    })
    .returning();

  return created;
}

/**
 * Idempotent lazy auto-join. If the user is already a member of the
 * tournament's official group → no-op. Otherwise: insert membership and
 * distribute initial + catch-up tokens.
 *
 * Safe to call on every page view. If the official group doesn't exist
 * yet (admin hasn't created the tournament via the new flow), this
 * creates it on demand.
 */
export async function ensureOfficialMembership(
  userId: string,
  tournamentId: string,
): Promise<void> {
  const officialGroup = await createOfficialGroup(tournamentId);

  const { db } = await import("@/db");

  const existingMembership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, officialGroup.id), eq(groupMembers.userId, userId)),
  });
  if (existingMembership) return;

  await db.insert(groupMembers).values({
    groupId: officialGroup.id,
    userId,
  });

  await distributeInitialTokens(
    userId,
    officialGroup.id,
    tournamentId,
    officialGroup.initialTokens,
    officialGroup.tokenPerMatch,
  );
}
