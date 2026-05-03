# Nyilvános csoportok + leírás + kártya redesign

**Dátum:** 2026-04-04
**Státusz:** Elfogadva

## Összefoglaló

Nyilvános csoport opció, csoport leírás (markdown), csoportkártya vizuális redesign, és nyilvános csoportok szekció a groups oldalon.

## DB séma változások

Két új mező a `groups` táblán:

| Mező | Típus | Default | Leírás |
|------|-------|---------|--------|
| `isPublic` | `boolean` | `false` | Nyilvános csoport-e |
| `description` | `text` | `null` | Markdown leírás (opcionális) |

Migráció:
```sql
ALTER TABLE groups ADD COLUMN is_public boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN description text;
```

## Csoportkártya komponens (`GroupCard`)

Külön komponens (`src/components/group-card.tsx`), a jelenlegi inline Card helyett.

### Layout

- **Gradient header** (sötét, `linear-gradient(135deg, #1e3a5f, #2d1b69)`):
  - Bal oldal: csoport név (fehér, bold) + tournament név alatta (halványabb)
  - Jobb felső sarok: token badge (coin ikon + szám, félig áttetsző háttéren, amber szín)
- **Body** (fehér háttér):
  - Leírás első 2 sora (line-clamp, `text-muted-foreground`)
  - Alul: tagszám (Users ikon + szám) bal oldalon, tournament státusz badge jobb oldalon

### Státusz badge színek

- `aktív` → zöld (`bg-green-500/10 text-green-600`)
- `hamarosan` → sárga (`bg-yellow-500/10 text-yellow-600`)
- `befejezett` → szürke (`bg-muted text-muted-foreground`)

### Nyilvános kártya variáns

Saját kártyától való eltérések:
- **Dashed border** (`border-dashed`) a solid helyett
- **Globe ikon** a jobb felső sarokban a token badge helyett (nem vagy tag → nincs balance)
- Kattintásra: Dialog nyílik (nem navigál)

### Responsive grid

- Mobil (<640px): `grid-cols-1`
- Tablet (640px+): `grid-cols-2`
- Desktop (1024px+): `grid-cols-3`

Meglévő pattern: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

## Groups oldal felépítés

`src/app/[locale]/groups/page.tsx`

1. **Fejléc** — cím + "Új csoport" gomb (változatlan)
2. **Saját csoportok** — `GroupCard` grid a user tagságaival
3. **Elválasztó** — `<Separator />`
4. **Nyilvános csoportok szekció**
   - Fejléc: Globe ikon + "Nyilvános csoportok" cím + alcím
   - `GroupCard` grid (nyilvános variáns)

### Nyilvános csoportok query szűrése

```
WHERE isPublic = true
  AND tournament.status != 'finished'
  AND group.id NOT IN (user meglévő csoportjai)
```

Ha nincs találat, a szekció nem jelenik meg.

## Előnézet Dialog

Radix Dialog (Shadcn `Dialog` komponens), nyilvános kártyára kattintva nyílik.

### Tartalom

1. **Gradient header** — csoport név, tournament, tagszám, státusz badge
2. **Leírás szekció** — teljes markdown leírás renderelve
3. **Szabályok grid** — 2 oszlopos rács:
   - Token / meccs (`tokenPerMatch`)
   - Indulótőke (`initialTokens`)
   - Gólkülönbség bónusz (`bonusGoalDiff`)
   - Pontos eredmény bónusz (`bonusExactScore`)
   - Odds szorzó (`oddsBoost`)
   - Dobogó bónusz (`bonusPodiumMention`)
4. **Csatlakozás gomb** — teljes szélességű, meghívja a `joinPublicGroup` server action-t

### Csatlakozási logika

Új `joinPublicGroup(groupId: string)` server action:
- Ellenőrzi, hogy a csoport `isPublic = true`
- A meglévő `joinGroup` logikát használja belülről (groupMembers insert + distributeInitialTokens)
- Nem invite code alapú — groupId-vel dolgozik
- Sikeres csatlakozás után a dialog bezárul, a user a saját csoportjai között látja (revalidate)

## Markdown renderelés

Alap markdown támogatás a leíráshoz:
- **Félkövér**, *dőlt*, listák, linkek
- Library: `react-markdown` (lightweight, sanitized by default)
- Nincs kép, nincs kódblokk, nincs táblázat (szükségtelen)
- Alkalmazás: dialog leírás szekció + kártya body (truncated)

## Csoport létrehozás/szerkesztés

### Create form (`CreateGroupForm`)

Új mezők az alap szekcióban (nem az advanced settings-ben):
- **Nyilvános** toggle (`Switch` komponens) — default: ki
- **Leírás** textarea — opcionális, placeholder szöveggel

### Settings tab (`GroupDetailTabs`)

Ugyanaz a két mező hozzáadva a settings szekcióhoz.
Szerkeszthető akkor is, ha a tournament aktív (a leírás és nyilvános flag nem befolyásolja a játékot).

## i18n kulcsok

### `messages/hu.json`

```json
{
  "groups": {
    "publicGroups": "Nyilvános csoportok",
    "publicGroupsSubtitle": "Csatlakozz bármelyikhez egyetlen kattintással",
    "join": "Csatlakozás",
    "description": "Leírás",
    "rules": "Szabályok",
    "tokenPerMatch": "Token / meccs",
    "initialTokens": "Indulótőke",
    "bonusGoalDiff": "Gólkülönbség bónusz",
    "bonusExactScore": "Pontos eredmény",
    "oddsBoost": "Odds szorzó",
    "bonusPodium": "Dobogó bónusz",
    "public": "Nyilvános",
    "publicDescription": "Bárki csatlakozhat meghívó nélkül",
    "descriptionPlaceholder": "Írd le a csoportot (opcionális, markdown támogatott)",
    "preview": "Előnézet",
    "active": "aktív",
    "upcoming": "hamarosan",
    "finished": "befejezett",
    "memberCount": "{count} tag"
  }
}
```

### `messages/en.json`

Angol megfelelők ugyanezekre a kulcsokra.

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `src/db/schema.ts` | `isPublic`, `description` mezők |
| `src/components/group-card.tsx` | **Új** — GroupCard komponens |
| `src/components/public-group-dialog.tsx` | **Új** — előnézet dialog |
| `src/app/[locale]/groups/page.tsx` | Kártya csere + nyilvános szekció |
| `src/queries/groups.ts` | `getPublicGroups` query |
| `src/actions/groups.ts` | `joinPublicGroup` action + create/update bővítés |
| `src/components/create-group-form.tsx` | isPublic toggle + description textarea |
| `src/components/group-detail-tabs.tsx` | Settings bővítés |
| `messages/hu.json` | Új i18n kulcsok |
| `messages/en.json` | Új i18n kulcsok |
| Drizzle migráció | `isPublic` + `description` oszlopok |

## Nem scope

- Tournament-specifikus gradient szín (egyelőre univerzális)
- Keresés/szűrés a nyilvános csoportok között
- Taglétszám limit
- Csoport moderáció / report
