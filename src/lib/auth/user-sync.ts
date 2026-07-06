import "server-only";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { detectAvatarIsReal } from "@/lib/avatar-detect";

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
          // Ha a Google-kép URL-je változott, a valódiság-flag elavul → újra kell
          // detektálni (null), különben megtartjuk a korábbi eredményt.
          avatarIsReal: sql`CASE WHEN ${users.avatarUrl} IS DISTINCT FROM ${authUser.image ?? null} THEN NULL ELSE ${users.avatarIsReal} END`,
        },
      })
      .returning();

    // Ha még nincs eldöntve, hogy a Google-kép valódi fotó vagy generált monogram,
    // a válasz ELKÜLDÉSE UTÁN (after) detektáljuk — nem lassítja a rendert. Amint
    // beáll a flag, a következő login már nem futtatja újra.
    if (user.avatarUrl && user.avatarIsReal === null) {
      const { id, avatarUrl } = user;
      after(async () => {
        const isReal = await detectAvatarIsReal(avatarUrl);
        if (isReal !== null) {
          await db.update(users).set({ avatarIsReal: isReal }).where(eq(users.id, id));
        }
      });
    }

    return user;
  } catch (error) {
    console.error("[getCurrentUser] Error:", error);
    return null;
  }
});
