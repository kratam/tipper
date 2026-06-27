import "server-only";
import { db } from "@/db";
import { notificationObjects, notificationRecipients, users } from "@/db/schema";

export interface BadgeIncrement {
  badgeKey: string;
  tier: number;
  count: number;
  bestValue: number | null;
  change: "new" | "upgraded";
}

/**
 * Badge-értesítés(ek) létrehozása egy usernek.
 * Üres tömb → no-op; 1 elem → egyedi badge értesítés; >1 → aggregált.
 */
export async function createBadgeNotifications(
  userId: string,
  increments: BadgeIncrement[],
): Promise<void> {
  if (increments.length === 0) return;

  if (increments.length === 1) {
    const { badgeKey, tier, count, bestValue } = increments[0];
    await createNotificationForUser({
      userId,
      type: "badge",
      data: { badgeKey, tier, count, bestValue },
      href: `/u/${userId}`,
    });
    return;
  }

  await createNotificationForUser({
    userId,
    type: "badge",
    data: { aggregate: true, count: increments.length },
    href: `/u/${userId}`,
  });
}

/** Egy értesítés egy usernek (1 object + 1 recipient). A Phase 2 cron hívja badge-re. */
export async function createNotificationForUser(params: {
  userId: string;
  type: "system" | "badge";
  title?: string | null;
  body?: string | null;
  data?: unknown;
  href?: string | null;
}): Promise<void> {
  const [obj] = await db
    .insert(notificationObjects)
    .values({
      type: params.type,
      title: params.title ?? null,
      body: params.body ?? null,
      data: params.data ?? null,
      href: params.href ?? null,
    })
    .returning({ id: notificationObjects.id });

  await db.insert(notificationRecipients).values({
    notificationObjectId: obj.id,
    userId: params.userId,
  });
}

/**
 * Egy system-üzenet MINDEN usernek: 1 object + N vékony recipient sor.
 * A user-szám a baráti léptékben kicsi, ezért sima bulk insert (nincs szükség INSERT...SELECT-re).
 */
export async function createBroadcast(params: {
  title: string;
  body: string;
  href?: string | null;
}): Promise<{ recipientCount: number }> {
  const [obj] = await db
    .insert(notificationObjects)
    .values({ type: "system", title: params.title, body: params.body, href: params.href ?? null })
    .returning({ id: notificationObjects.id });

  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length > 0) {
    await db
      .insert(notificationRecipients)
      .values(allUsers.map((u) => ({ notificationObjectId: obj.id, userId: u.id })));
  }
  return { recipientCount: allUsers.length };
}
