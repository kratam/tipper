# Spec: Csoportajánlás — nincs csoport állapot

**Dátum:** 2026-04-06  
**Státusz:** Jóváhagyva

## Összefoglalás

Ha a felhasználó egy versenysorozat oldalán jár, de egyetlen csoportnak sem tagja, a rendszer megmutatja a top 2 legnagyobb nyilvános csoportot (vagy fallbacket), és lehetővé teszi az egyéni csatlakozást anélkül, hogy el kellene hagyni az oldalt. Ugyanez jelenik meg a tippelős modálban is (1 csoporttal).

## Érintett fájlok

- `src/queries/groups.ts` — új query
- `src/app/[locale]/tournaments/[slug]/page.tsx` — feltételes fetch, új prop
- `src/components/tournament-tabs.tsx` — új prop átvétel és továbbítás
- `src/components/group-token-summary.tsx` — "nincs csoport" banner
- `src/components/bet-dialog.tsx` — "nincs csoport" állapot a modálban
- `messages/hu.json` + `messages/en.json` — új i18n kulcsok

## Adatmodell

```ts
interface PublicGroupSuggestion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  oddsBoost: number;
  tournament: {
    name: string;
    slug: string;
    status: string;
  };
}
```

## 1. Új query: `getTopPublicGroupsForTournament`

```ts
getTopPublicGroupsForTournament(
  userId: string,
  tournamentId: string,
  limit: number
): Promise<PublicGroupSuggestion[]>
```

- Csak `isPublic = true` csoportok
- Csak az adott `tournamentId`-hez tartozók
- Kizárja azokat a csoportokat, amelyeknek a user már tagja
- Tagok száma szerint csökkenő sorrendben
- `limit` darabot ad vissza (tournament page: 2, bet dialog: 1)

Megvalósítás: kiterjeszti a meglévő `getPublicGroups` logikát tournament + order szűrőkkel.

## 2. Tournament page (`tournaments/[slug]/page.tsx`)

- Ha `relevantGroups.length === 0`: fetcheli `getTopPublicGroupsForTournament(user.id, tournament.id, 2)`
- Ha `relevantGroups.length > 0`: nem fetcheli (nincs teljesítményhatás)
- Az eredményt `topPublicGroups` propként adja át a `TournamentTabs`-nek

## 3. TournamentTabs (`tournament-tabs.tsx`)

- Új opcionális prop: `topPublicGroups?: PublicGroupSuggestion[]`
- Továbbítja `GroupTokenSummary`-nak és `BetDialog`-nak

## 4. GroupTokenSummary (`group-token-summary.tsx`)

**Ha `groups.length > 0`:** változatlan

**Ha `groups.length === 0`:** a jelenlegi `return null` helyett banner jelenik meg

### Ág 1: van legalább 1 publikus csoport

```
┌─────────────────────────────────────────────────┐
│ Még nem vagy tagja egyetlen csoportnak sem.     │
│ Csatlakozz és versenyezz!                       │
│                                                 │
│  ┌──────────────────┐  ┌──────────────────┐     │
│  │  [GroupCard]     │  │  [GroupCard]     │     │
│  │  variant=public  │  │  variant=public  │     │
│  └──────────────────┘  └──────────────────┘     │
│                                                 │
│  [ Csoportok böngészése → ]  (Link /groups)     │
└─────────────────────────────────────────────────┘
```

- `GroupCard` `variant="public"` + `onClick` → `PublicGroupDialog` nyílik
- `PublicGroupDialog` join után `router.refresh()` → oldal újrarenderel → banner eltűnik

### Ág 2: nincs egyetlen publikus csoport sem

```
┌─────────────────────────────────────────────────┐
│ Még nincs aktív csoport ehhez a               │
│ versenysorozathoz.                              │
│                                                 │
│  [ + Csoport létrehozása ]  (Link /groups/new)  │
└─────────────────────────────────────────────────┘
```

## 5. BetDialog (`bet-dialog.tsx`)

Csak akkor releváns, ha `groups.length === 0` ÉS a meccs még nem kezdődött el.

**Ha van legalább 1 publikus csoport:**

```
┌──────────────────────────────────────────┐
│ Canada vs Sweden                  [×]   │
│──────────────────────────────────────────│
│ Még nem vagy tagja csoportnak.           │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  [GroupCard] — legtöbb taggal     │  │
│  │  variant=public, onClick → dialog │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ Csoportok böngészése → ]              │
└──────────────────────────────────────────┘
```

**Ha nincs publikus csoport:**

```
│ Még nincs aktív csoport.                 │
│ [ + Csoport létrehozása ]                │
```

- 1 csoport (helyszűke miatt)
- `PublicGroupDialog` a BetDialog fölé nyílik (mindkettő portal → nincs nesting probléma)
- Join után `router.refresh()` → BetDialog bezáródik, oldal újrarenderel bet formmal

## 6. i18n kulcsok

### `tournaments` namespace

| Kulcs | HU | EN |
|-------|----|----|
| `noGroupYet` | `Még nem vagy tagja egyetlen csoportnak sem. Csatlakozz és versenyezz!` | `You're not a member of any group yet. Join and compete!` |
| `noGroupYetShort` | `Még nem vagy tagja csoportnak.` | `You're not a member of any group yet.` |
| `noPublicGroup` | `Még nincs aktív csoport ehhez a versenysorozathoz.` | `No active groups for this tournament yet.` |
| `browseGroups` | `Csoportok böngészése` | `Browse groups` |
| `createGroup` | `Csoport létrehozása` | `Create a group` |

## Re-render stratégia

A `PublicGroupDialog.handleJoin()` már meghívja `router.refresh()`-t. Ez az App Router szerverodalon újrafuttatja az adatfetchelést, a tournament page újrarenderel, és:
- `relevantGroups` immár tartalmazza az új csoportot
- `GroupTokenSummary` a banner helyett a csoport kártyát mutatja
- `BetDialog` immár bet formot mutat

Nincs szükség külön state kezelésre.

## Szélső esetek

- Ha a user csatlakozik, de a `router.refresh()` késik → a dialog bezárt, az oldal a régi állapotot mutatja rövid ideig (elfogadható, Next.js refresh gyors)
- Ha a tournament `finished` státuszú → a `getTopPublicGroupsForTournament` szűri-e? Nem szükséges külön szűrő, mert finished tournament esetén a relevant groups logika amúgy sem mutat tippelős formot
- Ha a user már tagja a csoportnak (race condition) → a `joinPublicGroup` action kezeli (már meglévő error handling)
