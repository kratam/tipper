import { apiSportsProvider } from "@/lib/providers/api-sports";
import { oddsApiProvider } from "@/lib/providers/odds-api";
import type { MatchProvider, ProviderId } from "@/lib/providers/types";

const registry: Record<ProviderId, MatchProvider> = {
  "api-sports": apiSportsProvider,
  "odds-api": oddsApiProvider,
};

export function getProvider(id: ProviderId): MatchProvider {
  const provider = registry[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export * from "@/lib/providers/types";
