import { Client } from "@upstash/qstash";

function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  return new Client({ token });
}

/**
 * QStash callback URL. Must be a stable host: the deployment-specific
 * `VERCEL_URL` (e.g. `tipper-xxx.vercel.app`) becomes stale on the next deploy
 * and Vercel deployment protection returns 401 to external callers on it,
 * so QStash deliveries silently fail. Production must hit the project's
 * stable production domain; preview/local fall back to the deployment URL.
 */
export function getCallbackBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Schedule a match-finish check at a specific time.
 * QStash will POST to /api/cron/match-finish after the delay.
 */
export async function scheduleMatchFinishCheck(delaySeconds: number): Promise<void> {
  const qstash = getQStashClient();
  const baseUrl = getCallbackBaseUrl();

  await qstash.publishJSON({
    url: `${baseUrl}/api/cron/match-finish`,
    body: { trigger: "scheduled" },
    delay: delaySeconds,
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
}
