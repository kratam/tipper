import { auth } from "@/lib/auth/server";

const handlers = auth.handler();

// Rewrite cookies set by Neon Auth upstream so they work on Safari iOS.
// Upstream sets `SameSite=None; Partitioned`, which Safari ITP treats as
// third-party and strips on cross-site redirects (Google → Neon Auth → app).
// Our OAuth flow is top-level GET, so `SameSite=Lax` is universally supported
// and sufficient.
function withCookieFix<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const response = await handler(...args);
    const cookies = response.headers.getSetCookie();
    if (cookies.length === 0) return response;

    const newHeaders = new Headers(response.headers);
    newHeaders.delete("set-cookie");

    for (const cookie of cookies) {
      const fixed = cookie
        .replace(/;\s*Partitioned/i, "")
        .replace(/;\s*SameSite=None/i, "; SameSite=Lax");
      newHeaders.append("set-cookie", fixed);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

export const GET = withCookieFix(handlers.GET);
export const POST = withCookieFix(handlers.POST);
export const PUT = withCookieFix(handlers.PUT);
export const DELETE = withCookieFix(handlers.DELETE);
export const PATCH = withCookieFix(handlers.PATCH);
