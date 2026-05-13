# Versenysorozat archiválás

> **Dátum:** 2026-05-13
> **Státusz:** Tervezet

## Cél

Lehetőséget adni adminnak, hogy lezárult (`finished`) versenysorozatokat archiváljon. Az archivált versenysorozatok eltűnnek a publikus listákból (főleg `/tournaments`), de a korábbi csoporttagok továbbra is hozzáférnek a saját csoportjaikhoz egy külön szekcióban a `/groups` oldalon.

## Háttér

Jelenleg minden valaha létrehozott versenysorozat megjelenik a `/tournaments` oldalon, akár évek óta lezárt is. Ez idővel tele lesz régi, irreleváns tartalommal. Az archiválás megoldja ezt anélkül, hogy bármilyen adatot törölnénk — a meccsek, tippek, ranglisták továbbra is elérhetők a csoportjaik linkjén keresztül.

## Tervezési döntések

### 1. Külön `isArchived` flag, nem új enum érték

A `tournament_status` enum (`upcoming | active | finished`) érintetlen marad. Új boolean oszlop kerül a `tournaments` táblára: `is_archived`.

**Indoklás:** Az archivált állapot ortogonális a státuszhoz — ha egy enum érték lenne, elveszne az információ hogy a versenysorozat befejezett. A cron-ok és scoring logika a státuszt nézi, ezeket nem szabad érinteni.

### 2. Csak `finished` versenysorozat archiválható

Az UI csak akkor mutat archiválás gombot, ha `status === "finished"`. Visszaállítás (`un-archive`) bármikor lehetséges.

**Indoklás:** Aktív/upcoming versenysorozat archiválása konfúz lenne — a háttér cron folytatná a pontozást, de a UI-on nem látszana. A 99% use case lezárt esemény elrejtése.

### 3. Unlisted hozzáférés a detail page-hez

Az archivált tournament `/tournaments/[slug]` URL továbbra is mindenkinek elérhető. Csak a listákból tűnik el.

**Indoklás:** Az archiválás célja a UI tisztítása, nem hozzáférés-korlátozás. Régi share-elt linkek nem törnek el.

### 4. Csoportok megjelenítése `/groups`-on

Az aktív és archivált csoportok ugyanazon az oldalon, de külön szekcióban:

- Felső szekció: aktív csoportok (változatlan UI)
- Alsó szekció: collapsible "Archivált versenysorozatok" (default csukott), csak akkor renderelt ha van legalább 1 archivált csoporttagság

**Indoklás:** Egy oldal, egy navigáció. A user kérte hogy "külön elérhető" legyen — a collapsible kiemeli őket az aktívak közül, anélkül hogy elveszne a kontextus.

## Implementáció

### Séma

```typescript
// src/db/schema.ts
export const tournaments = pgTable("tournaments", {
  // ... meglévő mezők
  isArchived: boolean("is_archived").default(false).notNull(),
  // ...
});
```

Migráció: `drizzle/0002_tournament_archive.sql`

```sql
ALTER TABLE "tournaments" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
```

Futtatás Neon MCP-vel (deploy előtt manuálisan, a CLAUDE.md-ben leírt mintát követve).

### Queries (`src/queries/tournaments.ts`)

```typescript
export async function getTournaments(opts?: { includeArchived?: boolean }) {
  return db.query.tournaments.findMany({
    where: opts?.includeArchived ? undefined : eq(tournaments.isArchived, false),
    orderBy: [desc(tournaments.createdAt)],
  });
}

export async function getActiveTournaments() {
  return db.query.tournaments.findMany({
    where: and(ne(tournaments.status, "finished"), eq(tournaments.isArchived, false)),
    orderBy: [desc(tournaments.createdAt)],
    columns: { id: true, name: true, slug: true, status: true },
  });
}
```

### Queries (`src/queries/groups.ts`)

`getPublicGroups()` és `getTopPublicGroupsForTournament()` — már szűr `isPublic` + nem-member alapon, hozzáadni `tournaments.isArchived = false` szűrőt. Mivel a `groups` táblán nincs `tournaments` join alapból, vagy:

- Opció A: subquery az `IN (SELECT id FROM tournaments WHERE is_archived = false)` mintával
- Opció B: a query API-val `with: { tournament: { ... } }` clause-on át nem lehet szűrni, így inkább raw `inArray` az archivált tournamentekre, vagy `innerJoin`

