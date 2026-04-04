"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";

const MAX_DISPLAY_NAME_LENGTH = 30;

export async function updateDisplayName(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const raw = formData.get("displayName");
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return { success: false, error: "Too long" };
  }

  const displayName = trimmed.length > 0 ? trimmed : null;

  await db.update(users).set({ displayName }).where(eq(users.id, user.id));

  return { success: true };
}
