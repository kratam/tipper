import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - / (landing page, public)
     * - /api/auth/* (auth endpoints)
     * - /join/* (public invite links)
     * - _next/static, _next/image, favicon.ico (static assets)
     */
    "/((?!$|api/auth|join|_next/static|_next/image|favicon.ico).*)",
  ],
};
