# eredmenyek.com (Flashscore) — felderítési jegyzet (PARKOLVA)

> **Státusz: parkolva.** 2026-05-29-én úgy döntöttünk, hogy a provider-absztrakció második forrása az **odds-api.io** lesz (triviális enumeráció, API-kulcs auth, lásd [docs/plans/2026-05-29-provider-abstraction.md](../plans/2026-05-29-provider-abstraction.md)), nem az eredmenyek.com. Ez a doksi megőrzi az eredmenyekről összegyűjtött tudást, hogy ha később mégis kell (pl. magyar bookmaker odds, vagy odds-api-ban hiányzó torna), ne kelljen újra felderíteni.

## Miért parkoltuk

Az eredmenyek.com belső API-ja bizonyítottan elérhető sima HTTP-vel, DE egy torna teljes meccslistájának böngésző-mentes **enumerálása** nyitott RE-pont (a fixtures feed Service Worker cache-ből jön). Az odds-api.io ezt egyetlen `GET /events?sport=&league=` hívással megoldja — így az eredmenyek nehéz része feleslegessé vált a jelenlegi célhoz.

## Bizonyított végpontok (a prod probe alapján, 24h zöld)

A megbízhatósági probe (`src/lib/eredmenyek-probe.ts` + `src/app/api/cron/eredmenyek-probe/route.ts`, 5 percenként) az utolsó 24h-ban: ✅ „MINDEN OK", 0 hiba, 0 x-fsign változás.

- **Odds (auth NÉLKÜL):**
  `GET https://global.ds.lsapp.eu/odds/pq_graphql?_hash=ope2&eventId=<ID>&bookmakerId=498&betType=HOME_DRAW_AWAY&betScope=FULL_TIME`
  → JSON `data.findPrematchOddsForBookmaker.{home,draw,away}.value` (+ opening/change).
- **Detail/score/státusz (x-fsign header kell):**
  `GET https://global.flashscore.ninja/15/x/feed/dc_1_<ID>` + `x-fsign`
  → `÷`/`¬` szeparált feed: `DA`=státusz (1=scheduled, 2=live, 3=finished), `DC`=kezdés ts, `DE`/`DF`=hazai/vendég score.
- **x-fsign böngésző nélkül:** homepage → `core_15_*.js` → `feed_sign` regex (lásd `harvestFsign` a probe-ban). Stabil; self-heal terv: 401 → re-harvest → 1 retry.

## Bookmaker

A HU geo-IP-re a `498` (TippmixPro) jön vissza. Más projekten más default (proj 2/GB → bet365). Az odds **nyelvfüggetlen**.

## Lokalizáció (bizonyított)

A Flashscore közös, globális event/team ID-kat használ minden lokalizált projekten:
- Projekt `15` = magyar (`flashscore.ninja/15/...`, eredmenyek.com) → magyar nevek („Csehország", „Nagy-Britannia").
- Projekt `2` = angol (flashscore.com) → angol nevek.
- Ugyanaz az event-id mindkettőn működik; a feed lokalizáltan jön (pl. `MIV` mező: proj 15 = „Mexikóváros", proj 2 = „Mexico City").
- → mindkét nyelv lehúzható **ugyanarra az ID-ra** kulcsolva (a kétnyelvű `teams.nameHu`/`nameEn` modellhez illik, amit az odds-api terv is bevezet).

## Nyitott RE-pont (ha újraélesztjük)

Egy torna teljes meccs-listájának (event-ID + nevek) böngésző-mentes enumerálása:
- A `dc_` detail feed megy tiszta HTTP-vel + x-fsign-nel.
- A torna-fixtures feed (`f_<sport>_<tournamentId>_<stageId>_...` vagy `tournament_page_...` jellegű kulcs) feltételezhetően **ugyanígy** elérhető, de ezt nem RE-eztük vissza. Spike-terv: a homepage `core_15_*.js`-ben keresni a feed-építő függvény paramétereit; kandidált URL-mintákat próbálni harvestelt x-fsign-nel; ha 200 + event-sorok → kész.
- Fallback, ha nem megy: admin bemásolja az event-ID listát tornánként, és csak per-event `dc_`/odds hívás fut.

## Séma-igény (ha újraélesztjük)

Az odds-api terv `provider` enumja `["api-sports","odds-api"]`. Eredmenyek-hez hozzá kéne venni `"eredmenyek"`-et, és a torna-confighoz két text oszlop (`providerTournamentId` = `zeSHfCx3`, `providerStageId` = `SbLsX4y7`). A `teams` kétnyelvű név + provider-namespace modellje változtatás nélkül illik.

## Releváns kód a repóban (megmarad, fut tovább)

- `src/lib/eredmenyek-probe.ts` — `harvestFsign`, `fetchDetail`, `fetchOdds`, `parseFeed`, `runProbe`, `formatSummary`.
- `src/app/api/cron/eredmenyek-probe/route.ts` — 5 perces Vercel cron, a Vercel runtime logba ír (NEM DB).
