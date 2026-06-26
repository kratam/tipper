"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notificationRecipients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { createBroadcast } from "@/lib/notifications";
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  type NotificationItem,
} from "@/queries/notifications";

export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  return getUnreadCountForUser(user.id);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getNotificationsForUser(user.id, { limit: 20 });
}

export async function markRead(recipientId: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  await db
    .update(notificationRecipients)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, user.id),
        isNull(notificationRecipients.readAt),
      ),
    );
  return { success: true };
}

export async function markAllRead(): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  await db
    .update(notificationRecipients)
    .set({ readAt: new Date() })
    .where(and(eq(notificationRecipients.userId, user.id), isNull(notificationRecipients.readAt)));
  return { success: true };
}

export async function broadcastSystemNotification(input: {
  title: string;
  body: string;
  href?: string;
}): Promise<{ success: boolean; recipientCount?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };
  if (!user.isAdmin) return { success: false, error: "Unauthorized" };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { success: false, error: "Empty" };
  const href = input.href?.trim() || null;

  const { recipientCount } = await createBroadcast({ title, body, href });
  return { success: true, recipientCount };
}
