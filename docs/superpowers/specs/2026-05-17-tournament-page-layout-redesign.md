# Tornaoldal layout redesign — Slim ribbon, egyesített tab sor, "Ranglista" átnevezés

**Dátum:** 2026-05-17
**Érintett oldal:** `/tournaments/[slug]`

## Háttér

A jelenlegi `/tournaments/[slug]` oldalon a meccsek (a leggyakrabban használt funkció) túl lent kezdődnek. Felül a "Hivatalos" csoport kártya kb. 6 sornyi helyet foglal — odds szorzó, helyezés, profit, figyelmeztetés és 3 soros mini ranglista. Alatta egy felsőszintű `Tabs` (Meccsek / Dobogós tipp), majd egy másik tab sor (Közelgő / Lejátszott / Mind). Az oldal így 2 tab sort és egy nagy kártyát húz le, mielőtt a tényleges meccs accordion-höz érne.

Másodlagos észrevétel: a "Hivatalos" megnevezés zavaró. Mivel minden játékos automatikusan tagja a hivatalos csoportnak (`ensureOfficialMembership` minden tornaoldal-megnyitáskor), a "csoport" elnevezés sem teljesen pontos — valójában ez a tornához tartozó közös ranglista.

## Cél

1. A meccsek (tippelési felület) a lehető legmagasabbra kerüljenek.
2. A ranglista funkció megmaradjon, de csak egy kattintásra elérhető legyen.
3. A "Hivatalos" megnevezés "Ranglista"-ra változzon az egész UI-ban, a megkülönböztető korona ikon megmarad.

## Változások

### 1. `OfficialGroupCard` → `OfficialGroupRibbon`

Új komponens: `src/components/official-group-ribbon.tsx`.
A régi `src/components/official-group-card.tsx` törlésre kerül.

**Csukott állapot (default — egyetlen sor):**

```
👑   #9 · -186   ⚠ 36 nem tippeltél                            Részletek →   ▾
```

A bal oldali sorrend változatlan minden méreten. A jobb oldali `Részletek →` link mobile-on (`< sm`) eltűnik, helyette a teljes ribbon kattintható; a chevron jobb szélen marad. A "Hivatalos" badge eltűnik — csak a korona ikon szolgál megkülönböztetésként.

Ha `unbettedCount === 0`:

```
👑   #9 · -186   ✓ Minden tipp leadva                          Részletek →   ▴
```

**Nyitott állapot:** a fenti sor + alatta a jelenlegi tartalom:
- `Odds szorzó: ×1.1` (csak nyitva látszik, csukva felesleges info)
- Mini leaderboard 3 sor

A komponens props változatlan (`OfficialCardData` interface), csak a render struktúrája változik.

**State perzisztencia:**

- localStorage kulcs: `tipper:officialRibbon:open` (string `"true"` vagy `"false"`)
- Default: `false` (csukva)
- Hidratálási sorrend: SSR-en mindig `closed` (avoid hydration mismatch), kliens oldalon `useEffect`-ben olvasva a localStorage-ból állítjuk be a kezdeti `open` state-et
- A11y: `aria-expanded` a ribbon gombon, `aria-controls` a lenyitható panelen

### 2. Két tab sor → egyetlen 4-elemes szűrősor

A `tournament-tabs.tsx` jelenlegi struktúrája:

```
Tabs (Meccsek | Dobogós tipp)
  TabsContent "matches":
    GroupTokenSummary
    Filter (Közelgő | Lejátszott | Mind)
    Accordion of MatchCard
  TabsContent "podium":
    PodiumForm
```

Új struktúra:

```
GroupTokenSummary
Filter (Közelgő | Lejátszott | Mind | Dobogós tipp [✓|🔒])
  ha view === "podium": PodiumForm
  egyébként:           Accordion of MatchCard
```

