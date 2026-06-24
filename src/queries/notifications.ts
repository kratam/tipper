import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationObjects, notificationRecipients } from "@/db/schema";

export interface NotificationItem {
  recipientId: string;
  objectId: string;
  type: "system" | "badge";
  title: string | null;
  body: string | null;
  data: unknown;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Olvasatlan értesítések száma (a notification_user_read_idx fedi). */
export async function getUnreadCountForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationRecipients)
    .where(and(eq(notificationRecipients.userId, userId), isNull(notificationRecipients.readAt)));
  return row?.count ?? 0;
}

/** A user értesítései, legújabb elöl, lapozható (cursor a recipient createdAt-ra). */
export async function getNotificationsForUser(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<NotificationItem[]> {
  const where = opts.before
    ? and(
        eq(notificationRecipients.userId, userId),
        lt(notificationRecipients.createdAt, opts.before),
      )
    : eq(notificationRecipients.userId, userId);

  const rows = await db
    .select({
      recipientId: notificationRecipients.id,
      objectId: notificationObjects.id,
      type: notificationObjects.type,
      title: notificationObjects.title,
      body: notificationObjects.body,
      data: notificationObjects.data,
      href: notificationObjects.href,
      readAt: notificationRecipients.readAt,
      createdAt: notificationRecipients.createdAt,
    })
    .from(notificationRecipients)
    .innerJoin(
      notificationObjects,
      eq(notificationRecipients.notificationObjectId, notificationObjects.id),
    )
    .where(where)
    .orderBy(desc(notificationRecipients.createdAt))
    .limit(opts.limit ?? 20);

  return rows as NotificationItem[];
}
