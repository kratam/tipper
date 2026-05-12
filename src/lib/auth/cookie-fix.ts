// Neon Auth upstream sets cookies with `SameSite=None; Partitioned`, which
// Safari iOS (and Chrome iOS via WKWebView) treats as third-party and strips
// on cross-site redirects (Google → Neon Auth → app). Our OAuth flow is
// top-level GET, so `SameSite=Lax` is universally compatible and sufficient.
//
// Used by both the auth route handler and the OAuth-callback path in middleware.
export function rewriteAuthCookies(headers: Headers): void {
  const cookies = headers.getSetCookie();
  if (cookies.length === 0) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const fixed = cookie
      .replace(/;\s*Partitioned/i, "")
      .replace(/;\s*SameSite=None/i, "; SameSite=Lax");
    headers.append("set-cookie", fixed);
  }
}
