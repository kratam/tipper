# Hivatalos csoport tournamentenként — design

**Dátum:** 2026-05-03
**Státusz:** approved
**Szerző:** brainstorming session

## Probléma és cél

Jelenleg minden bet egy `(userId, matchId, groupId)` hármashoz tartozik, és a token ledger + leaderboard csoport-scoped. Új felhasználó csak akkor tud tippelni, ha előbb csoportot hoz létre vagy meghívóval csatlakozik egyhez. Két fájdalom:

1. **Onboarding-súrlódás** — új user megnyit egy tournamentet, de zsákutca: "Még nincs csoportod ehhez a versenysorozathoz." Csoport-létrehozás vagy public group ajánlás kötelező lépés a tipplerakás előtt.
2. **Nincs globális ranglista** — nem lehet összevetni a játékosokat tournament-szinten, csak baráti csoportokon belül.

A megoldás egy **hivatalos csoport tournamentenként**: minden versenysorozatnak van egy "Hivatalos" csoportja, amibe a felhasználó az első tournament page látogatáskor transzparensen, automatikusan csatlakozik. Ez egyszerre default tipp-felület új usereknek és globális ranglista mindenkinek.

## Tervezési döntések

### Owner: system user + `isOfficial` flag

A hivatalos csoport tulajdonosa egy speciális system user (`email='system@tippcasino.local'`, `name='TippCasino'`, `isAdmin=true`). Ez:

- Nincs séma-refaktor a `groups.ownerId` FK-n (notNull marad)
- Nincs "Krasser Tamás csoportja" típusú szemantikai furcsaság
- A system user nem szerepel a `group_members` táblában (a hivatalos csoport létrehozásakor explicit kihagyjuk a creator-tagság insertet)
- A védelmet egy új `groups.isOfficial: boolean` flag adja

A `groups.ownerId === user.id` ellenőrzéseket kibővítjük `isOfficial=true` esetén: bármely admin szerkesztheti.

### Lazy auto-join, nem eager

Új user signup-jakor NEM lépünk be minden tournamenten az official csoportba. Helyette **első tournament-page látogatáskor** automatikusan csatlakozik (transzparens, a UI nem mutat join lépést). Indok:

- A `group_members` tábla nem hizlalódik inaktív userekkel
- A leaderboard csak az aktív, érdeklődő játékosokat mutatja (nem 0-pontos fantom tagok ezreit)
- A tournament listapage látogatás (`/tournaments`) nem trigger — csak a detail page

Plusz safety net a `placeBet` action-ben (ha furcsa flow-n tippelne valaki tagság nélkül).

### Auto-creation tournament-create flow-ban

Admin tournament létrehozásakor (`actions/admin.ts`) a tournament insert után rögtön létrejön a hivatalos csoport is, ugyanabban a flow-ban. Nincs külön "Hivatalos csoport létrehozása" gomb — minden tournamentnek per definíció van hivatalos csoportja, nem opcionális.

### UI: pinned első hely + badge

A tournament detail page tetején külön blokkban jelenik meg a hivatalos csoport (saját token-egyenleg, mini leaderboard, badge). A user saját csoportjai ez alatt jönnek. A meccs-tipp formoknál a hivatalos sor mindig első.

A mai "no groups → public group ajánlás" zsákutca lecserélődik: új user mindig lát egy működő hivatalos felületet. (A public group ajánlás megmarad a hivatalos blokk alatt, ha a user-nek nincs saját csoportja erre a tournamentre.)

## Schema változás

### Új oszlop a `groups` táblán

```sql
ALTER TABLE groups ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT FALSE;
```

Drizzle definíció:

```typescript
isOfficial: boolean("is_official").default(false).notNull(),
```

### System user létrehozása

Idempotens migráció:

```sql
INSERT INTO users (email, google_id, name, is_admin, display_name)
VALUES (
  'system@tippcasino.local',
  'system',
  'TippCasino',
  true,
  'TippCasino'
)
ON CONFLICT (email) DO NOTHING;
```

A system user-t e-mail alapján azonosítjuk runtime-ban (`SELECT id FROM users WHERE email='system@tippcasino.local'`). Egyszer cache-eljük process-szinten, mert változatlan.

### Backfill: meglévő tournamentek

Minden meglévő tournament-hez (status-tól függetlenül) létrejön a hivatalos csoport. Backfill SQL — lefut a deploy után egyszer:

