# Nem-tippelő játékosok elrejtése a ranglistákról

**Dátum:** 2026-06-22
**Státusz:** jóváhagyott design

## Probléma

A ranglistákon, a tipp táblán és minden hasonló helyen megjelennek azok a
játékosok is, akik csatlakoztak egy csoporthoz/körhöz, de **soha nem tippeltek**.
Ezek örökre 0 ponton állnak, és feleslegesen hizlalják a listákat.

## Kritérium: részvétel, nem pontszám

A szűrés alapja **nem** a pontszám (`profit`), hanem a **részvétel**:

- A „pont" a rendszerben `profit` = nettó token-hozam a lezárult meccseken
  (`getGroupLeaderboard`, `queries/leaderboard.ts`). Ez **negatív is lehet**
  (aki tippelt és összességében vesztett), pozitív (nyert), vagy pontosan 0.
- A profit alapú szűrés rossz lenne: a 0 profit jelenthet „nem tippelt"-et, de
  „tippelt, de még nincs lepontozva"-t vagy „tippelt, de nettó 0"-t is.
- **A helyes kritérium:** egy játékos akkor látszik, ha **van legalább egy
  tippje (`bet` rekordja) az adott csoportban**. Aki tippelt — akár vesztett
  (negatív profit), akár nyitott a tippje (0 profit) — látszik. Csak a
  soha-nem-tippelők tűnnek el.

### Edge case: „kivéve, ha senki sem tippelt"

Ha egy adott listán **egyetlen** játékos sem tippelt, akkor **mindenkit
mutatunk** (nem rejtünk el üres listára). Ez **listánként** külön érvényes:

- a csoport-ranglistára a csoport tagjaira nézve,
- a kör-ranglistára (Circle) a kör tagjaira nézve.

Tehát ha a körben senki sem tippelt, a kör tagjai akkor is megjelennek, akkor is,
ha a tágabb csoportban mások már tippeltek.

### Újrarangsorolás

A szűrés után a megmaradó sorok **folytonos rangot** kapnak (`rank = index + 1`),
nincsenek lyukak. Ez konzisztens a meglévő `filterAndRerankLeaderboard`
viselkedésével (a kör-ranglista már így rangsorol újra).

### Szándékos következmény

Mivel a nem-tippelők profitja 0, ők a rendezett listában a pozitív és a negatív
profitú játékosok **között** ülnek. Kiszűrésük után előfordulhat, hogy egy
**negatív profitú** (vesztő, de aktív) játékos látszik, miközben egy 0 profitú
(nem tippelt) eltűnik. Ez szándékos: az **aktivitás** számít, nem a pontszám.

## Megközelítés: központi pure helper

Mérlegelt alternatívák:

- **(A) Központi pure helper + `betCount` a query-ben** — *választott.* A
  `getGroupLeaderboard` minden sorhoz ad egy `betCount` mezőt; tesztelhető pure
  függvények végzik a szűrést + újrarangsorolást + edge case-t; a megjelenítő
  oldalak egy-egy sorral hívják őket. Illeszkedik a meglévő
  `circle-leaderboard.ts` / `leaderboard-utils.ts` mintához és a „TDD a pure
  logikára" konvencióhoz.
- **(B) DB-szintű `HAVING COUNT(bets) > 0`** — elvetve. Az „ha senki sem
  tippelt, mutass mindenkit" edge case és a kör-szintű részhalmaz nem fér el
  tisztán SQL-ben (a kör részhalmaza külön él), és nehezebben tesztelhető.
- **(C) Szórt `.filter()` ~12 megjelenítő komponensben** — elvetve. Duplikáció,
  az edge case és a rerank 12-szer ismételve, könnyű kihagyni egy helyet.

## Változtatások

### 1. `src/queries/leaderboard.ts`

A `getGroupLeaderboard` minden sorhoz ad egy `betCount` mezőt:

```
betCount: sql<number>`COUNT(DISTINCT ${bets.id})`
```

