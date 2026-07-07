# Profil tét-táblázat — Design

**Dátum:** 2026-07-07
**Státusz:** Jóváhagyott (brainstorming), implementálásra kész

## Cél

A user profiloldalára (`/u/[userId]`) egy versenysorozatonként összecsukható táblázat,
ami a felhasználó **official + befejezett-meccses** tétjeit mutatja — vizuálisan a
Ranglista-tab accordion-tábláját (`group-leaderboard-content.tsx`) követve, de a profil
kontextusához igazítva (torna-szintű csoportosítás, lazy-load a lezártakra).

## Döntések (brainstorming)

1. **Tét-scope:** csak **official** csoportok tétjei, csak **befejezett** meccsek.
   Konzisztens a fejléc Stats-grid számaival (`getProfile` szintén csak official-t számol),
   és adatvédelmileg tiszta — nincs revealed-előtti tipp, így idegen profil is biztonságosan
   nézhető (a láthatóságot a `shareACircleOrLeague` gate adja).
2. **Szervezés:** versenysorozatonként (torna) csoportosítva, összecsukható accordion.
   Aktív tornák nyitva + soraik előre betöltve; lezártak csukva, soraik **csak kattintásra**
   töltődnek (valódi lazy-load server actionnel).
3. **Edge-case — több official csoport egy tornán:** a séma megengedi (`bets` unique
   `(userId, matchId, groupId)`), így ugyanarra a meccsre több official tét lehet. A Stats-grid
   mindet számolja → konzisztencia végett a táblázat is mindet mutatja. Ha egy tornán belül
   >1 distinct official csoport szerepel, a soroknál halvány **csoport-badge** különbözteti meg
   őket; egy csoportnál nincs badge (nincs zaj).

## Adatréteg

Két lépcső, hogy a „lezártakat csak kattintásra" tényleg lazy legyen.

### `getProfileBetSummaries(userId, viewerId): Promise<TournamentBetSummary[] | null>`
`src/queries/profile.ts`. Először `shareACircleOrLeague(userId, viewerId)` — ha hamis, `null`.
Egyetlen aggregáló SQL: `bets ⋈ matches ⋈ tournaments ⋈ groups(isOfficial=true)`,
szűrve `bets.userId = userId AND matches.status = 'finished'`, `GROUP BY tournaments.id`.

Visszaad tornánként:
- `tournamentId`, `name`, `logoUrl`, `status`
- `betCount` = `count(*)`
- `hitRate` = `round(100 * count(*) filter (result1x2Correct = true) / nullif(count(*),0))`
  (befejezett meccsnél minden tét resolved, ezért a nevező = betCount)
- `profit` = `sum(payout) - sum(stake)`
- `distinctGroupCount` = `count(distinct groupId)` (a csoport-badge kapcsolóhoz)
- `lastMatchAt` = `max(matches.scheduledAt)` (rendezéshez)

**Rendezés:** aktív tornák elöl (`status = 'active'`), majd `lastMatchAt` csökkenő.

### `getProfileTournamentBets(userId, tournamentId, viewerId, locale): Promise<ProfileBetRow[] | null>`
`src/queries/profile.ts`. Újra `shareACircleOrLeague` gate (a server action közvetlenül is
hívható, a page-védelem nem elég). Az adott torna official + befejezett tétjei, a
`getUserBetsForTournament` mintájára: `with: { match: { homeTeam, awayTeam, tournament }, group }`,
`withMatchTeamDisplay` a lokalizált csapat-megjelenítéshez.

`ProfileBetRow` (a UI-hoz laposítva):
- `matchId`, `home/awayTeam {name, logoUrl}`, `homeScore`, `awayScore`, `scheduledAt`
- `predictedHome/Away`, `stake`, `oddsAtBet`, `payout`
- `result1x2Correct`, `goalDiffCorrect`, `exactScoreCorrect` (a BetBonusCell + tone-színezéshez)
- `groupId`, `groupName`, `oddsBoost` (bet-enként a group-szintű odds-boost; a bónusz/odds
  megjelenítéshez — `formatEffectiveOdds(oddsAtBet, oddsBoost)`, `BetBonusCell`)