- A felső szintű Shadcn `Tabs` komponens eltűnik ebből a fájlból.
- A `MatchFilter` típus kibővül: `"upcoming" | "played" | "all" | "podium"`.
- A `GroupTokenSummary` csak meccs-nézetekben jelenik meg (`view !== "podium"`). Podium tabnál nem releváns.
- A "Dobogós tipp" tab vizuális állapotjelzői:
  - Ha `existingPodiumBet !== null` → `✓` ikon mellé (lock előtt és után is)
  - Ha `isLocked && !existingPodiumBet` → `🔒` ikon mellé
  - Egyébként nincs ikon

### 3. "Hivatalos" → "Ranglista" átnevezés

A DB-konstans, a frontend felirat és a UI badge következetesen átáll.

**DB / kód konstansok (`src/lib/official-group.ts`):**

```ts
export const OFFICIAL_GROUP_NAME = "Ranglista";    // volt: "Hivatalos"
export const OFFICIAL_GROUP_SLUG = "hivatalos";    // VÁLTOZATLAN — URL stabilitás miatt
export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official", "ranglista"] as const;
```

A `slug` szándékosan változatlan marad — a meglévő `/tournaments/{x}/groups/hivatalos` URL-ek nem törnek. A `ranglista` slug felkerül a fenntartott listára, hogy más csoport ne foglalhassa el.

**DB migration:**

```sql
UPDATE groups SET name = 'Ranglista' WHERE is_official = true AND name = 'Hivatalos';
```

Drizzle migration fájlként generálva (`db:generate` → custom SQL). A `slug` mező nem érintett.

**Frontend változások:**

- `OfficialGroupRibbon`: a "Hivatalos" badge eltűnik. A nyitott állapot fejléce: `👑 Ranglista` (a `groupName` prop-ot használjuk, ami immár "Ranglista" lesz a DB-ből).
- Csoport detail oldal címe (`tournaments/[slug]/groups/[gSlug]/page.tsx`): a `<h1>{group.name}</h1>` automatikusan "Ranglista"-t fog kiírni (mert a DB név változik). Plusz módosítás nem kell.

**i18n változások (`messages/hu.json` és `messages/en.json`):**

- `groups.officialBadge` kulcs törlésre kerül — egyik komponens sem használja a változás után.
- `groups.officialGroupNameReserved` érték frissül: "Ez a név fenntartva a ranglistának" / "This name is reserved for the leaderboard". A validáció (`actions/groups.ts`-ben) ellenőrzi: új csoport neve nem lehet "Hivatalos" vagy "Ranglista" (case-insensitive). Plusz teszt.
- `groups.cannotDeleteOfficial` érték frissül: "A ranglista nem törölhető" / "The leaderboard group cannot be deleted".
- `groups.cannotLeaveOfficial` érték frissül: "A ranglistából nem lehet kilépni" / "Cannot leave the leaderboard group".
- Új kulcs: `tournaments.officialRibbon.expand` ("Ranglista mutatása") és `tournaments.officialRibbon.collapse` ("Elrejtés") aria-label-ekhez.
- Új kulcs: `tournaments.podiumTab.submitted` ("Leadva") és `.locked` ("Lezárva") — screen reader szöveg a `✓` / `🔒` ikonokhoz.

## Implementációs lépések

1. **DB konstans + migration**
   - `src/lib/official-group.ts`: `OFFICIAL_GROUP_NAME` átnevezése, `RESERVED_OFFICIAL_SLUGS` bővítése.
   - `npm run db:generate` → új migration fájl `drizzle/`-ben (custom SQL: `UPDATE groups SET name = 'Ranglista' WHERE is_official = true`).
   - `npm run db:migrate` lokálisan (dev branch) — production deploy előtt szintén kézzel.
2. **Új komponens: `OfficialGroupRibbon`**
   - `src/components/official-group-ribbon.tsx` létrehozása a csukott + nyitott állapotú render-rel és a localStorage perzisztenciával.
   - Custom hook a localStorage state-hez: `src/hooks/use-persisted-state.ts` (ha még nincs ilyen — gyors check). Ha van hasonló, használjuk.
