# Kör (baráti kör) — tournamenteken átívelő szűrt ranglista

**Dátum:** 2026-06-03
**Státusz:** Jóváhagyásra vár
**Típus:** Új feature

## 1. Probléma és cél

Jelenleg minden tournamenthez tartozik egy hivatalos „Ranglista" csoport (`isOfficial`),
amelybe minden játékos automatikusan belép, és amelyben a tippek/tokenek zajlanak. Ezen
felül a játékosok saját **normál csoportokat** hozhatnak létre — de ezeknek külön
szabályrendszerük és **külön tétrendszerük** van: aki egy ilyen csoportban is versenyezni
akar, annak **újra kell tippelnie**.

Baráti társaságok gyakran csak azt szeretnék látni, **hogyan állnak egymáshoz képest a
hivatalos versenyben** — anélkül, hogy pluszban tippelniük kéne, és anélkül, hogy minden új
versenysorozathoz újra létre kelljen hozniuk egy csoportot.

**Cél:** egy új, könnyűsúlyú entitás — a **Kör** —, amely egy perzisztens tagsági lista
tournamenttől függetlenül. A Kör minden tournamentnél automatikusan ad egy **szűrt
ranglistát**: a hivatalos csoport eredményeit a kör tagjaira szűrve. Egyszer létrehozod →
minden versenysorozatnál ott a baráti listátok, újralétrehozás nélkül, plusz tét nélkül.

## 2. Hatókör

### Bent (MVP)
- `circles` + `circle_members` séma + migráció.
- Kör létrehozása (név → slug, inviteCode, owner auto-tag).
- Csatlakozás meghívókóddal (a meglévő `/join/[code]` kibővítve).
- `/circles` kezelőoldal: köreim, létrehozás, meghívókód, tagok, kilépés/törlés.
- Tournament oldalon: a köreim kártyái a hivatalos Ranglista alatt (mini szűrt ranglista).
- Kör-detail oldal tournament-kontextusban: **Ranglista + Eredmények** tab, csak olvasható.
- Szűrő + újrarangsoroló query-k (leaderboard és eredmények).
- i18n (hu/en), unit teszt a szűrés/rangsor pure logikára.

### Kint (most nem)
- Aggregált összpontszám / összprofit több tournamentből.
- Helyezési pontok (1. hely = X pont) rendszer.
- Publikus, felfedezhető körök (a Kör mindig privát, csak kóddal).
- Tét leadása vagy bármilyen token-művelet a körben.

## 3. Koncepció

A Kör **nem** tournamenthez kötött. Egy tagsági lista + egy szűrő, amely **minden**
tournament hivatalos ranglistájára ráhúzható. Egy adott tournamentnél a Kör nézete a
hivatalos „Ranglista" csoport eredményeinek a kör tagjaira szűrt, körön belül
újrarangsorolt változata. A körnek nincs szabálya, tokenje, tétje.

## 4. Adatmodell

⚑ **Döntés: külön táblák, nem a `groups` bővítése.** A `groups` tournamenthez kötött
(`tournamentId NOT NULL`, unique(tournamentId, slug)) és tele van szabály-oszloppal
(`tokenPerMatch`, `bonusGoalDiff`, `oddsBoost`, …). A Kör ezek egyikét sem használja, és
nem köthető egyetlen tournamenthez sem. A `groups` átalakítása nullable oszlopokkal
szétmosná a modellt; két fókuszált új tábla tisztább.

```
circles
  id          uuid pk
  name        text not null
  slug        text not null            -- globálisan egyedi (nem tournament-szintű)
  inviteCode  text not null unique
  ownerId     uuid -> users.id
  description text null
  createdAt   timestamptz default now()
  uniqueIndex(slug)

circle_members
  id        uuid pk
  circleId  uuid -> circles.id
  userId    uuid -> users.id
  joinedAt  timestamptz default now()
  uniqueIndex(circleId, userId)
```

Drizzle relations: `circles.owner -> users`, `circles.members -> circle_members`,
`circle_members.circle`, `circle_members.user`. Nincs ledger/bet/podium kapcsolat.

Migráció **kizárólag** `npm run db:generate` → `npm run db:migrate` úton (lokálisan,
deploy előtt kézzel), a projekt konvenciója szerint.

## 5. Szűrt ranglista logika

Egy `(circle, tournament)` párra a nézet a hivatalos csoport ranglistájából származik:

1. Megkeressük a tournament hivatalos csoportját (`groups.isOfficial = true`,
   `tournamentId = T`).
2. `getGroupLeaderboard(officialGroupId)` — visszaadja az összes hivatalos tag profitját és
   **hivatalos összhelyezését** (rank 1..N a teljes mezőnyben).
3. A kör tagjaira szűrünk (`circle_members.userId` halmaz). Csak azok a tagok jelennek meg,
   akik **ténylegesen részt vettek** ebben a tournamentben — azaz tagjai a hivatalos
   csoportnak (ez lazy, a tournament megnyitásakor jön létre az `ensureOfficialMembership`
   által). Aki sosem nyitotta meg az adott versenyt, ott nem szerepel.
4. **Körön belüli újrarangsorolás:** a szűrt listán új helyezés 1..n. Minden sor megtartja a
   `profit`-ot (hivatalos csoportbeli) és az **eredeti hivatalos összhelyezést** badge-ként.