A `bets` tábla már join-olva van (a `tokenLedger.referenceId` → `bets.id`
úton). Minden tipp leadásakor keletkezik egy `bet` típusú `tokenLedger`
bejegyzés, amely a `bet` rekordra hivatkozik, így a `COUNT(DISTINCT bets.id)`
pontosan a csoportbeli tippek számát adja: `> 0` ⇔ a játékos tippelt.

A query továbbra **nem szűr** és megtartja a rendezést — a szűrés a
megjelenítési rétegben történik, hogy az edge case listánként helyes legyen
(a kör-szintű szűrésnek a szűretlen lista + `betCount` kell).

### 2. `src/lib/leaderboard-utils.ts`

- A `LeaderboardEntry` interfész bővül: `betCount: number`.
- Új pure helper:

```ts
export function hideInactiveAndRerank<T extends { betCount: number; rank: number }>(
  rows: readonly T[],
): T[];
```

(A `rank` a megkötésben azért kell, mert a helper újrarangsorol.)

Logika:
- Ha **minden** sor `betCount === 0` (senki sem tippelt) → a sorokat
  változatlanul (de újrarangsorolva 1..N) adja vissza.
- Egyébként → kiszűri a `betCount === 0` sorokat, majd a megmaradókat
  újrarangsorolja (`rank = index + 1`).

A rangsorolás a bemeneti (profit szerint csökkenő) sorrendet tartja, csak a
rang-számokat számolja újra.

### 3. `src/lib/circle-leaderboard.ts`

A `filterAndRerankLeaderboard(officialRows, memberIds)`:
1. előbb a kör tagjaira szűr (`memberIds`) — ez már megvan,
2. **majd** ugyanazt az inaktív-szűrés + edge case logikát alkalmazza a
   kör-részhalmazon (a `hideInactiveAndRerank` újrafelhasználásával vagy közös
   belső logikával), végül újrarangsorol.

Így a kör-szintű edge case helyes: ha a kör tagjai közül senki sem tippelt, a
tagok megjelennek.

### 4. Megjelenítő oldalak

- `src/app/[locale]/tournaments/[slug]/page.tsx` — a `getGroupLeaderboard`
  eredményén `hideInactiveAndRerank` hívás, mielőtt továbbadná. A
  mini-leaderboard (`pickMiniLeaderboard`) és a teljes ranglista a szűrt
  listát kapja.
- `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — ugyanaz a
  szűrés a `getGroupLeaderboard` eredményén.
- A **tipp tábla** (`TipMatrix` / `buildMatrixRows`) a `leaderboard` propon át
  automatikusan a szűrt listát kapja → egységes a ranglistával, mindkét
  scope-ban (`total` és `round`). Ez adja a kért egységességet; a `tip-matrix`
  belső logikáját **nem** kell módosítani.
- A **kör oldal** (`circles/[circleSlug]/page.tsx`) a már módosított
  `filterAndRerankLeaderboard`-ot használja, nincs további teendő.

### 5. Tesztek (Vitest)

A két pure helperre:
- `hideInactiveAndRerank`:
  - kiszűri a `betCount === 0` sorokat, ha van tippelő;
  - „senki sem tippelt" → az egész listát visszaadja;
  - a megmaradó rangok folytonosak (1..N);
  - a relatív sorrend (profit szerint) megmarad.
- `filterAndRerankLeaderboard` (bővített):
  - a kör tagjaira szűr ÉS kiszűri az inaktívakat;
  - kör-szintű edge case: ha a kör tagjai közül senki sem tippelt, a tagok
    megjelennek (akkor is, ha a csoportban mások tippeltek).

## Érintett fájlok összefoglalása

| Fájl | Változás |
|------|----------|
| `src/queries/leaderboard.ts` | `betCount` mező a query-ben |
| `src/lib/leaderboard-utils.ts` | `betCount` a típuson + `hideInactiveAndRerank` helper |
| `src/lib/circle-leaderboard.ts` | inaktív-szűrés + edge case a kör-részhalmazon |
| `src/app/[locale]/tournaments/[slug]/page.tsx` | `hideInactiveAndRerank` hívás |
| `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` | `hideInactiveAndRerank` hívás |
| `tests/lib/leaderboard-utils.test.ts` | új tesztek |
| `tests/lib/circle-leaderboard.test.ts` | bővített tesztek |
