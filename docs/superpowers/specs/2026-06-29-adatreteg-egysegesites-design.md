# Adatréteg egységesítés — TanStack Query alapú élő-adat réteg

**Dátum:** 2026-06-29
**Státusz:** Spec (jóváhagyásra vár)
**Érintett terület:** kliens-oldali adat-fetch, frissítés, cache-invalidation

---

## 1. Háttér és probléma

A rendszerben három, egymással össze nem hangolt adat-frissítési mechanizmus él párhuzamosan:

1. **SSR + `router.refresh()`** — felhasználói mutációk után (tippadás, settings, admin). Minden oldal **dinamikus** (a `getCurrentUser()` `await headers()`-t hív → nincs ISR), tehát betöltéskor friss SSR-t kap. De a `router.refresh()` **csak felhasználói mutáció után** fut, soha nem meccs-eredmény-változásra.
2. **SWR polling** — komponensenként **ad-hoc** bekötve: `useMatchPolling` (MatchCard), `useLeaderboardPolling` (leaderboard), `NotificationBell` (60s). Sok felület egyáltalán nincs bekötve.
3. **Cron / QStash** — szerver-oldali adat-szinkron (meccs-eredmény, `scoreMatch`, token-osztás). **Semmilyen jelzést nem küld a klienseknek.**

### Megfigyelt tünet

Egy meccs végén az eredmény bekerül a DB-be. Az alsó **MatchCard** 1–2 percen belül lepollozza (`useMatchPolling`), de a felső **TipMatrix** nem frissül.

### Verifikált gyökér-ok

- A TipMatrix a round-adatot egy **kliens-oldali `useState`-cache-be zárja** (`tip-matrix.tsx:153`), és **semmi nem pollozza** élőben. Csak (a) saját tipp-mutáció után, vagy (b) ha `router.refresh()` új `initialRound` propot ad, frissül.
- Ugyanaz a meccs-eredmény **két külön action-úton** jut a UI-ba: `getLiveMatchData` (MatchCard) és `getTipMatrixRound` (TipMatrix). Csak az egyik pollozik → strukturálisan garantált, hogy széttartanak.
- A `router.refresh()` + ad-hoc `onBetMutated` callback szórás miatt egy tippadás nem garantáltan frissít **minden** felületet, ahol a tipp megjelenik.

A duplikált *számítás* nincs jelen (a `scoreMatch`/payout/leaderboard logika singleton); a baj a duplikált **adat-útvonal** és a **komponensenként ad-hoc, hiányos frissítés**.

---

## 2. Célok és nem-célok

### Célok

1. **Egy igazságforrás** minden idővel változó adatra (meccs-státusz/score, tippek+payout, leaderboard, token-egyenleg, notification). Két nézet sosem lát eltérő értéket ugyanarra az adatra.
2. **Cross-surface konzisztencia mutáció után:** ha a felhasználó tippel egy felületen, minden más felület, ahol az a tipp/egyenleg/leaderboard megjelenik, automatikusan frissül — egyetlen, deklaratív invalidáció révén.
3. **Egységes élő-frissülés:** a meccs vége környékén minden élő felület magától frissül (≤ ~1 perc késleltetés elfogadható; nincs élő score, mert az odds-api nem adja).
4. **Egységes, fegyelmezett mechanizmus** a jelenlegi komponensenként ad-hoc minták helyett — egy helyen definiált query-kulcsok és invalidation.

### Nem-célok

- **Real-time push (SSE/WebSocket):** explicit kizárva — 1 perces késleltetés belefér, és Vercel serverless alatt aránytalan infra.
- **Élő, meccs-közbeni score:** az odds-api nem támogatja; a polling célja a meccs **vége** környéki frissülés.
- **GraphQL:** elvetve — aránytalan komplexitás (új API-réteg, schema, resolverek) egy 1-fős projektben; a valódi probléma nem a query-flexibilitás.

---

## 3. A választott architektúra

**TanStack Query** mint egységes kliens-oldali adat-réteg, az SWR teljes kivezetésével. Ezt egészíti ki egy **snapshot-orientált adatmodell** (egy meccs-státusz/score igazságforrás, több nézet) és egy **központi query-kulcs registry + invalidation-réteg**.

