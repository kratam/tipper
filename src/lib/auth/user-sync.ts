import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "./server";

export async function getCurrentUser() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;

    const authUser = session.user;

    // Try to find by email first
    const existing = await db.query.users.findFirst({
      where: eq(users.email, authUser.email),
    });

    if (existing) return existing;

    // Try to find by googleId (neon auth user ID)
    const existingByGoogleId = await db.query.users.findFirst({
      where: eq(users.googleId, authUser.id),
    });

    if (existingByGoogleId) return existingByGoogleId;

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        googleId: authUser.id,
        email: authUser.email,
        name: authUser.name ?? authUser.email,
        avatarUrl: authUser.image ?? null,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: authUser.name ?? authUser.email,
          avatarUrl: authUser.image ?? null,
        },
      })
      .returning();

    return newUser;
  } catch (error) {
    console.error("[getCurrentUser] Error:", error);
    return null;
  }
}
