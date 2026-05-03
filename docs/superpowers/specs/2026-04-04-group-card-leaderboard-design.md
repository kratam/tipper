# Csoportkártya mini rangsorral — Tournament oldal

**Dátum:** 2026-04-04

## Összefoglaló

A `tournaments/[slug]` oldalon a csoportkártyák jelenleg csak token egyenleget és nem tippelt meccsek számát mutatják. Bővítés: profit megjelenítés, mini rangsor (max 3 fő), kattintható link a csoport oldalra.

## Megközelítés

Server-side fetch, statikus renderelés. A mini rangsor összefoglaló — a részletes, élő leaderboard a csoport oldalon érhető el (ahova a kártya linkel).

## Mini leaderboard kiválasztási logika

Pure function: `pickMiniLeaderboard(leaderboard, currentUserId) → max 3 sor`

- Ha a user 1., 2. vagy 3. helyezett → top 3
- Ha a user 4.+ → \[1. helyezett, közvetlenül előttem lévő, én\]
- Ha a user nincs a leaderboardon → top 3

## Kártya layout

Minden csoport egy kattintható kártya → `/groups/[slug]`

```
┌──────────────────────────────────┐
│  Csoport neve                  → │
│                                  │
│  1. JátékosA              +250   │
│  3. JátékosC               +80   │
│  ★ 4. Én                   +45   │  (kiemelve)
│                                  │
│  💰 350 token · ⚠ 2 tipp hiány  │
└──────────────────────────────────┘
```

- Saját sor: amber kiemelés (konzisztens a csoport oldal leaderboard-jával)
- Profit szín: pozitív → zöld, negatív → piros, nulla → szürke
- Alsó sor: meglévő token balance + unbetted meccs info megmarad

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `src/lib/leaderboard-utils.ts` | **Új** — `pickMiniLeaderboard` pure function |
| `tests/lib/leaderboard-utils.test.ts` | **Új** — unit tesztek |
| `src/app/[locale]/tournaments/[slug]/page.tsx` | Leaderboard fetch hozzáadása csoportonként |
| `src/components/tournament-tabs.tsx` | Új prop: mini leaderboard adat, GroupTokenSummary csere |
| `src/components/group-token-summary.tsx` | **Teljes újraírás** — gazdagabb kártya rangsortáblával és linkkel |
| `messages/hu.json`, `messages/en.json` | Új i18n kulcsok |
| `src/queries/leaderboard.ts` | Változatlan — újrahasználjuk `getGroupLeaderboard`-ot |

## Adat flow

```
page.tsx (server)
  → getGroupLeaderboard(groupId) × N csoport
  → pickMiniLeaderboard(leaderboard, userId) × N csoport
  → serialize & pass to TournamentTabs
    → GroupTokenSummary rendereli a kártyákat
```

## Döntések

- **Statikus vs polling:** Statikus, mert ez teaser — az élő adat a csoport oldalon van
- **Teljes kártya csere:** A régi GroupTokenSummary túl egyszerű, az új kártya tartalmazza a régi infót is
- **Pure function kiszervezés:** `pickMiniLeaderboard` tesztelhető, újrahasználható
