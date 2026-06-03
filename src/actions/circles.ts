"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, circles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { generateInviteCode, slugify } from "@/lib/utils";
import { getCircleByInviteCode } from "@/queries/circles";

/** Globálisan egyedi slug: ütközés esetén a (szintén egyedi) inviteCode-dal toldva. */
async function uniqueCircleSlug(name: string, inviteCode: string): Promise<string> {
  const base = slugify(name) || "kor";
  const existing = await db.query.circles.findFirst({
    where: eq(circles.slug, base),
    columns: { id: true },
  });
  return existing ? `${base}-${inviteCode.toLowerCase()}` : base;
}

export async function createCircle(name: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Circle name must be at least 2 characters");

  const inviteCode = generateInviteCode();
  const slug = await uniqueCircleSlug(trimmed, inviteCode);

  const [circle] = await db
    .insert(circles)
    .values({ name: trimmed, slug, inviteCode, ownerId: user.id })
    .returning();

  // Owner auto-tag. Nincs tokenkiosztás — a kör nem ír ledgert.
  await db.insert(circleMembers).values({ circleId: circle.id, userId: user.id });

  return circle;
}

export async function joinCircle(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const circle = await getCircleByInviteCode(inviteCode);
  if (!circle) throw new Error("Circle not found");

  const existing = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, user.id)),
  });
  if (existing) throw new Error("Already a member of this circle");

  await db.insert(circleMembers).values({ circleId: circle.id, userId: user.id });
  return circle;
}

export async function leaveCircle(circleId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await db
    .delete(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, user.id)));
}

export async function deleteCircle(circleId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    columns: { ownerId: true },
  });
  if (!circle) throw new Error("Circle not found");
  if (circle.ownerId !== user.id) throw new Error("Only the owner can delete the circle");

  // A tagsági sorokat előbb töröljük (FK), majd a kört.
  await db.delete(circleMembers).where(eq(circleMembers.circleId, circleId));
  await db.delete(circles).where(eq(circles.id, circleId));
}

export async function renameCircle(circleId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Circle name must be at least 2 characters");

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    columns: { ownerId: true },
  });
  if (!circle) throw new Error("Circle not found");
  if (circle.ownerId !== user.id) throw new Error("Only the owner can rename the circle");

  await db.update(circles).set({ name: trimmed }).where(eq(circles.id, circleId));
}