Miért TanStack az SWR helyett:
- A cross-surface invalidation (2. cél) a TanStack `invalidateQueries({ queryKey })` prefix-alapú modelljével **natívan, deklaratívan** megoldható; SWR-rel ezt kézzel kellene építeni (kulcs-registry + `mutate`-helper).
- Hierarchikus query-kulcsok → egy mutáció prefix-szel egyszerre több kapcsolódó nézetet invalidál.
- Beépített devtools, optimista frissítés, retry/staleness-kezelés.
- Az RSC-hydration megoldott minta (`HydrationBoundary` + szerver-oldali prefetch).

Réteg-elhatárolás (fontos: ezek **nem** alternatívái egymásnak):

| Réteg | Felelősség | Eszköz |
|---|---|---|
| Kliens-oldali fetch/cache/invalidation | élő frissülés, refetch, cross-surface invalidation | **TanStack Query** |
| Szerver-oldali data cache (opcionális, 5. fázis) | drága DB-aggregációk cache-elése + tag-invalidáció | `"use cache"` + `revalidateTag` (Next 16 stabil; **nem** `unstable_cache`) |

---

## 4. Domének és query-kulcs registry

Egyetlen kulcs-factory fájl: `src/lib/live/query-keys.ts`. Vége a szétszórt `["live-matches", id]` ad-hoc kulcsoknak.

```ts
export const liveKeys = {
  tournament: (tid: string) => ["tournament", tid] as const,
  matches:    (tid: string) => ["tournament", tid, "matches"] as const,

  group:       (gid: string) => ["group", gid] as const,
  leaderboard: (gid: string) => ["group", gid, "leaderboard"] as const,
  balance:     (gid: string) => ["group", gid, "balance"] as const,
  tipMatrix:   (gid: string, roundKey: string) => ["group", gid, "tipMatrix", roundKey] as const,

  notifications: {
    unread: () => ["notifications", "unread"] as const,
    list:   () => ["notifications", "list"] as const,
  },
} as const;
```

**Egy meccs-státusz/score igazságforrás:** a meccs-eredmény (score, status) és a néző tippjeinek payout-ja kizárólag a `matches(tid)` kulcs alatt él. **Mind** a MatchCard, **mind** a TipMatrix innen olvassa a score/status/payout értékeket. A `tipMatrix(gid, roundKey)` kulcs csak a tipp-rács *szerkezetét* adja (ki melyik meccsre mit tippelt) — a változó score/payout a közös `matches` kulcsból jön. Így a két nézet nem tud széttartani.

---

## 5. Adatforrások konszolidálása

A jelenlegi átfedő actionöket koherens, domain-szintű fetcherekbe vonjuk:

| Jelenlegi | Új |
|---|---|
| `getLiveMatchData(tid)` | `fetchMatchesSnapshot(tid)` — score, status, néző tippjei+payout. A `matches` kulcs fetchere. |
| `getTipMatrixRound(...)` / `getTipMatrixRoundAction(...)` | `fetchTipMatrixRound(gid, roundKey)` — csak a rács szerkezete; score/payout a `matches` snapshotból. |
| `getLiveLeaderboard(gid)` | `fetchLeaderboard(gid)` — a `leaderboard` kulcs fetchere. |
| `getProjectedBalance` / `getBatchProjectedBalances` | `fetchBalance(gid)` — a `balance` kulcs fetchere. |
| `getUnreadCount` / `getNotifications` | változatlan logika, TanStack fetcherként. |

A server actionök maguk maradnak `"use server"` + `getCurrentUser()` ellenőrzéssel; csak a kliens-oldali fogyasztásuk egységesül. A redundáns score-derivációt (a `mergeMatchData` a `use-match-polling.ts`-ben) kiváltja az, hogy a TipMatrix és MatchCard ugyanazt a `matches` query-t olvassa.

---

## 6. SSR → hydration minta

Cél a `HydrationBoundary` minta: a Server Component oldal létrehoz egy `QueryClient`-et, `prefetchQuery`-vel betölti a kezdő-adatot a már meglévő query-függvényekből, és `dehydrate`-eli a kliensnek. Nincs villanás, nincs dupla fetch.