```sql
INSERT INTO groups (
  name, slug, invite_code, owner_id, tournament_id,
  token_per_match, initial_tokens,
  bonus_goal_diff, bonus_exact_score,
  bonus_podium_mention, bonus_podium_exact,
  odds_boost, is_public, is_official
)
SELECT
  'Hivatalos',
  'hivatalos',
  -- véletlen invite_code (nem használjuk hivatalosnál, de unique notNull)
  encode(gen_random_bytes(6), 'hex'),
  (SELECT id FROM users WHERE email='system@tippcasino.local'),
  t.id,
  100, 200, 5, 10, 20, 20, 1.1, true, true
FROM tournaments t
WHERE NOT EXISTS (
  SELECT 1 FROM groups g
  WHERE g.tournament_id = t.id AND g.is_official = true
);
```

Tagokat NEM backfilleljük — a lazy auto-join majd megoldja látogatáskor.

## Default settings hivatalos csoportokhoz

| Mező                 | Érték        | Megjegyzés                                       |
|----------------------|--------------|--------------------------------------------------|
| `tokenPerMatch`      | 100          | sima group default                               |
| `initialTokens`      | 200          | sima group default                               |
| `bonusGoalDiff`      | 5            |                                                  |
| `bonusExactScore`    | 10           |                                                  |
| `bonusPodiumMention` | 20           |                                                  |
| `bonusPodiumExact`   | 20           |                                                  |
| `oddsBoost`          | **1.1**      | enyhe boost, de mérsékelt — fair globális ranglista |
| `isPublic`           | true         | leaderboard nyilvános                            |
| `description`        | null         | admin utólag kitölti ha akarja                   |
| `name`               | "Hivatalos"  |                                                  |
| `slug`               | "hivatalos"  | tournament-szintű unique, nem ütközik            |
| `isOfficial`         | true         | flag                                             |

## Komponensek és változások

### Új modul: `src/lib/official-group.ts`

Pure logika és helper függvények:

- `SYSTEM_USER_EMAIL = 'system@tippcasino.local'`
- `RESERVED_OFFICIAL_NAMES = ['hivatalos', 'official']` (slug-szinten)
- `getSystemUserId()` — process-szintű cache, lazy lookup `users` táblából
- `createOfficialGroup(tournamentId)` — beilleszti a hivatalos csoportot a fenti default settingekkel; `inviteCode`-ot a meglévő `generateInviteCode()` adja (unique notNull miatt kell, de hivatalos csoporthoz nem használjuk meghívásra); nem ad member sort a system usernek
- `ensureOfficialMembership(userId, tournamentId)` — idempotens; megnézi van-e `group_members` sor a tournament hivatalos csoportjánál, ha nincs: insert + `distributeInitialTokens` (létező catch-up logika hívása)

A `distributeInitialTokens` jelenleg privát helper a `actions/groups.ts`-ben — **át kell mozgatni** `lib/official-group.ts`-be (vagy `lib/tokens.ts`-be), hogy `ensureOfficialMembership` is hívhassa. Ez egy kis refaktor, a `actions/groups.ts` is innen importálná utána.

### `actions/admin.ts` — tournament-create

A `createTournament` action-ben a tournament insert után rögtön `createOfficialGroup(tournament.id)` hívás. **Sequential insert**, nem tranzakció — a Neon HTTP driver (`drizzle-orm/neon-http`) nem támogat transaction-t. Ha a második insert elhasal, az admin retry-olhatja vagy a backfill SQL újraidempotens (ON CONFLICT-szerűen `WHERE NOT EXISTS` a `is_official=true` flag-en).

### `actions/groups.ts` változások

- `createGroup`: a `slugify(input.name)` kimenetét pontos egyezésre nézzük (`===`) a `RESERVED_OFFICIAL_NAMES` listán. Ha egyezik → throw `"officialGroupNameReserved"`. (Tehát "Hivatalos VIP" → slug "hivatalos-vip" → engedélyezett. Csak az exact "hivatalos" / "official" slug blokkolt.)
- `deleteGroup`: ha `group.isOfficial` → throw `"cannotDeleteOfficial"`.
- `leaveGroup`: ha `group.isOfficial` → throw `"cannotLeaveOfficial"`.
- `updateGroupSettings`: az ownership check kibővül:
  ```typescript
  const canEdit = group.ownerId === user.id || (user.isAdmin && group.isOfficial);
  if (!canEdit) throw new Error("Unauthorized");
  ```

