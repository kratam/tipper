import { rewriteAuthCookies } from "@/lib/auth/cookie-fix";
import { auth } from "@/lib/auth/server";

const handlers = auth.handler();

function withCookieFix<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const response = await handler(...args);
    rewriteAuthCookies(response.headers);
    return response;
  };
}

export const GET = withCookieFix(handlers.GET);
export const POST = withCookieFix(handlers.POST);
export const PUT = withCookieFix(handlers.PUT);
export const DELETE = withCookieFix(handlers.DELETE);
export const PATCH = withCookieFix(handlers.PATCH);
