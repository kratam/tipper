import { Client } from "@upstash/qstash";

function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  return new Client({ token });
}

function getCallbackBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