### `actions/bets.ts` — safety net

A `placeBet` action elején, a membership check előtt: ha a target group `isOfficial=true` és nincs membership → `ensureOfficialMembership(user.id, group.tournamentId)` hívás. Csak ezután fut a normál membership lookup.

### Tournament detail page (`src/app/[locale]/tournaments/[slug]/page.tsx`)

A `getCurrentUser()` után, a Phase 2 párhuzamos data fetch előtt:

```typescript
await ensureOfficialMembership(user.id, tournament.id);
```

Idempotens, de minden cold visit egy SELECT + (esetleg) INSERT. Acceptable.

A `relevantGroups` szétválasztása a UI-ban:
- `officialGroup`: `relevantGroups.find(gm => gm.group.isOfficial)`
- `userGroups`: `relevantGroups.filter(gm => !gm.group.isOfficial)`

### Query módosítások

- `getTopPublicGroupsForTournament` (`src/queries/groups.ts`): WHERE `isOfficial = false` hozzá. Különben magát ajánlaná.
- `getPublicGroups`: ugyanaz — WHERE `isOfficial = false`.
- `getUserGroups`: változatlan; a hívók szétválasztják.
- `getGroupLeaderboard`: változatlan — csak az auto-joined userek látszanak, ami szándékos.

### UI komponensek

- **Új komponens**: `OfficialGroupCard` — pinned blokk a tournament page tetején. Tartalom: badge, name, saját token-balance + projected, mini leaderboard, link a `/tournaments/[slug]/groups/hivatalos` oldalra.
- **`tournament-tabs.tsx`**: a `groupBetInfosByMatch` rendezésnél a `isOfficial=true` csoportot mindig az elejére tesszük.
- **`group-detail-tabs.tsx`**: ha `group.isOfficial`:
  - "Csoport törlése" gomb elrejtve
  - "Csoport elhagyása" gomb elrejtve
  - "Beállítások" tab látszik akkor is ha `!isOwner`, ha `user.isAdmin`

### i18n kulcsok (hu.json + en.json)

```
officialGroup:               "Hivatalos" / "Official"
officialGroupSection:        "Hivatalos ranglista" / "Official leaderboard"
officialGroupBadge:          "Hivatalos" / "Official"
officialGroupNameReserved:   "Ez a név fenntartva" / "This name is reserved"
cannotLeaveOfficial:         "Hivatalos csoportból nem lehet kilépni" / ...
cannotDeleteOfficial:        "Hivatalos csoport nem törölhető" / ...
```

## Tesztek

### Unit (Vitest)

- `ensureOfficialMembership` idempotencia: kétszer hívás → egyetlen membership row, egyetlen distribution
- `createOfficialGroup` system user owner, member nélkül
- Név-konfliktus: `createGroup({ name: "Hivatalos" })` → throw
- `isOfficial` védelmek: `deleteGroup`, `leaveGroup` throw `isOfficial=true` esetén
- `updateGroupSettings`: admin szerkesztheti `isOfficial=true` csoportot, nem-admin nem

### E2E (későbbi, Playwright)

- Új user signup → tournament page nyit → hivatalos blokk látszik, tudja használni az összes form-ot
- Admin új tournament létrehozás → hivatalos csoport automatikusan létrejön

## Kihagyott (out-of-scope)

- **Leaderboard pagination** — ha valaha 1000+ aktív user lesz egy hivatalos csoportban
- **Tournament-create wizardban inline hivatalos csoport setting** — admin utólag a meglévő Settings tabon szerkeszti
- **Több hivatalos csoport per tournament** (pl. különböző szabályrendszerekkel) — tournament-szinten 1 hivatalos van, kész
- **Locale-specifikus hivatalos csoport név** (pl. EN userek "Official"-ként látnák) — i18n kulcs `isOfficial` flag alapján a UI-on, a DB név fix "Hivatalos"

## Migrációk

1. **Drizzle migration**: `groups.is_official` oszlop hozzáadása (`npm run db:generate`)
2. **Manuális SQL** (Neon MCP-vel a deploy előtt):
   - System user insert
   - Backfill — minden meglévő tournament-hez hivatalos csoport

A Vercel build nem futtatja a migrációkat (DB konvenció szerint), kézzel kell.
