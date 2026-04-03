import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "./server";

export async function getCurrentUser() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return null;

  const authUser = session.user;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, authUser.email),
  });

  if (existing) return existing;

  const [newUser] = await db
    .insert(users)
    .values({
      googleId: authUser.id,
      email: authUser.email,
      name: authUser.name ?? authUser.email,
      avatarUrl: authUser.image ?? null,
    })
    .returning();

  return newUser;
}
