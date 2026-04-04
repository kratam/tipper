# SWR Live Polling Design

**Dátum:** 2026-04-04
**Státusz:** Elfogadva

## Cél

SWR-alapú live polling a tournament meccsek score/status frissítéséhez és a csoport leaderboard real-time frissítéséhez, hogy a felhasználóknak ne kelljen manuálisan refreshelniük az oldalt.

## Megközelítés

**SWR + Server Actions** — nincs új API route, a meglévő `"server-only"` query-ket Server Action-ökbe csomagoljuk. Az auth automatikusan működik (cookie forwarding).

## Scope

### Ami pollinggal frissül
- **Meccs score + status** (homeScore, awayScore, status)
- **User bet eredmények** (result1x2Correct, goalDiffCorrect, exactScoreCorrect, payout)
- **Csoport leaderboard** (balance, rank)

### Ami NEM változik
- Server Component initial page load (SEO, first paint)
- `router.refresh()` mutációk után (bet placement, settings save)
- Cron sync logika
- Statikus meccs adatok (csapatnevek, odds, scheduledAt) — ezek a props-ból jönnek

## Polling intervallumok

| Feltétel | Meccs polling | Leaderboard polling |
|----------|--------------|---------------------|
| Van élő meccs | 2 perc | — |
| Ma van/volt meccs, de nincs élő | 5 perc | — |
| Nincs mai meccs | OFF (csak focus revalidate) | — |
| Tournament aktív | — | 5 perc |
| Tournament nem aktív | — | OFF |

Minden esetben: `revalidateOnFocus: true` — tab-ra váltáskor frissít.

## Komponensek

### 1. `src/actions/live.ts` — Server Actions

**`getLiveMatchData(tournamentId: string)`**
- Lekéri az összes meccs score/status/bet result adatát az adott tournament-hez
- A `getCurrentUser()` biztosítja az auth-ot
- Visszaad: `{ matchId, homeScore, awayScore, status, userBets[] }[]`

**`getLiveLeaderboard(groupId: string)`**
- Lekéri a leaderboard balance/rank adatokat
- Visszaad: `{ userId, balance, rank }[]`

### 2. `src/hooks/use-match-polling.ts`

- SWR hook ami a `getLiveMatchData` action-t hívja
- Dinamikus `refreshInterval` a meccsek állapota alapján
- `null` SWR key ha nincs szükség pollingra (SWR ilyenkor nem fetch-el)

### 3. `src/hooks/use-leaderboard-polling.ts`

- SWR hook ami a `getLiveLeaderboard` action-t hívja
- 5 perces interval ha a tournament aktív

### 4. SWRConfig provider

`src/components/swr-provider.tsx` — client component wrapper:
- `dedupingInterval: 30_000`
- `errorRetryCount: 3`
- Bekerül a locale layout-ba

### 5. Integráció

**`tournament-tabs.tsx`:**
- `useMatchPolling` hook hozzáadása
- `useMemo` merge: alap a props, felülírva SWR adataival

**`group-detail-tabs.tsx`:**
- `useLeaderboardPolling` hook hozzáadása
- Balance/rank frissítése SWR-ből, név/avatar marad props-ból

## Adatfolyam

```
Initial load:  Server Component → DB query → props → Client Component
Polling:       SWR → Server Action → DB query → merge with props
Mutation:      Server Action → DB write → router.refresh() → full re-render
```

## Dependency

`swr` (~4KB gzipped) — egyetlen új dependency.