```tsx
// page.tsx (Server Component)
const qc = new QueryClient();
await Promise.all([
  qc.prefetchQuery({ queryKey: liveKeys.matches(tid), queryFn: () => fetchMatchesSnapshot(tid) }),
  qc.prefetchQuery({ queryKey: liveKeys.leaderboard(gid), queryFn: () => fetchLeaderboard(gid) }),
  // ...
]);
return <HydrationBoundary state={dehydrate(qc)}><GroupDetailTabs .../></HydrationBoundary>;
```

**Átmeneti megengedés:** ahol a HydrationBoundary-re átállás egy lépésben kockázatos, a meglévő SSR-propot a `useQuery({ initialData })`-ba adjuk kezdőértékként. Cél a HydrationBoundary, de a fázisos átállás megengedi az `initialData`-hidat.

---

## 7. Komponens-bekötés

Szeletelő hookok (`src/hooks/live/`), mind a megfelelő query-kulcsból olvasnak:

- `useMatches(tid)` → MatchCard, és a TipMatrix score/payout rétege
- `useTipMatrixRound(gid, roundKey)` → TipMatrix rács-szerkezet
- `useLeaderboard(gid)` → leaderboard listák
- `useBalance(gid)` → token-egyenleg kijelzők, bet-form
- `useNotifications()` / `useUnreadCount()` → NotificationBell

Átírandó komponensek:
- `tip-matrix.tsx` — a `useState`-cache (`cache`/`setCache`, a `initialRound`-beolvasztó `useEffect`, a `refreshCurrentRound`) **megszűnik**; helyette `useTipMatrixRound` + `useMatches`.
- `match-card.tsx` / `tournament-tabs.tsx` — `useMatchPolling` helyett `useMatches`.
- `group-detail-tabs.tsx` / `tournament-board-panel.tsx` — a TipMatrix és leaderboard a hookokból táplálkozik.
- `notification-bell.tsx` — SWR helyett `useNotifications`/`useUnreadCount`.
- `bet-form.tsx` / `bet-dialog.tsx` — `onBetMutated` + `router.refresh()` helyett központi invalidation (8. szakasz).

Kivezetendő: `use-match-polling.ts`, `use-leaderboard-polling.ts`, `swr-provider.tsx`, `swr` dependency.

---

## 8. Mutáció → invalidation térkép (2. cél)

Központi helper: `src/lib/live/invalidate.ts`.

```ts
export function invalidateAfterBet(qc: QueryClient, ctx: { tournamentId: string; groupId: string }) {
  qc.invalidateQueries({ queryKey: liveKeys.matches(ctx.tournamentId) }); // tippek+payout minden meccs-nézeten
  qc.invalidateQueries({ queryKey: liveKeys.group(ctx.groupId) });        // tipMatrix + leaderboard + balance egyszerre
}
```

| Mutáció | Invalidált kulcsok |
|---|---|
| `placeBet` / `cancelBet` | `matches(tid)` + `group(gid)` prefix (→ tipMatrix, leaderboard, balance) |
| `placePodiumBet` | `group(gid)` |
| `updateGroupSettings` (pl. oddsBoost) | `group(gid)` |
| `markRead` / `markAllRead` | `notifications` prefix |
| admin sync / tornament-mutációk | `tournament(tid)` prefix |

Egyetlen `invalidateAfterBet` hívás a tippadás után frissít minden felületet, ahol a tipp megjelenik — kiváltja az ad-hoc `onBetMutated` + `router.refresh()` szórást.

**Opcionális finomítás (külön, nem az alap-scope):** optimista frissítés a tippadásra (`onMutate` → cache-patch → rollback hibára), hogy a saját tipp azonnal villanjon refetch előtt.

---

## 9. Polling-stratégia

Egy helyen definiált `refetchInterval`, a meglévő `inMatchWindow` logikával:

- `matches(tid)`: `refetchInterval` = ~60s, **csak** ha `inMatchWindow` igaz; egyébként `false`. `refetchOnWindowFocus: true`.
- `leaderboard(gid)`, `balance(gid)`: szintén match-ablakhoz kötve.
- `tipMatrix` rács-szerkezet: nem pollozik (a változó score a `matches`-ből jön); csak invalidation-re/forduló-váltásra fetch-el.
- `notifications.unread`: 60s + `refetchOnWindowFocus`. `notifications.list`: csak nyitott panelnél (`enabled: open`).

