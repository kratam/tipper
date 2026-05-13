import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";

// Direct read-only session fetch — avoids cookies().set() which Next.js prohibits
// in Server Components. The auth SDK internally caches sessions via Set-Cookie,
// causing "Cookies can only be modified in a Server Action or Route Handler".
async function fetchSession(): Promise<{
  user: { id: string; email: string; name?: string | null; image?: string | null };
} | null> {
  const headerStore = await headers();
  const cookieHeader = headerStore.get("cookie") ?? "";
  if (!cookieHeader.includes("neon-auth.session_token")) return null;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return null;

  const url = new URL("get-session", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();

  const response = await fetch(url, {
    headers: { Cookie: cookieHeader, "x-neon-auth-proxy": "nextjs" },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export const getCurrentUser = cache(async () => {
  try {
    // Dev-only impersonation bypass for E2E / smoke testing.
    // Looks up a user by email and skips the OAuth session check entirely.
    // Hard-gated to NODE_ENV !== "production" — Vercel env can't accidentally enable it.
    if (process.env.NODE_ENV !== "production" && process.env.DEV_IMPERSONATE_EMAIL) {
      const impersonated = await db.query.users.findFirst({
        where: eq(users.email, process.env.DEV_IMPERSONATE_EMAIL),
      });
      if (impersonated) return impersonated;
    }

    const session = await fetchSession();
    if (!session?.user) return null;

    const authUser = session.user;

    // Atomic upsert keyed on google_id (stable Neon Auth user ID).
    // Race-safe: concurrent first-login renders both UPDATE the same row instead
    // of the second one violating users_google_id_unique.
    const [user] = await db
      .insert(users)
      .values({
        googleId: authUser.id,
        email: authUser.email,
        name: authUser.name ?? authUser.email,
        avatarUrl: authUser.image ?? null,
      })
      .onConflictDoUpdate({
        target: users.googleId,
        set: {
          email: authUser.email,
          name: authUser.name ?? authUser.email,
          avatarUrl: authUser.image ?? null,
        },
      })
      .returning();

    return user;
  } catch (error) {
    console.error("[getCurrentUser] Error:", error);
    return null;
  }
});
