"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import type { Locale } from "@/lib/providers/types";
import { getProfileTournamentBets, type ProfileBetRow } from "@/queries/profile";

const MAX_DISPLAY_NAME_LENGTH = 30;

/**
 * A profil tét-táblázat lazy-load lépése: egy lezárt torna official + befejezett
 * tét-sorait tölti kinyitáskor. A láthatóságot a query ellenőrzi (közös official
 * Ranglista / kör); jogosulatlan nézőnek üres tömböt adunk (nem szivárgunk).
 */
export async function loadProfileTournamentBets(
  userId: string,
  tournamentId: string,
): Promise<ProfileBetRow[]> {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return [];
  const rows = await getProfileTournamentBets(userId, tournamentId, user.id, locale as Locale);
  return rows ?? [];
}

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