### Server action
`src/actions/profile.ts` (új): `"use server"` `loadProfileTournamentBets(userId, tournamentId)` —
`getCurrentUser()` → `getProfileTournamentBets(userId, tournamentId, user.id, locale)`.
`null` viewer/gate esetén üres tömb (a UI nem szivárogtat).

## UI

### `src/app/[locale]/u/[userId]/page.tsx`
A Stats-szekció alá egy új `<ProfileBetsSection>`. A page server-oldalon:
1. `getProfileBetSummaries(userId, user.id)` — ha `null` vagy üres, a szekció nem renderelődik.
2. Az **aktív** tornák sorait előre betölti (`getProfileTournamentBets` párhuzamosan),
   és `initialBets: Record<tournamentId, ProfileBetRow[]>`-ként adja át.

### `src/components/profile-bets-section.tsx` (új, kliens)
Props: `userId`, `summaries: TournamentBetSummary[]`, `initialBets`, `timeZone?` (nem kell —
`scheduledAt` már ISO), `currentUserId`.

- Radix `Accordion type="multiple"` (ugyanaz a primitív + `ui/accordion`, mint a Ranglista-tab).
- **Torna-fejléc:** logo + név, jobbra a summary-metrikák: `betCount` tipp · `hitRate`% ·
  `profit` (win/loss szín). Chevron.
- **Nyitási állapot:** az aktív tornák `value`-ja eleve nyitva; soraik `initialBets`-ből.
- **Lazy-load:** lezárt torna első kinyitásakor `loadProfileTournamentBets` server action;
  addig skeleton. Betöltött sorok kliens-cache-be (`Map<tournamentId, ProfileBetRow[]>`),
  újra-nyitás nem tölt.
- **Tét-sorok:** a Ranglista-accordion oszlop-mintája — Meccs (két `TeamLogo` + végeredmény) ·
  Tipp (`predictedHome-Away`, `predictionToneClass`) · Odds (`formatEffectiveOdds`) · Tét ·
  Bónusz (`BetBonusCell`) · ± (nettó `payout - stake`, win/loss). `overflow-x-auto` wrapper +
  `min-w-[360px]`, mint az eredetiben. Sorrend: `scheduledAt` csökkenő.
- **Csoport-badge:** ha `summary.distinctGroupCount > 1`, minden sor mellé egy halvány
  `groupName` pill.
- **Nincs dupla-scroll:** a nyitott torna szabadon kinyílik; nincs belső fix-magasság-scroll
  (mobilon a page-scroll az egyetlen). A collapse kezeli a hosszt.
- **Üres állapot:** ha nincs summary → a page nem rendereli a szekciót.

### Pure logika (tesztelhető)
`src/lib/profile-bets.ts`: `sortBetRowsByScheduledDesc(rows)` és a csoport-badge feltétel
(`shouldShowGroupBadge(distinctGroupCount)`), ill. a nettó-számítás helper
(`netProfit(payout, stake)`), hogy a UI-tól függetlenül unit-tesztelhető legyen.

## i18n (`messages/hu.json`, `en.json` — `profile` namespace)
- `betsHeading` = „Tippek" / "Bets"
- `noBets` = (nem jelenik meg — a szekció ilyenkor nincs renderelve; kulcs elhagyható)
- `summaryBetsCount` = „{count} tipp" / "{count} bets"
Az oszlopfejlécek (`prediction`, `odds`, `payout`, `bonusColumn`, `stake`, `noBetsForPlayer`)
a meglévő `groups`/`betting` namespace-ből újrahasznosítva (a komponens több `useTranslations`-t
olvas, mint a `group-leaderboard-content`).

## Teszt & verifikáció
- Vitest unit a `lib/profile-bets.ts` pure helperekre (rendezés, badge-feltétel, nettó).
- `npm run check` (Biome) + `npm run build` (típusok).
- `verify` skill: a `/u/[userId]` oldal betöltése, aktív torna nyitva + sorok, lezárt torna
  kattintásra betölt (dev szerver + headless screenshot / böngésző).

## Nem-cél (YAGNI)
- Nem-official / baráti kör tétek (inkonzisztens lenne a Stats-griddel).
- Folyamatban lévő / jövőbeli (revealed-előtti) tippek — adatvédelmi kockázat idegen profilnál.
- Belső fix-magasságú scroll-konténer (a collapse + lazy-load kiváltja).
- Torna-szűrő / kereső a profilon.
