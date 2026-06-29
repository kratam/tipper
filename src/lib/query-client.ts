import { isServer, QueryClient } from "@tanstack/react-query";

// Közös default beállítások szerverre és kliensre.
// staleTime: 30s — a HydrationBoundary-vel prefetch-elt adat ne refetch-eljen
// azonnal a kliensen mount után (különben dupla fetch).
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// Szerveren mindig friss klienst adunk (kérés-izoláció); böngészőben singletont,
// hogy a HydrationBoundary ugyanabba a cache-be töltsön, amit a hookok olvasnak.
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
