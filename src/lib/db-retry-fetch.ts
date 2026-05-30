/**
 * Retrying `fetch` for the Neon serverless HTTP driver.
 *
 * The `@neondatabase/serverless` HTTP driver issues a single one-shot POST per
 * query and does not retry. When a scale-to-zero compute is woken (cold start),
 * Neon's control plane occasionally fails transiently with HTTP 500
 * `Control plane request failed` and flags it `"neon:retryable": true`.
 * Without a retry the transient hiccup surfaces as a user-facing 500.
 *
 * Wired in via `neonConfig.fetchFunction` (see `src/db/index.ts`) so every query
 * routes through it. A control-plane failure means the query never reached the
 * database, so retrying is safe for writes too — and Neon itself marks it
 * retryable.
 */

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 150;

function isRetryableBody(body: string): boolean {
  return body.includes('"neon:retryable":true') || body.includes('"neon:retryable": true');
}

function backoffMs(attempt: number): number {
  // attempt 1 → ~150ms, 2 → ~300ms, 3 → ~600ms, plus up to BASE_DELAY_MS jitter.
  const base = BASE_DELAY_MS * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * BASE_DELAY_MS);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryingFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(input, init);

      // Happy path: leave the body stream untouched for the driver to parse.
      if (response.status < 500) return response;

      // 5xx: inspect the body for Neon's retryable flag. Reading consumes the
      // stream, so reconstruct an equivalent Response when we hand it back.
      const bodyText = await response.text();
      const passThrough = (): Response =>
        new Response(bodyText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

      if (attempt >= MAX_ATTEMPTS || !isRetryableBody(bodyText)) {
        return passThrough();
      }

      console.warn(
        `[db] Neon retryable ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`,
      );
    } catch (error) {
      // Network-level failure (fetch threw) — also worth retrying.
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`[db] fetch error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`);
    }

    await sleep(backoffMs(attempt));
  }

  // Loop only falls through here after a final retryable 5xx (handled above) or
  // an exhausted error path; keep a defensive throw to satisfy the return type.
  throw lastError ?? new Error("retryingFetch: exhausted attempts without a response");
}
