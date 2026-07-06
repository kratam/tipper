import { createHash } from "node:crypto";

/**
 * Gravatar email-hash (SHA-256) — SZERVER OLDALI.
 *
 * A modern Gravatar API SHA-256-ot használ (az MD5 legacy). A nyers email SOHA nem
 * kerülhet a kliensre: a query-réteg ezzel számol egy `gravatarHash` mezőt, és csak
 * azt adja tovább. Ezért van külön fájlban a tiszta, kliens-safe `gravatar.ts`-től
 * (ez a `node:crypto`-t importálja, amit a kliens bundle nem húzhat be).
 */
export function gravatarHash(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}
