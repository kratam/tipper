# Match-finish újratervezés — odds-api órás rate limit megszüntetése

**Dátum:** 2026-06-23
**Állapot:** jóváhagyott design, implementációra vár
**Érintett provider:** odds-api (FIFA WC 2026), de az architektúra provider-független

## Probléma

Az odds-api.io **Free Plan órás limitje 100 request/óra** (nincs napi/havi limit). Egy aktív
meccs-blokk vége felé túllőttük (email: „You've hit your rate limit 24 times in the last hour"),
azaz abban az órában ~124 hívás ment ki. Három, egymást erősítő ok:

1. **Felhalmozódó párhuzamos láncok.** A `periodic` cron minden végidő-„bucketre" külön QStash
   match-finish láncot indít (`src/app/api/cron/periodic/route.ts:44-83`). Egy lezárult meccs lánca
   a „rescheduled_next_match" ágon (`src/app/api/cron/match-finish/route.ts:59-72`) ráugrik a
   következő meccs várható végére, ahol már fut egy lánc. Egy éjszakai meccs-soron a láncok egy
   „vándorló csordává" hízanak; a 4. meccsnél már több párhuzamos lánc pollozza ugyanazt az
   `/events` végpontot, dedup nélkül.
2. **Retry-amplifikáció.** A `fetchEvents` 429-nél `throw`-ol (`src/lib/providers/odds-api/client.ts:43`),
   amit a match-finish route nem kap el → a route 500-at ad → a QStash **automatikusan
   újrapróbálja**. Minden rate-limitelt hívás további hívásokat szül: pozitív visszacsatolás.
3. **Felesleges sűrűség.** A meccs *alatt* 10 percenként recheck-elünk
   (`LIVE_RECHECK_SECONDS`), pedig élő állásra nincs igény.

A meccsek között van ~3 óra szünet (nincs átfedés), tehát egy jól tervezett rendszerben minden
meccs a saját órájában néhány hívással lezárná magát, és sosem érnénk a 100-hoz közel.

## Követelmény

Élő állás meccs közben **nem** kell. A meccs **vége felé** a végeredmény és a pontozás
**gyorsan** (pár percen belül) jelenjen meg. Tehát:

- Meccs **alatt**: nulla odds-api hívás.
- Meccs várható **vége körül**: sűrű recheck (≈ 3 perc), amíg a meccs `finished`.
- Aztán ugrás a következő meccsre, vagy leállás, ha nincs több.

## Cél-invariáns

**Tornánként bármikor legfeljebb egy** függőben lévő match-finish QStash-üzenet.

## Architektúra

### 1. Állapotmező

Új nullable oszlop a `tournaments` táblán (`src/db/schema.ts:48`):

```ts
nextFinishCheckAt: timestamp("next_finish_check_at", { withTimezone: true }),
```

Szerződés: ha **nem null**, akkor egy match-finish check van/lesz ütemezve erre az időre; ha
**null**, nincs aktív lánc az adott tornához. Séma-változás a `db:generate` → `db:migrate` úton
(CLAUDE.md előírás; a Vercel build nem migrál).

### 2. Pure döntéslogika — `computeNextFinishCheck`

Új tiszta függvény (pl. `src/lib/match-finish-schedule.ts`), TDD-vel fedve:

```
computeNextFinishCheck(
  pending: { scheduledAt: Date; status: "scheduled" | "live"; durationMs: number }[],
  now: Date,
): Date | null
```

Logika:
1. `pending` üres → `null` (nincs több dolog, a lánc leáll).
2. Minden meccsre `expectedEnd = scheduledAt + durationMs`.
3. Ha van olyan meccs, amelynek `expectedEnd <= now` (várjuk az eredményét) →
   `now + RECHECK_INTERVAL` (sűrű recheck).
4. Különben → `min(expectedEnd)` az összes pending meccsre (az első jövőbeli meccs-vég; addig
   nulla hívás).

Konstans: `RECHECK_INTERVAL = 3 * 60 * 1000` (3 perc). A `durationMs` a meglévő
`expectedMatchDurationMs(providerSport)` (`src/lib/match-duration.ts`; foci = 1h55m).

### 3. Közös ütemező — `scheduleNextFinishCheck(tournamentId)`

Egy helyen dönt és ütemez (pl. `src/lib/sync.ts` vagy új modul):

1. Lekéri a torna `scheduled` + `live` meccseit (a `matches_tournament_status_idx` index fedi).
2. `T = computeNextFinishCheck(pending, now)`.
3. Ha `T === null` → `UPDATE tournaments SET next_finish_check_at = NULL WHERE id = :id`, return.
4. **Atomikus claim** (ez garantálja az invariánst):
   ```sql
   UPDATE tournaments SET next_finish_check_at = :T
   WHERE id = :id AND (next_finish_check_at IS NULL OR next_finish_check_at <= :now)
   RETURNING id
   ```
   - Visszajött sor → **mi nyertünk**, publikálunk QStash-üzenetet (lásd 4. pont).
   - Nincs sor → már van **jövőbeli** check ehhez a tornához → nem ütemezünk (nincs duplikátum).

A `<= :now` feltétel teszi lehetővé az **önjavítást**: ha egy korábbi check elveszett (lásd
`retries: 0`), a `next_finish_check_at` a múltban marad, és a következő hívó újrafoglalja.

### 4. QStash publikálás — `scheduleMatchFinishCheck`

`src/lib/qstash.ts` módosítás:

- Új paraméter: `tournamentId` → bekerül a body-ba.
- `retries: 0` — nincs vak QStash-újrapróbálkozás (kivégzi a retry-amplifikációt).
- **Nincs `deduplicationId`.** Fontos: egy fix `finish-<tournamentId>` dedup ID *ártana*, mert a
  QStash ~10 perces dedup-ablakában eldobná a 3 percenkénti legitim recheck-üzeneteket (ugyanaz a
  torna, ugyanaz az ID). Időbélyeges ID (`finish-<id>-<T>`) viszont redundáns volna, mert a DB-claim
  (3. pont) már garantálja, hogy ugyanarra a `T`-re csak egy hívó publikál. Ezért a QStash-dedupot
  elhagyjuk; **az egyetlen invariáns-forrás a DB-claim**.

```ts
await qstash.publishJSON({
  url: `${baseUrl}/api/cron/match-finish`,
  body: { trigger: "scheduled", tournamentId },
  delay: delaySeconds,
  retries: 0,
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});
```

### 5. `match-finish` route — torna-specifikus, hibatűrő

`src/app/api/cron/match-finish/route.ts` átírás:

- A POST body-ból kiolvassa a `tournamentId`-t, és **csak azt az egy tornát** kezeli (eddig az
  összes aktív tornát szinkronizálta egy hívásban). Tornánként külön, dedup-olt lánc.
- Folyamat: `syncFixtures(tournament)` (a pontozás/refund az atomi compare-and-set claim-mel,
  változatlanul), majd a végén `scheduleNextFinishCheck(tournamentId)`. A régi
  `rescheduled_live` / `rescheduled_next_match` / `all_done` elágazás **megszűnik**; a `T`-logika
  egységesíti.
- **Soha nem dob kezeletlen exceptiont.** A `syncFixtures` odds-api hibáját (429 is) elkapja,
  logolja (`console.error`, hogy a Vercel logban látsszon). A route **mindig** lefuttatja a végén a
  `scheduleNextFinishCheck(tournamentId)`-t — hibás sync esetén is —, ami a DB-ből (nem az odds-api-ból)
  számol, és a még lezáratlan meccs miatt rövid távra (≈ 3 perc) újraütemez. Így a normál recheck
  próbálja újra; a route `200`-zal tér vissza, nincs QStash-retry, nincs amplifikáció.

### 6. `periodic` cron — fan-out helyett egyetlen ütemező hívás

`src/app/api/cron/periodic/route.ts` átírás:

- A fixtures/odds sync után minden **aktív** tornára meghívja `scheduleNextFinishCheck(t.id)`.
- A guard miatt élő láncot nem duplikál, **elveszett** láncot viszont újraindít (önjavítás
  6 óránként). A teljes bucket-számoló blokk (`:44-83`) törlődik.

## Másodlagos tisztítás (külön is mehet)

A `syncOdds` jelenleg **másodszor** is lehozza az event-listát: a `fetchOdds` provider-metódus
belül újra `fetchEvents`-t hív (`src/lib/providers/odds-api/index.ts:30`), pedig a `syncFixtures`
már lehozta. A `MatchProvider.fetchOdds`-ot úgy alakítjuk, hogy a már lekért pending eseményeket
kapja paraméterként. Nyereség: +1 `/events` megspórolva tornánként, periodic-futásonként. Ha
bonyolítja a provider-interfészt, külön PR-ben.

## Hatás (becslés)

- **Eddig:** meccs-blokk vége felé párhuzamos láncok + retry → ~124 hívás/óra (limit fölött).
- **Ezután:** meccsenként jellemzően 1–néhány `/events` a várható vég körül; egy 4 meccses este
  összesen ~néhány–20 hívás, időben szétkenve. A periodic odds-sync változatlan (6 óránként,
  ~8 hívás/torna), de soha nem torlódik egy meccs-véggel a 100/óra közelébe.

## Amit szándékosan NEM csinálunk (YAGNI)

- Nem nyúlunk a kliens `useMatchPolling`-hoz (`src/hooks/use-match-polling.ts`): DB-ből olvas, nem
  terheli az odds-api-t. Élő állás hiánya miatt meccs alatt statikus marad — ez nem rate-limit
  kérdés.
- Nem vezetünk be WebSocket-et / fizetős plant.

## Tesztelés

- **`computeNextFinishCheck`** — pure unit teszt (Vitest, TDD), a `schedule-override` /
  `expected-match-duration` minták szerint. Esetek: üres pending → null; minden jövőbeli →
  legkorábbi `expectedEnd`; van overdue (várjuk az eredményt) → `now + RECHECK_INTERVAL`; vegyes;
  `live` státusz a várható vég előtt/után.
- **`scheduleMatchFinishCheck`** — a meglévő `tests/lib/qstash.test.ts` frissítése az új
  paraméterre (`tournamentId`, `retries: 0`, `deduplicationId`).
- Az atomi claim és a route a meglévő integrációs minták szerint.

## Migráció / rollout

1. `db:generate` → a `next_finish_check_at` oszlop migrációja.
2. Deploy előtt **kézzel** `db:migrate` (production és dev branch).
3. Az első `periodic` futás (vagy kézi trigger) beindítja az új, dedup-olt láncokat. A régi,
   még függő QStash-üzenetek a `retries: 0` és a torna-specifikus dedup miatt legrosszabb esetben
   1-1 felesleges, hibatűrő hívást okoznak, majd kifutnak.
