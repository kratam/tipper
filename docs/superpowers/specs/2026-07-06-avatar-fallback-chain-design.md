# Avatar fallback-lánc — háromszintű avatar-megjelenítés

**Dátum:** 2026-07-06
**Státusz:** jóváhagyott design → implementáció

## Probléma

A ranglistán (és minden avatart megjelenítő helyen) a Google-profilkép jelenik meg,
amelynek generált betűje a Google-fiók nevéből származik — nem a felhasználó által
beállított `displayName`-ből. Ezért térhet el a látott betű (pl. „P") a megjelenített
névtől (pl. „Andris"). Az app saját fallback-je ugyan a `displayName`-ből dolgozik, de
csak akkor lép be, ha a kép nem tölt be — és ma egyszínű, krém háttérrel jelenik meg.

## Cél

Egységes, háromszintű avatar-megjelenítési lánc minden render-helyen, közös komponensen
keresztül:

1. **Google profilkép** (`users.avatarUrl`) — ha van.
2. **Gravatar** — az email alapján, ha van hozzá kép.
3. **Névből generált monogram** — színes, `displayName`-alapú, determinisztikus háttérrel.

Andris esete (van Google-képe) tudatosan „P" marad; a lánc a kép nélküli usereket érinti,
és egységesíti a fallback vizuális megjelenését.

## Architektúra

### Közös `UserAvatar` komponens

Ma az `<Avatar><AvatarImage/><AvatarFallback/></Avatar>` hármas 9 helyen duplikálódik
(`nav`, `group-leaderboard-content`, `circles-list`, `bet-row`, `tip-matrix`,
`group-results-content`, `group-detail-tabs`, `u/[userId]`). A fallback-láncot egy közös
kliens-komponensbe zárjuk:

```tsx
<UserAvatar
  name={displayName}          // COALESCE(displayName, name)
  googleAvatarUrl={...}        // users.avatarUrl | null
  gravatarHash={...}          // szerver oldalon számolt SHA-256 | null
  size="sm"                   // az Avatar meglévő size API-ja
  className={...}
/>
```

A komponens a meglévő `ui/avatar.tsx` primitíveket használja (nem helyettesíti őket).

### Lánc-megvalósítás: `src`-prioritás + Radix natív fallback (A. verzió)

- `src = googleAvatarUrl ?? gravatarUrl(gravatarHash, { size, d: 404 })`
- Ha a kép betölt → azt mutatjuk.
- Ha 404 / betöltési hiba → a Radix `AvatarFallback` lép be a színes monogrammal.
- A `d=404` a lényeg: nincs Gravatar-kép esetén 404 jön (nem generikus szürke sziluett),
  így a lánc tisztán a monogramra esik vissza.

Elvetett alternatíva (B): teljes háromszintű `onError` state-lánc. Extra bonyolultságáért
cserébe csak azt a ritka edge case-t fedné le, amikor a Google-kép **betöltéskor** hibázik
— YAGNI, nem éri meg.

## Adatréteg — Gravatar hash

- A nyers email **nem** kerül a kliensre. A hash-t szerver oldalon számoljuk, a query-k
  egy `gravatarHash` mezőt adnak vissza az `avatarUrl` mellett.
- **Hash:** SHA-256 az email `trim().toLowerCase()` alakjából (a modern Gravatar SHA-256-ot
  használ; az MD5 legacy). Node `crypto`, `src/lib/gravatar.ts` helper.
- **URL:** `https://www.gravatar.com/avatar/<hash>?d=404&s=<px>` — a kliens tölti; a `d=404`
  vezérli a fallbackot.
- Érintett query-k: `getGroupLeaderboard`, circle-leaderboard, profil (`u/[userId]`), nav.
  Ahol ma nincs user-join / csak `avatarUrl`, ott kiegészítjük `gravatarHash`-sel.

## Színes, névből generált monogram

- **Determinisztikus szín:** a `name` stabil hash-éből index a palettába (`hash % N`) —
  ugyanaz a név mindig ugyanaz a szín. `src/lib/avatar-color.ts` helper.
- **Paletta:** kis (~8 szín), témához hangolt paletta a `globals.css @theme`-ben,
  CSS-változóként (light + dark). Nincs raw hex a komponensekben — a design-rendszer
  konvenciója szerint tokenekből dolgozunk. Kontrasztos szövegszín.
- **Monogram:** a meglévő `getInitials(name)` (max 2 betű).

## Tesztelés

- **TDD (pure):**
  - `src/lib/gravatar.ts` — hash normalizálás (trim/lowercase), ismert email → ismert
    SHA-256 vektor, üres/null kezelés; URL-építés (`d=404`, méret).
  - `src/lib/avatar-color.ts` — determinizmus (ugyanaz a név → ugyanaz az index),
    eloszlás/tartomány (`0..N-1`), üres név kezelése.
- **Verifikáció:** `biome check`, `next build`, és a futó appban a ranglista / profil
  vizuális ellenőrzése (van kép / nincs kép, de van Gravatar / egyik sincs).

## Nem cél (YAGNI)

- Google-kép betöltési hibájának Gravatarra terelése (B. verzió).
- Feltöltött, saját avatar (külön feature).
- MD5 Gravatar-kompatibilitás.

## Deploy

Frontend + adatréteg változás → worktree + PR + Vercel/Neon preview + squash merge a
`main`-be, ami elindítja a prod deployt. **Nincs séma-változás**, így DB-migráció sem kell
(az email már a `users` táblában van, a hash szerver oldalon számolódik).
