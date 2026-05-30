import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { retryingFetch } from "@/lib/db-retry-fetch";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// Retry transient Neon control-plane failures (cold-start 500s flagged
// `neon:retryable`) — the HTTP driver does not retry on its own.
neonConfig.fetchFunction = retryingFetch;

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