A legtisztább: `db.select().from(groups).innerJoin(tournaments, ...)`. De a meglévő minta `db.query.groups.findMany` — ennél a tournament join utáni szűrés nehézkes. **Megoldás:** előbb lekérjük a nem-archivált tournament ID-kat, és `inArray(groups.tournamentId, nonArchivedIds)`-szel szűrünk.

### Server action (`src/actions/admin.ts`)

```typescript
export async function setTournamentArchived(tournamentId: string, isArchived: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  if (isArchived) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.status !== "finished") {
      throw new Error("Only finished tournaments can be archived");
    }
  }

  await db.update(tournaments).set({ isArchived }).where(eq(tournaments.id, tournamentId));
}
```

### Admin UI (`src/components/admin-panel.tsx`)

- Tournament fejléc mellett "Archivált" badge ha `isArchived`
- Új gomb finished státusznál: "Archiválás" → confirm dialog → `setTournamentArchived(id, true)`
- Új gomb archivált tournament-nél: "Visszaállítás" → `setTournamentArchived(id, false)`

### `/admin/page.tsx`

`getTournaments({ includeArchived: true })` — admin lássa az összeset.

### `/tournaments/page.tsx`

Nincs változás — `getTournaments()` defaultja kiszűri az archiváltakat.

### `/groups/new/page.tsx`

Nincs változás — `getTournaments()` defaultja kiszűri az archiváltakat. A meglévő `status !== "finished"` filter maradhat.

### `/groups/page.tsx`

```typescript
const activeMemberships = memberships.filter((gm) => !gm.group.tournament.isArchived);
const archivedMemberships = memberships.filter((gm) => gm.group.tournament.isArchived);
```

Új komponens: `src/components/archived-groups-section.tsx` — Shadcn `<Collapsible>`-t használ. Default csukott. Header: "Archivált versenysorozatok ({count})". Tartalom: ugyanaz a `<GroupCard variant="own">` rács.

### Header dropdown

Nincs változás — `getActiveTournaments()` már szűri.

### i18n (`messages/hu.json`, `messages/en.json`)

Új kulcsok:
- `admin.archive`: "Archiválás" / "Archive"
- `admin.unarchive`: "Visszaállítás" / "Restore"
- `admin.archivedBadge`: "Archivált" / "Archived"
- `admin.archiveConfirm`: "Biztosan archiválod ezt a versenysorozatot? Csak a listákból tűnik el." / "Are you sure you want to archive this tournament? It will only be hidden from listings."
- `groups.archivedTournaments`: "Archivált versenysorozatok" / "Archived tournaments"

## Cron / sync — nincs változás

Csak `finished` versenysorozat archiválható, és minden cron `status in ('active', 'upcoming')` szerint szűr. Az archivált tournament-ek eleve nem érintettek.

## Tesztelés

- Nincs új pure logika → új Vitest unit teszt nem indokolt.
- E2E (Playwright) TODO marad a meglévő `TODO.md` szerint.
- Manuális validáció: `npm run check` + `npm run build`.

## Fájl változások

**Új:**
- `drizzle/0002_tournament_archive.sql` (generated)
- `src/components/archived-groups-section.tsx`
- `docs/superpowers/specs/2026-05-13-tournament-archive-design.md` (ez a doc)

**Módosított:**
- `src/db/schema.ts` — `isArchived` mező
- `src/queries/tournaments.ts` — `getTournaments` paraméter, `getActiveTournaments` szűrő
- `src/queries/groups.ts` — `getPublicGroups`, `getTopPublicGroupsForTournament` szűrő
- `src/actions/admin.ts` — `setTournamentArchived` action
- `src/components/admin-panel.tsx` — archive/unarchive gomb + badge
- `src/app/[locale]/admin/page.tsx` — `includeArchived: true`
- `src/app/[locale]/groups/page.tsx` — szekciókra bontás
- `messages/hu.json`, `messages/en.json` — új kulcsok

## Dokumentáció

A `CLAUDE.md` és `ARCHITECTURE.md` nem említi explicit a tournament státuszokat olyan kontextusban, ami most outdated lenne. A `TODO.md`-ben nem szerepel — itt sincs frissítés szükség. Az archiválást a séma változás (`isArchived` mező a 11 tábla közül a `tournaments` táblán) reflektálja az `ARCHITECTURE.md`-ben → frissítendő.
