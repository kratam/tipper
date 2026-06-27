import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { userBadgeEvents, userBadges } from "@/db/schema";
import type { BadgeProgress, StoredBadge } from "@/lib/badges/evaluate";

export async function loadUserBadges(userId: string): Promise<Map<string, StoredBadge>> {
  const rows = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  return new Map(
    rows.map((r) => [
      r.badgeKey,
      { tier: r.tier, count: r.count, bestValue: r.bestValue ? Number(r.bestValue) : null },
    ]),
  );
}

export async function upsertUserBadge(userId: string, p: BadgeProgress): Promise<void> {
  await db
    .insert(userBadges)
    .values({
      userId,
      badgeKey: p.badgeKey,
      tier: p.tier,
      count: p.count,
      bestValue: p.bestValue === null ? null : String(p.bestValue),
    })
    .onConflictDoUpdate({
      target: [userBadges.userId, userBadges.badgeKey],
      set: {
        tier: p.tier,
        count: p.count,
        bestValue: p.bestValue === null ? null : String(p.bestValue),
        updatedAt: new Date(),
      },
    });
}

export async function recordBadgeEvent(
  userId: string,
  badgeKey: string,
  eventKey: string,
): Promise<boolean> {
  const inserted = await db
    .insert(userBadgeEvents)
    .values({ userId, badgeKey, eventKey })
    .onConflictDoNothing()
    .returning({ id: userBadgeEvents.id });
  return inserted.length > 0;
}

export async function countBadgeEvents(userId: string, badgeKey: string): Promise<number> {
  const rows = await db
    .select({ id: userBadgeEvents.id })
    .from(userBadgeEvents)
    .where(and(eq(userBadgeEvents.userId, userId), eq(userBadgeEvents.badgeKey, badgeKey)));
  return rows.length;
}

export async function loadBadgesForUsers(
  userIds: string[],
): Promise<Map<string, Array<StoredBadge & { badgeKey: string }>>> {
  const result = new Map<string, Array<StoredBadge & { badgeKey: string }>>();
  if (userIds.length === 0) return result;
  const rows = await db.select().from(userBadges).where(inArray(userBadges.userId, userIds));
  for (const r of rows) {
    const arr = result.get(r.userId) ?? [];
    arr.push({
      badgeKey: r.badgeKey,
      tier: r.tier,
      count: r.count,
      bestValue: r.bestValue ? Number(r.bestValue) : null,
    });
    result.set(r.userId, arr);
  }
  return result;
}