⚑ **Döntés (rangsor — „mindkettő"):** elsődleges a körön belüli helyezés (1..n), mellette
kis badge a hivatalos összhelyezéssel (pl. „#17 össz").

**Eredmények tab:** ugyanez a szűrés a `getGroupBetsForFinishedMatches(officialGroupId)`
eredményén — a körtagok hivatalos-csoportbeli tippjei a befejezett meccsekre.

**Implementáció:** először JS-szűréssel + újrarangsorral, a meglévő, tesztelt query-k
újrahasználásával (`getGroupLeaderboard`, `getGroupBetsForFinishedMatches`). A szűrés +
újrarangsor egy **pure** segédfüggvény (`filterAndRerankLeaderboard(rows, memberIds)`),
külön tesztelve. Ha a hivatalos csoportok mérete megnő, a szűrés később SQL-be tolható —
de az interfész (a query-réteg) változatlan marad.

## 6. Query-réteg (`src/queries/circles.ts`)

- `getUserCircles(userId)` — a user köreinek listája (owner, tagszám) a `/circles`-höz és a
  tournament-kártyákhoz.
- `getCircleBySlug(slug)` — kör + tagok (a kör-detail oldalhoz, member-check-hez).
- `getCircleByInviteCode(code)` — join-hoz.
- `getCircleMemberIds(circleId)` — a szűrő halmaz.
- A szűrt ranglista/eredmény a meglévő leaderboard/bets query-kre + a pure
  `filterAndRerankLeaderboard` segédre épül (`src/lib/circle-leaderboard.ts`).

## 7. Server Actions (`src/actions/circles.ts`)

Mind `"use server"`, mind `getCurrentUser()` ellenőrzéssel:
- `createCircle(name)` — slug + inviteCode generálás (`slugify`, `generateInviteCode`),
  owner beszúrása `circle_members`-be is. **Nincs** tokenkiosztás.
- `joinCircle(code)` — `circle_members` insert (idempotens a unique-on). Nincs token.
- `leaveCircle(circleId)` / `deleteCircle(circleId)` (utóbbi csak owner).
- `renameCircle(circleId, name)` (csak owner).

## 8. UI / navigáció

### Tournament oldal (`tournaments/[slug]/page.tsx`)
A hivatalos Ranglista kártya alatt megjelenik **minden köröm kártyája** ehhez a
tournamenthez — kinézetre azonos a normál csoport-kártyával (`group-card.tsx` mintára egy
`circle-card.tsx`, mini szűrt ranglistával). Rákattintva a kör oldalára navigál.

A meglévő oldal már betölti a usert és a hivatalos csoport leaderboardját; ehhez hozzájön a
`getUserCircles(user.id)` és körönként a szűrt mini-ranglista (a már lekért hivatalos
leaderboard JS-szűrésével — nincs feltétlenül új DB-kör).

### Kör-detail oldal — új route `tournaments/[slug]/circles/[circleSlug]/page.tsx`
Tournament-kontextusban mutatja a kört. Újrahasználja a csoport-detail layoutot
(`group-detail-tabs` mintára), de **csak olvasható**:
- **Ranglista** tab: szűrt, körön belül rangsorolt lista + hivatalos-rang badge.
- **Eredmények** tab: szűrt befejezett-meccs tippek.
- **Nincs** tét-form, szabály-dialógus, token-összegző, dobogó-tipp.
- Header: kör neve + tournament neve + meghívókód badge (a meglévő `InviteCodeBadge`).
- Member-check: nem tag → `notFound()`.

### `/circles` kezelőoldal — új route `app/[locale]/circles/page.tsx`
- Köreim listája (név, tagszám, owner jelölés).
- „Új kör" gomb → `app/[locale]/circles/new/page.tsx` (egyszerű név-mező, a
  `create-group-form` mintájára, de szabály-mezők nélkül).
- Körönként meghívókód, tagok, kilépés/törlés.
- Elérhető a fő navigációból (a „Csoportok" mellett vagy almenüben).

### Csatlakozás (`app/[locale]/join/[code]/page.tsx`)
A meglévő join-oldal kibővítve: a kódot először csoportként keressük; ha nincs, **körként**
(`getCircleByInviteCode`). Sikeres körcsatlakozás → `joinCircle` (csak tagság, semmi token),
majd redirect a `/circles`-re vagy a kör egy aktív tournamentbeli nézetére.

## 9. Hibakezelés és élek

- **Nincs hivatalos csoport / nincs adat egy tournamentnél:** a kör nézete üres állapotot
  mutat („még senki nem tippelt"), nem hibázik.
- **Egytagú kör:** a tag rangsora 1/1; érvényes.
- **Tag aki nem nyitotta meg a tournamentet:** nem szerepel az adott tournament szűrt
  listájában (nincs hivatalos tagsága ott). Ez szándékos.
- **Slug ütközés:** `slugify` + ütközés esetén suffix (a meglévő csoport-mintát követve).
- **Meghívókód ütközés a csoport- és kör-kódok között:** a `generateInviteCode` random
  tér elég nagy; a join elsőként csoportot, utána kört keres — egyértelmű feloldás.

## 10. Tesztelés

- **Unit (pure):** `filterAndRerankLeaderboard` — szűrés, körön belüli rangsor, hivatalos
  rang megőrzése, holtverseny, üres lista, egytagú kör.
- **Integráció (query):** `getUserCircles`, `getCircleBySlug`, member-id szűrés helyessége.
- A tét/scoring/token logikát **nem** érinti (a kör nem ír ledgert), így ott nincs regresszió.

## 11. Megnyitott kérdések

Nincs — minden nyitott döntés lezárva a brainstorming során (hatókör: tournamenteken
átívelő tagság, per-tournament szűrt nézet; rangsor: mindkettő; láthatóság: privát, kóddal).