3. **`tournament-tabs.tsx` átalakítása**
   - Shadcn `Tabs/TabsList/TabsContent` import törlése.
   - `MatchFilter` típus bővítése: `"podium"` is.
   - Filter sor 4. gombbal (Dobogós tipp), állapotjelzők (✓/🔒).
   - Conditional render: `view === "podium"` → `PodiumForm`, egyébként Accordion.
   - `OfficialGroupCard` import csere `OfficialGroupRibbon`-ra.
4. **Régi komponens törlése**
   - `src/components/official-group-card.tsx` törlése.
   - Bárhol más helyen használt-e? Grep és frissítés.
5. **i18n + validáció**
   - `messages/hu.json` és `messages/en.json` frissítése.
   - `officialBadge` kulcs törlése (a használatait `OfficialGroupRibbon`-ban már kiütöttük).
   - `actions/groups.ts` validáció: ne lehessen csoport név "Hivatalos" vagy "Ranglista" — case-insensitive ellenőrzés.
6. **Tesztek (Vitest)**
   - `official-group-ribbon.test.tsx`: alapból csukva, kattintás → nyit, localStorage perzisztencia.
   - `tournament-tabs.test.tsx`: `view === "podium"` esetén PodiumForm rendereződik, MatchCard nem; `view === "upcoming"` esetén fordítva. Filter gombok visual state-je.
   - Group name validation: "Ranglista" és "Hivatalos" mindkettő foglalt.

## Mobile responsive

- Ribbon csukva: `flex-wrap` a tartalom közepén ha nem fér ki, de a gyakori tartalom (`👑 #9 · -186 · ⚠36 · ▾`) 320 px körüli vissza-számolva is elférne. A `Részletek →` link `hidden sm:inline` (mobile-on a teljes ribbon kattintható, a chevron jelzi a viselkedést).
- Filter sor: a 4 gomb `flex-1` eloszlással, `text-sm` (asztal) / `text-xs` (mobile). A "Dobogós tipp" felirat marad teljes alakban (két szó: az állapotjelző `✓`/`🔒` ikon a felirat után kerül). Ha 320 px szélességen nem fér el `text-xs`-szel sem, akkor a tippelés-tab használja a `tournaments.podium` rövidített kulcsát (jelenleg "Dobogós tipp" — szükség esetén `tournaments.podiumShort: "Dobogós"` új kulcs hozzáadása).

## Megőrzendő funkciók

- `GroupTokenSummary` (custom csoport kártyák) — érintetlen.
- `MatchCard` / `BetDialog` — érintetlen.
- Csoport detail oldal funkcionálisan érintetlen, csak a cím feliratba kerül "Ranglista" a "Hivatalos" helyett (DB érték miatt automatikusan).
- A `tournaments/[slug]/groups/hivatalos` URL stabil marad.
- `ensureOfficialMembership` és kapcsolódó lazy auto-join logika változatlan.

## Out of scope

- A `MatchCard`, `BetDialog`, vagy a meccs accordion vizuális átdolgozása.
- A csoport detail oldal (`/groups/[gSlug]`) belső layout módosítása.
- A `GroupTokenSummary` (custom csoport kártyák) változtatása.
- URL slug átírása `hivatalos` → `ranglista`-ra (breaking change lenne meglévő linkekre).
- Felhasználói preferencia szerver-oldali tárolása (a localStorage elég ehhez a feature-höz).

## Kockázatok

- **Hydration mismatch:** a localStorage szerveroldalon nem elérhető. Mitigáció: SSR-en mindig `closed` render, kliens `useEffect`-ben olvas és állít. Ez okozhat egy gyors "flash" ha a user nyitva szokta tartani; elfogadható mert default állapot a csukott.
- **DB migration timing:** a migration előtt deployolt frontend még "Ranglista"-t kérne, de "Hivatalos" jelennie meg a DB-ből. Mitigáció: a migration-t a build előtt manuálisan futtatjuk (CLAUDE.md szerinti workflow).
- **`groupName` prop oda-vissza átnevezés:** a `OfficialCardData` interface most már "Ranglista"-t fog tartalmazni a `groupName`-ben. A frontend tudatosan nem hardcode-ol "Hivatalos"-t — a DB-ből jövő érték a tudás forrása.
