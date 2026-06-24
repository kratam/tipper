# Match-finish — gyorsabb pontozás a meccs vége felé

**Dátum:** 2026-06-24
**Állapot:** jóváhagyott design, implementációra vár
**Előzmény:** [`2026-06-23-match-finish-rate-limit-design.md`](./2026-06-23-match-finish-rate-limit-design.md) — az ott bevezetett, dedup-olt egyetlen finish-lánc (`computeNextFinishCheck`, atomikus claim, `retries: 0`, tornánként egy QStash-üzenet) **változatlan marad**; ez a spec csak két konstanst hangol.

## Probléma

A tegnapi rate-limit fix után a hívásszám rendben van (~3 hívás/óra a tipikus meccs- blokkban, jóval a 100/óra odds-api limit alatt). Mivel ennyi tartalék van, a pontozás **gyorsabb** is lehet: jelenleg a tényleges meccs-vég után átlagosan 3-5 perccel jelenik meg a pontozás. Két, egymástól független késleltetés-forrás:

1. **A recheck-ablak.** A meccs várható vége után 3 percenként pollozunk (`RECHECK_INTERVAL_MS`), így a tényleges véget worst-case 3 perccel detektáljuk.
2. **A „korai vég" rés.** A poll a becsült végnél (`scheduledAt + FOOTBALL_DURATION_MS`, jelenleg 1h55m) indul. Egy átlagos foci meccs viszont ~90 perc játék + 15 perc szünet + ~6-8 perc ráadás = **~111-113 perc** alatt ténylegesen véget ér, azaz tipikusan az 1h55m **előtt**. Ezeket csak 1h55m-nél kapjuk el → átlagosan ~2-3 perc beépített késés, a recheck-től függetlenül.

## Mérés (production adat, 2026-06-24)

A `bets.updatedAt` (a `scoreMatch` állítja a pontozáskor, és a `payout IS NULL` guard miatt nem íródik felül) a meccs-vég detektálás idejének proxyja. A `scheduledAt`-ból kivonva, az eddigi WC 2026 meccsekre a **kezdéstől a pontozásig** eltelt idő tipikusan **115-130 perc** (a többség 120-125). Kiugró értékek: 562 perc (06-11) és 300 perc (06-22) — a régi rendszer elveszett/torlódott láncai, pont amit a 2026-06-23-as fix megszüntet.

**Korlát:** a proxy 115 percnél (1h55m) **alulról cenzorált**, mert a poll sosem indul a becsült vég előtt — így a „korai vég" rést közvetlenül nem méri. A becslés ezért a domain-tudásra támaszkodik (átlagos meccs ~112 perc).

## Az odds-api nem ad befejezés-időt (verifikálva)

Élő `/events` hívás egy `settled` meccsre (Portugália–Üzbegisztán, 06-23) — a teljes mezőlista: `id, home, away, homeId, awayId, date, league, sport, status, scores`.

- `date` = csak a **kezdés** ideje.
- `status` = `pending` → `live` → `settled` (az egyetlen befejezés-jel, csak pollozással kapjuk).
- `scores` = végeredmény, **timestamp nélkül**.

**Nincs** `last_update` / `completed_at` / `settled_at`. Következmények:

- Nincs jobb mérőszám a `bets.updatedAt` proxynál.
- A `settled` a **fogadóiroda elszámolása**, nem feltétlenül a sípszó — pár perc rejtett késleltetés marad, amit semmilyen sűrítés nem visz nulla felé. Ez a pontozási késleltetés **alsó korlátja**.
- Net-es alternatíva (flashscore/ESPN/FIFA-féle pontos meccs-vég) **YAGNI**: külön integráció + új rate-limit/megbízhatósági felület, ráadásul a pontozáshoz úgyis az odds-api végeredményét és `settled`-jét kell megvárni — a pontos sípszó-idő csak azt mondaná meg, *mikor kezdjünk* pollozni, a pontozást nem gyorsítaná.

## Megoldás — két konstans-hangolás

### 1. Sűrűbb recheck

`src/lib/match-finish-schedule.ts:4`:

```ts
export const RECHECK_INTERVAL_MS = 1 * 60 * 1000; // 1 perc (volt: 3 perc)
```

A *vég utáni* detektálási ablak ~3 perc helyett ~1 perc. Az 1 perc a praktikus alsó határ: a `delaySecondsUntil` 60s padlója (a meglévő QStash-konvenció) pont ezt engedi, ez alá menni a QStash-delay granularitása és a cron-overhead miatt nem éri meg.

### 2. Korábbi első poll

`src/lib/match-duration.ts:4`:

```ts
const FOOTBALL_DURATION_MS = (1 * 60 + 50) * 60 * 1000; // 1h50m (volt: 1h55m)
```

Az első poll 5 perccel korábban indul, így az átlagos (~112 perces) meccs tényleges végét is 1 percen belül elkapjuk. Az 1h50m még a 2. félidő hajrája, ezért legfeljebb ~2-5 extra hívás/meccs a kezdés előtt. A `DEFAULT_DURATION_MS` (2h30m, jégkorong/egyéb — más provider, más limit) **változatlan**.

### Együttes hatás

Szinte minden meccs a tényleges vég + ~1 percen belül pontozódik (a fenti alsó korlát erejéig).

## Rate-limit ellenőrzés

Tornánként egyetlen, dedup-olt lánc → 1 `/events` hívás/recheck (változatlan invariáns). Egyszerre csak a FIFA WC az aktív odds-api torna.

- **Csoportkör:** 1h50m-től a `settled`-ig ~3-12 hívás/meccs.
- **Worst case knockout** (rendes idő + hosszabbítás + tizenegyesek, ~2h30m tényleges vég): 1h50m-től ~40 perc poll → ~40 hívás, + periodic odds-sync (~8/torna/6 óra) ≈ **~48/óra**. Bőven a 100/óra limit alatt.

## Amit szándékosan NEM csinálunk (YAGNI)

- Nem építünk `live`-státusz-alapú adaptív logikát: a `live`-ot is csak pollozással frissítenénk, és az idő-alapú becslés (kezdés + duration) ezt jól közelíti, egyszerűbben.
- Nem megyünk 1 perc alá (lásd a QStash 60s padlót).
- Nem integrálunk másodlagos eredmény-forrást a pontos meccs-végért.
- Nem nyúlunk a `DEFAULT_DURATION_MS`-hez, sem a kliens `useMatchPolling`-hoz.

## Tesztelés

- `tests/lib/expected-match-duration.test.ts` — a football-eset frissítése `115 * MIN` → `110 * MIN`.
- `tests/lib/match-finish-schedule.test.ts` — a tesztek a `RECHECK_INTERVAL_MS` konstanst importálják, így zöld maradnak; viszont kiegészítjük egy explicit assertionnel, hogy `RECHECK_INTERVAL_MS === 60_000` — különben egy véletlen visszaállítás (pl. 3 percre) nem buktatná meg a tesztet.

## Migráció / rollout

Nincs séma-változás, nincs migráció. Backend-only, deploy on push (a deployt a user kezeli). Az első `periodic` futás (vagy a következő recheck) már az új konstansokkal ütemez.