A „2 perces live" eltűnik (nincs élő score); marad az egységes, ablakhoz kötött ~1 perc.

---

## 10. Notification-domain

A NotificationBell SWR-mintája (`notif-unread` 60s + `notif-list` on-open + `mutate` mark-read után) átáll TanStack-re: `useUnreadCount` / `useNotifications` a `liveKeys.notifications` kulcsokon, a mark-read mutációk `invalidateQueries({ queryKey: ["notifications"] })`-t hívnak. A broadcast/system notification szerver-oldali logikája változatlan.

---

## 11. Opcionális 2. fázis: szerver-oldali cache

Mivel az oldalak már dinamikusak, a frissesség nem ezen múlik. De a drága aggregációk (`getGroupLeaderboard` SQL, projected balance) a Next 16 stabil **`"use cache"`** direktívája + `cacheTag` mögé tehetők, és a cron/mutáció `revalidateTag`-et hív. Ez csökkenti a DB-terhelést és konzisztens SSR-t ad újra-belépéskor. **Nem `unstable_cache`** (azt a Next 16 kivezette). Külön, opcionális fázis — nem az alap-scope.

---

## 12. Migrációs fázisok

- **Fázis 0 — Alap:** TanStack Query + devtools telepítés, `QueryProvider` a root layoutban, `query-keys.ts`, `invalidate.ts` váz.
- **Fázis 1 — Meccs-réteg (a bejelentett bug):** `matches` snapshot kulcs; MatchCard + TipMatrix közös score-forrásra; a TipMatrix `useState`-cache megszüntetése. **Ez önmagában javítja a tüneti bugot.**
- **Fázis 2 — Leaderboard + balance** a TanStack-be; `use-leaderboard-polling.ts` kivezetése.
- **Fázis 3 — Notification** a TanStack-be; SWR + `swr-provider` + dependency teljes kivezetése.
- **Fázis 4 — Központi invalidation:** `invalidateAfterBet` és a többi mutáció bekötése; `onBetMutated` + a felesleges `router.refresh()`-ek kivezetése. **Ez teljesíti a cross-surface követelményt.**
- **Fázis 5 (opcionális) — Szerver-cache:** `"use cache"` + `revalidateTag` a drága aggregációkra.

Minden fázis önállóan szállítható és tesztelhető; a régi mechanizmus csak az adott domain átállása után kerül ki.

---

## 13. Tesztelés

- **Unit (Vitest, TDD):** `query-keys.ts` factory, `invalidate.ts` (mely kulcsokat invalidálja), a polling-ablak (`inMatchWindow`, már létezik), a snapshot-fetcherek tiszta transzformációi.
- **Integráció:** a kritikus cross-surface forgatókönyv — tippadás után a TipMatrix-cella, az egyenleg és a leaderboard is frissül egyetlen invalidációból. (A projekt E2E-je Playwright-tal TODO; addig hook-szintű teszt a `QueryClient` mockkal.)
- **Regresszió:** a meccs-vége forgatókönyv — `matches` invalidáció/poll után a TipMatrix és MatchCard azonos eredményt mutat.

---

## 14. Kockázatok és nyitott kérdések

- **Hydration mismatch:** a TipMatrix már kezel egy időzóna-mismatchet (SSR venue-tz → mount user-tz). A `HydrationBoundary` átállásnál ügyelni kell, hogy a dehydrált state egyezik az SSR-renderrel.
- **TanStack × Next 16 RSC:** a `HydrationBoundary` minta stabil, de a Next 16 `cacheComponents` (ha az 5. fázis bejön) interakcióját külön igazolni kell.
- **Auth-hívás minden fetcherben:** minden snapshot-action `getCurrentUser()`-t hív; a konszolidáció csökkenti a párhuzamos hívásszámot, de érdemes mérni.
- **Nyitott kérdés:** a tip-mátrix forduló-lapozásánál a régi/befejezett fordulók statikusak — maradjanak `staleTime: Infinity`-vel (nincs poll, nincs felesleges refetch), csak az aktuális forduló él. Megerősítendő implementációkor.
