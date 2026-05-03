# Match Schedule Override — Design Spec

## Probléma

Az api-sports.io egyes szezonokhoz (pl. 2026 IIHF VB) placeholder dátumokat ad — minden meccset egyetlen napra teszi (pl. 2026-05-15). A valós menetrend már elérhető az IIHF oldalán, de az API még nem frissült.

Ez két helyen okoz gondot:
1. **Token kiosztás** — minden token azonnal elérhetővé válik, mert a cutoff számítás a `scheduledAt`-ra épül
2. **UI accordion csoportosítás** — mind az 56+ meccs egyetlen nap alá kerül

## Megoldás

### Új tábla: `match_schedule_overrides`

| Mező | Típus | Leírás |
|------|-------|--------|
| `id` | uuid PK | |
| `match_id` | uuid FK → matches.id, UNIQUE | Az érintett meccs |
| `scheduled_at` | timestamptz NOT NULL | A helyes dátum/idő |
| `created_at` | timestamptz DEFAULT now() | |

Kézzel (AI-val) töltjük fel a valós menetrend alapján. Nincs hozzá UI.

### Módosítás: `tournaments` tábla

```
+ use_schedule_overrides boolean NOT NULL DEFAULT false
```

Ez a flag szabályozza, hogy a sync az override dátumokat használja-e a `matches.scheduledAt` felülírásához.

## Detektálási logika

A cron sync (`syncTournament`) végén fut, ha léteznek override-ok az adott tournament-hez.

### Hibás menetrend felismerése (flag bekapcsolás)

1. Lekérjük a tournament összes `scheduled` meccsét
2. Napokra csoportosítjuk a `matches.scheduledAt` szerint
3. Ha a legtöbb meccset tartalmazó nap a meccsek >80%-át tartalmazza → hibás menetrend
4. Ha vannak override-ok ehhez a tournament-hez → `useScheduleOverrides = true`

### API javulás felismerése (flag kikapcsolás)

1. Ha `useScheduleOverrides = true`, összehasonlítjuk az API-ból jövő dátumokat az override dátumokkal
2. Egyezés: ha az API dátum és az override dátum közötti különbség ≤ 2 óra (timezone tolerancia)
3. Ha a meccsek ≥90%-ánál egyezik → `useScheduleOverrides = false`
4. A normál sync ilyenkor felülírja a `matches.scheduledAt`-ot az API értékekkel (ez már most is megtörténik)

### Miért ±2 óra tolerancia?

Az API és az IIHF eltérő timezone-ban közölheti a kezdési időt. Pl. az IIHF CET-ben, az API UTC-ben — a nap ugyanaz, de az óra eltérhet. A ±2 óra biztosítja, hogy ne timezone-különbség miatt maradjon beragadva a flag.

## Effektív scheduledAt — a sync írja felül

**Kulcs döntés:** nem módosítjuk a query-ket, UI-t, token logikát. Ehelyett a sync során, ha `useScheduleOverrides = true`:

1. Minden meccshez keresünk override-ot
2. Ha van, felülírjuk a `matches.scheduledAt`-ot az override értékkel
3. A `matches.round` mezőt is frissítjük (mert az accordion grouping erre épül)

Így a `matches` tábla mindig a "jelenleg érvényes" dátumot tartalmazza, és az összes downstream logika automatikusan helyes:

- Token kiosztás cutoff (`distributeTokensForTournament`)
- UI accordion csoportosítás (`getDateKey(match.scheduledAt)`)
- Projected balance (`matches.scheduledAt <= targetMatch.scheduledAt`)
- Smart cron near start/end window
- Match rendezés (`orderBy: [matches.scheduledAt]`)

## Sync flow módosítás

**Fontos:** A jelenlegi sync NEM frissíti a `scheduledAt`-ot meglévő meccseknél (csak insertnél állítja be). Ezt ki kell egészíteni: a fixtures sync mindig frissítse a `scheduledAt`-ot az API értékre. Így ha az override kikapcsol, az API dátumok már a `matches` táblában vannak.

```
syncTournament(tournament):
  1. Fixtures sync (meglévő logika + scheduledAt/round UPDATE meglévő meccsekre is)
  2. Odds sync (meglévő logika)
  3. Schedule override detektálás:
     a. Van-e override ehhez a tournament-hez?
        - Ha nincs → skip
     b. useScheduleOverrides jelenleg false?
        - Ellenőrizzük: hibás-e a menetrend? (>80% egy napon)
        - Ha igen → useScheduleOverrides = true
     c. useScheduleOverrides jelenleg true?
        - Ellenőrizzük: javult-e az API? (≥90% egyezés ±2h)
        - Ha igen → useScheduleOverrides = false
  4. Ha useScheduleOverrides = true:
     - Felülírjuk matches.scheduledAt + round az override-okból
     (Ha step 3c épp kikapcsolta → step 4 nem fut, az API dátumok maradnak step 1-ből)
  5. Scoring, refund (meglévő logika)
```

A sorrend garantálja, hogy:
- Ha override aktív: step 1 írja az API dátumot, step 4 felülírja az override-dal
- Ha override kikapcsol: step 1 írja az API dátumot, step 4 nem fut → API dátum marad

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `src/db/schema.ts` | Új `matchScheduleOverrides` tábla + `useScheduleOverrides` mező a `tournaments`-on |
| `drizzle/XXXX_schedule_overrides.sql` | Migráció |
| `src/app/api/cron/sync/route.ts` | Detektálás + override alkalmazás a sync flow-ban |

Nincs változás a query-kben, UI-ban, token logikában — az override-ot a sync alkalmazza a `matches` táblára.

## Kézi feltöltés

Az override-okat közvetlenül SQL-lel vagy Neon console-on keresztül töltjük. Példa:

```sql
INSERT INTO match_schedule_overrides (match_id, scheduled_at)
SELECT m.id, CASE m.api_game_id
  WHEN 12345 THEN '2026-05-15 16:20:00+02'
  WHEN 12346 THEN '2026-05-15 20:20:00+02'
  -- ...
END
FROM matches m
WHERE m.tournament_id = '<tournament-uuid>'
  AND m.api_game_id IN (12345, 12346, ...);
```

Alternatíva: Claude Code tölti ki a `match_schedule_overrides` táblát az IIHF menetrend alapján, Neon MCP-n keresztül.
