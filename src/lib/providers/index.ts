import { apiSportsProvider } from "@/lib/providers/api-sports";
import type { MatchProvider, ProviderId } from "@/lib/providers/types";

const registry: Partial<Record<ProviderId, MatchProvider>> = { "api-sports": apiSportsProvider };

export function getProvider(id: ProviderId): MatchProvider {
  const provider = registry[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export * from "@/lib/providers/types";
