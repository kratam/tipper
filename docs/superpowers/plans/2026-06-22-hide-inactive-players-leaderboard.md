# Nem-tippelő játékosok elrejtése a ranglistákról — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ranglistákon, a tipp táblán és a kör-nézeteken ne jelenjenek meg azok a játékosok, akik az adott csoportban még egyetlen tippet sem adtak le — kivéve, ha az adott listán senki sem tippelt (akkor mindenki látszik).

**Architecture:** A `getGroupLeaderboard` query minden sorhoz ad egy `betCount` mezőt (tippek száma a csoportban). Két tesztelhető pure helper végzi a szűrést + újrarangsorolást + „senki sem tippelt" edge case-t: `hideInactiveAndRerank` (csoport-szint) és a bővített `filterAndRerankLeaderboard` (kör-szint). A megjelenítő oldalak ezeket hívják; a tipp tábla és a mini-leaderboard automatikusan a szűrt listát kapja a `leaderboard` propon át.

**Tech Stack:** TypeScript (strict), Drizzle ORM (Postgres), Next.js App Router (Server Components), Vitest, Biome.

## Global Constraints

- **Nincs séma-változás → nincs DB migráció.** A `betCount` csak egy `SELECT`-bővítés a meglévő join-okon; nem érinti a táblákat. NE futtass `db:generate`/`db:migrate`-et.
- **A `betCount` szerver-oldali marad.** A kliensre menő objektumok (`BoardTab.leaderboard`, `GroupDetailTabs` `leaderboard` prop, mini/full leaderboard) szűkítettek maradnak (`rank, userId, userName, userAvatarUrl, profit`) — a `betCount` nem szivárog a kliensre.
- **TDD a pure logikára** (a két helper). A query- és page-wiring nem unit-tesztelhető (DB/Server Component) — ott `npm run build` a verifikáció.
- **Lint/format:** minden kód-task után `npm run check` (Biome) fusson tisztán.
- **Conventional commits.** A commit üzenetek végére kerüljön:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Tippelt-e definíció:** egy játékos „aktív", ha `betCount > 0`. A `betCount === 0` jelentése: nincs egyetlen `bet` rekordja sem az adott csoportban (profitja szükségszerűen 0). A negatív profitú (vesztő, de tippelő) játékosok `betCount > 0` → maradnak.

---

### Task 1: `betCount` a típuson + `hideInactiveAndRerank` pure helper

**Files:**
- Modify: `src/lib/leaderboard-utils.ts`
- Modify (fixtúra): `tests/lib/leaderboard-utils.test.ts`
- Modify (fixtúra): `tests/lib/circle-leaderboard.test.ts`

**Interfaces:**
- Produces:
  - `LeaderboardEntry` bővül: `betCount: number`.
  - `export function hideInactiveAndRerank<T extends { betCount: number; rank: number }>(rows: readonly T[]): T[]`
    — ha van legalább egy `betCount > 0` sor, kiszűri a `betCount === 0` sorokat; különben mindet megtartja; végül `rank = index + 1` újrarangsorolás. A bemeneti sorrendet megtartja.

- [ ] **Step 1: Bővítsd a típust és frissítsd a meglévő teszt-fixtúrákat (refactor, viselkedés-semleges)**

`src/lib/leaderboard-utils.ts` — a `LeaderboardEntry` interfész bővítése:

```ts
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
  betCount: number;
}
```

`tests/lib/leaderboard-utils.test.ts` — a `makeEntry` helper kapjon `betCount` paramétert (default `1`, hogy a meglévő tesztek „tippelt" sorokat kapjanak, viselkedésük ne változzon):

```ts
function makeEntry(
  rank: number,
  userId: string,
  profit: number,
  betCount = 1,
): LeaderboardEntry {
  return { rank, userId, userName: `User ${userId}`, userAvatarUrl: null, profit, betCount };
}
```

`tests/lib/circle-leaderboard.test.ts` — a modul tetején lévő `officialRows` minden literálja kapjon `betCount: 1`-et:

```ts
const officialRows = [
  { rank: 1, userId: "a", userName: "Anna", userAvatarUrl: null, profit: 500, betCount: 1 },
  { rank: 2, userId: "b", userName: "Bea", userAvatarUrl: null, profit: 300, betCount: 1 },
  { rank: 3, userId: "c", userName: "Cili", userAvatarUrl: null, profit: 100, betCount: 1 },
  { rank: 4, userId: "d", userName: "Dani", userAvatarUrl: null, profit: -50, betCount: 1 },
];
```

- [ ] **Step 2: Futtasd a meglévő teszteket — a refactor nem tört semmit**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts tests/lib/circle-leaderboard.test.ts`
Expected: PASS (minden meglévő teszt zöld; a `betCount` mező hozzáadása nem változtat a `pickMiniLeaderboard` / `splitCuratedRows` / `filterAndRerankLeaderboard` viselkedésén).

- [ ] **Step 3: Írd meg a `hideInactiveAndRerank` failing teszteket**

`tests/lib/leaderboard-utils.test.ts` — add hozzá az importhoz a `hideInactiveAndRerank`-et, majd egy új describe blokk a fájl végére:

```ts
describe("hideInactiveAndRerank", () => {
  it("kiszűri a nem-tippelő (betCount === 0) sorokat, ha van tippelő", () => {
    const board = [
      makeEntry(1, "a", 500, 2),
      makeEntry(2, "b", 0, 0),
      makeEntry(3, "c", -50, 1),
    ];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.userId)).toEqual(["a", "c"]);
  });

  it("a megmaradó sorokat 1..n-re rangsorolja, a sorrendet megtartva", () => {
    const board = [
      makeEntry(1, "a", 500, 1),
      makeEntry(2, "b", 0, 0),
      makeEntry(3, "c", -50, 1),
    ];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
    expect(result.map((r) => r.userId)).toEqual(["a", "c"]);
  });

  it("ha senki sem tippelt, mindenkit megtart (csak újrarangsorol)", () => {
    const board = [makeEntry(1, "a", 0, 0), makeEntry(2, "b", 0, 0)];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.userId)).toEqual(["a", "b"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("üres listára üres listát ad", () => {
    expect(hideInactiveAndRerank([])).toEqual([]);
  });
});
```

A meglévő import sort bővítsd:

```ts
import {
  hideInactiveAndRerank,
  type LeaderboardEntry,
  pickMiniLeaderboard,
  splitCuratedRows,
} from "@/lib/leaderboard-utils";
```

- [ ] **Step 4: Futtasd — a failnek kell lennie**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts`
Expected: FAIL — `hideInactiveAndRerank is not a function` / nincs exportálva.

- [ ] **Step 5: Implementáld a `hideInactiveAndRerank`-et**

`src/lib/leaderboard-utils.ts` — add hozzá a fájl végére:

```ts
/**
 * Elrejti a még nem tippelt játékosokat (`betCount === 0`), és a maradékot
 * 1..n-re rangsorolja. Ha SENKI sem tippelt a listán, mindenkit megtart (csak
 * újrarangsorol) — különben üres lenne a lista. A bemeneti (profit szerint
 * csökkenő) sorrendet megőrzi.
 */
export function hideInactiveAndRerank<T extends { betCount: number; rank: number }>(
  rows: readonly T[],
): T[] {
  const anyActive = rows.some((r) => r.betCount > 0);
  const kept = anyActive ? rows.filter((r) => r.betCount > 0) : rows;
  return kept.map((row, index) => ({ ...row, rank: index + 1 }));
}
```

- [ ] **Step 6: Futtasd — most zöld**

Run: `npx vitest run tests/lib/leaderboard-utils.test.ts tests/lib/circle-leaderboard.test.ts`
Expected: PASS (az új és a meglévő tesztek is).

- [ ] **Step 7: Biome ellenőrzés**

Run: `npm run check`
Expected: nincs hiba (esetleg auto-fix; ha módosít, add hozzá a változásokat a commithoz).

- [ ] **Step 8: Commit**

```bash
git add src/lib/leaderboard-utils.ts tests/lib/leaderboard-utils.test.ts tests/lib/circle-leaderboard.test.ts
git commit -m "$(cat <<'EOF'
feat(leaderboard): hideInactiveAndRerank helper + betCount a típuson

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `filterAndRerankLeaderboard` bővítése (kör-szint)

**Files:**
- Modify: `src/lib/circle-leaderboard.ts`
- Modify: `tests/lib/circle-leaderboard.test.ts`

**Interfaces:**
- Consumes: `hideInactiveAndRerank` (Task 1), `LeaderboardEntry.betCount` (Task 1).
- Produces: a `filterAndRerankLeaderboard(officialRows, memberIds)` ugyanazzal a szignatúrával, de új viselkedéssel:
  1. a kör tagjaira szűr (`memberIds`),
  2. ha a tagok közül van tippelő (`betCount > 0`), kiszűri a nem-tippelő tagokat; ha egyik sem tippelt, mindet megtartja (kör-szintű edge case),
  3. `officialRank` = a tag helye a **csoport-szintű szűrt** hivatalos ranglistán (`hideInactiveAndRerank(officialRows)`); ha a tag nincs benne (csak edge case-ben fordulhat elő), fallback a nyers `row.rank`,
  4. körön belüli `rank` = `index + 1`.

- [ ] **Step 1: Írd meg a failing teszteket**

`tests/lib/circle-leaderboard.test.ts` — add hozzá ezt a három `it`-et a meglévő describe blokkba. (A meglévő `officialRows` literálok már `betCount: 1`-esek a Task 1 Step 1 után, így a meglévő tesztek továbbra is zöldek.)

```ts
it("kiszűri a nem-tippelő kör-tagot, ha van tippelő tag", () => {
  const rows = [
    { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
    { rank: 2, userId: "c", userName: "C", userAvatarUrl: null, profit: 100, betCount: 1 },
    { rank: 3, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
    { rank: 4, userId: "d", userName: "D", userAvatarUrl: null, profit: -50, betCount: 1 },
  ];
  const result = filterAndRerankLeaderboard(rows, new Set(["c", "b", "d"]));
  expect(result.map((r) => r.userId)).toEqual(["c", "d"]);
  expect(result.map((r) => r.rank)).toEqual([1, 2]);
});

it("officialRank a csoport-szintű SZŰRT ranglistából jön (nem a nyers rangból)", () => {
  // 'b' nem tippelt → a szűrt csoport-listában 'c' a 2. (nem a 3.).
  const rows = [
    { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
    { rank: 2, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
    { rank: 3, userId: "c", userName: "C", userAvatarUrl: null, profit: -50, betCount: 1 },
  ];
  const result = filterAndRerankLeaderboard(rows, new Set(["c"]));
  expect(result).toEqual([
    { rank: 1, officialRank: 2, userId: "c", userName: "C", userAvatarUrl: null, profit: -50, betCount: 1 },
  ]);
});

it("kör edge case: ha a kör tagjai közül senki sem tippelt, mind látszik", () => {
  // A csoportban 'a' tippelt, de a kör tagja csak a nem-tippelő 'b'.
  const rows = [
    { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
    { rank: 2, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
  ];
  const result = filterAndRerankLeaderboard(rows, new Set(["b"]));
  expect(result.map((r) => r.userId)).toEqual(["b"]);
  expect(result[0].rank).toBe(1);
  expect(result[0].officialRank).toBe(2); // fallback a nyers rangra
});
```

- [ ] **Step 2: Futtasd — a failnek kell lennie**

Run: `npx vitest run tests/lib/circle-leaderboard.test.ts`
Expected: FAIL — az új tesztek elbuknak (a jelenlegi implementáció nem szűri az inaktívakat, és az `officialRank = row.rank` nyers rangot ad).

- [ ] **Step 3: Implementáld az új logikát**

`src/lib/circle-leaderboard.ts` — cseréld le a teljes fájlt erre:

```ts
import { hideInactiveAndRerank, type LeaderboardEntry } from "@/lib/leaderboard-utils";

export interface CircleLeaderboardRow extends LeaderboardEntry {
  /** A tag helyezése a (szűrt) teljes hivatalos ranglistán (1..N). */
  officialRank: number;
}

/**
 * A hivatalos ranglista sorait a kör tagjaira szűri, kiszűri a kör még nem
 * tippelt tagjait (kivéve, ha a kör tagjai közül SENKI sem tippelt — akkor mind
 * látszik), és körön belül 1..n-re rangsorol. Az `officialRank` a tag helye a
 * csoport-szintű szűrt hivatalos ranglistán.
 *
 * A bemenet feltételezetten profit szerint csökkenő sorrendű (a
 * getGroupLeaderboard így adja vissza), ezért a szűrés a relatív sorrendet
 * megtartja.
 */
export function filterAndRerankLeaderboard(
  officialRows: readonly LeaderboardEntry[],
  memberIds: ReadonlySet<string>,
): CircleLeaderboardRow[] {
  // A csoport-szintű szűrt+rerankelt ranglista adja a helyes officialRank-eket.
  const officialActive = hideInactiveAndRerank(officialRows);
  const officialRankById = new Map(officialActive.map((r) => [r.userId, r.rank]));

  const memberRows = officialRows.filter((row) => memberIds.has(row.userId));
  const anyMemberActive = memberRows.some((row) => row.betCount > 0);
  const keptMembers = anyMemberActive
    ? memberRows.filter((row) => row.betCount > 0)
    : memberRows;

  return keptMembers.map((row, index) => ({
    ...row,
    officialRank: officialRankById.get(row.userId) ?? row.rank,
    rank: index + 1,
  }));
}
```

- [ ] **Step 4: Futtasd — most zöld**

Run: `npx vitest run tests/lib/circle-leaderboard.test.ts`
Expected: PASS (az új és a meglévő tesztek is).

- [ ] **Step 5: Biome ellenőrzés**

Run: `npm run check`
Expected: nincs hiba.

- [ ] **Step 6: Commit**

```bash
git add src/lib/circle-leaderboard.ts tests/lib/circle-leaderboard.test.ts
git commit -m "$(cat <<'EOF'
feat(circle): inaktív tagok szűrése + edge case a kör-ranglistán

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `betCount` a `getGroupLeaderboard` query-ben

**Files:**
- Modify: `src/queries/leaderboard.ts`

**Interfaces:**
- Produces: a `getGroupLeaderboard(groupId)` minden sora kap egy `betCount: number` mezőt (a csoportbeli tippek száma). `> 0` ⇔ a játékos tippelt. A visszatérési típus így strukturálisan illeszkedik a `LeaderboardEntry`-hez (Task 1).

- [ ] **Step 1: Add hozzá a `betCount` mezőt a select-hez**

`src/queries/leaderboard.ts` — a `.select({ ... })` objektumba, a `profit` sor után:

```ts
      profit: sql<number>`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') THEN ${tokenLedger.amount} ELSE 0 END), 0)`,
      betCount: sql<number>`COUNT(DISTINCT ${bets.id})::int`,
```

Magyarázat: a `bets` tábla már join-olva van (`tokenLedger.referenceId → bets.id`). Minden tipp leadásakor keletkezik egy `bet` típusú `tokenLedger` bejegyzés a `bet` rekordra hivatkozva, így a `COUNT(DISTINCT bets.id)` pontosan a csoportbeli tippek számát adja. A `::int` cast a `COUNT` bigint-jét `int4`-re alakítja, hogy a driver számként (ne stringként) adja vissza — a `betCount > 0` JS-összehasonlítás így biztosan helyes. A query továbbra **nem szűr**; a szűrés a megjelenítési rétegben történik (a kör-szintű edge case-hez a szűretlen lista + `betCount` kell).

- [ ] **Step 2: Typecheck + build verifikáció**

Run: `npx tsc --noEmit`
Expected: nincs típushiba. (Ha a `tsc` nem fut tisztán a projektben Next-specifikus okból, a Task 5 `npm run build` a végső verifikáció.)

- [ ] **Step 3: Biome ellenőrzés**

Run: `npm run check`
Expected: nincs hiba.

- [ ] **Step 4: Commit**

```bash
git add src/queries/leaderboard.ts
git commit -m "$(cat <<'EOF'
feat(leaderboard): betCount mező a getGroupLeaderboard query-ben

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Megjelenítő oldalak wiring-je (tournament + group)

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx`
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`

**Interfaces:**
- Consumes: `hideInactiveAndRerank` (Task 1), `betCount`-os `getGroupLeaderboard` (Task 3), bővített `filterAndRerankLeaderboard` (Task 2).

**Megjegyzés a circle page-ről:** `src/app/[locale]/tournaments/[slug]/circles/[circleSlug]/page.tsx:87` már a `filterAndRerankLeaderboard(leaderboardRaw, memberIds)`-t hívja a **nyers** `getGroupLeaderboard` kimenetén (betCount-tal) — a Task 2 módosítás automatikusan érvényesül, **nincs teendő** ezen az oldalon.

- [ ] **Step 1: Tournament page — import bővítése**

`src/app/[locale]/tournaments/[slug]/page.tsx:10` — az importot bővítsd:

```ts
import { hideInactiveAndRerank, pickMiniLeaderboard } from "@/lib/leaderboard-utils";
```

- [ ] **Step 2: Tournament page — a `groupLeaderboards` map szűrése + nyers lista megőrzése**

Ugyanezen fájlban a `relevantGroups.map(async (gm) => { ... })` blokk (kb. 93–120. sor) cseréje. A nyers listát `rawLeaderboard`-ként megőrizzük (szerver-oldalon, a kör-filterhez), a megjelenített `leaderboard` pedig a szűrt:

```ts
      relevantGroups.map(async (gm) => {
        const rawLeaderboard = await getGroupLeaderboard(gm.group.id);
        const leaderboard = hideInactiveAndRerank(rawLeaderboard);
        const mini = pickMiniLeaderboard(leaderboard, user.id, gm.group.isOfficial ? 5 : 3);
        const myEntry = leaderboard.find((e) => e.userId === user.id);
        return {
          groupId: gm.group.id,
          groupName: gm.group.name,
          groupSlug: gm.group.slug,
          tournamentSlug: tournament.slug,
          isOfficial: gm.group.isOfficial,
          myProfit: myEntry?.profit ?? 0,
          myRank: myEntry?.rank ?? null,
          rawLeaderboard,
          fullLeaderboard: leaderboard.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            profit: e.profit,
          })),
          miniLeaderboard: mini.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            profit: e.profit,
          })),
        };
      }),
```

- [ ] **Step 3: Tournament page — a kör-filter a nyers official listát kapja**

Ugyanezen fájlban az `officialFullLeaderboard` definíciója (kb. 235–237. sor). Cseréld a `fullLeaderboard` helyett a `rawLeaderboard`-ra, és nevezd át a tisztaság kedvéért. A régi:

```ts
  const officialFullLeaderboard = officialGroup
    ? (groupLeaderboards.find((l) => l.groupId === officialGroup.id)?.fullLeaderboard ?? [])
    : [];
```

Az új:

```ts
  const officialRawLeaderboard = officialGroup
    ? (groupLeaderboards.find((l) => l.groupId === officialGroup.id)?.rawLeaderboard ?? [])
    : [];
```

Majd a kör-tab építésénél (kb. 291. sor) a hívást igazítsd az új névhez:

```ts
      const filtered = filterAndRerankLeaderboard(officialRawLeaderboard, memberIds);
```

> Miért: a `filterAndRerankLeaderboard`-nak a **szűretlen, betCount-os** official listát kell látnia, hogy a kör-szintű edge case helyes legyen (ha a kör tagjai közül senki sem tippelt, akkor is megjelenjenek). A `fullLeaderboard` ekkorra már csoport-szinten szűrt és betCount nélküli, ezért nem alkalmas a kör-filterhez. Ellenőrizd, hogy az `officialFullLeaderboard` névnek **nincs** más használata a fájlban (grep) — ha mégis lenne, mindet a megfelelő (szűrt vagy nyers) változatra kell igazítani.

- [ ] **Step 4: Group detail page — import + szűrés**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — a `getGroupLeaderboard` importja már megvan (10. sor). Add hozzá a `hideInactiveAndRerank` importot a `@/lib/leaderboard-utils`-ból (ha még nincs importálva onnan semmilyen szimbólum, új import sor):

```ts
import { hideInactiveAndRerank } from "@/lib/leaderboard-utils";
```

A `Promise.all` destrukturálásnál (34–36. sor) nevezd át a `leaderboard`-ot `leaderboardRaw`-ra, és alatta szűrd:

```ts
  const [
    leaderboardRaw,
    finishedMatches,
    groupBetsRaw,
    upcomingDays,
    matchTimes,
    initialMatrixRound,
  ] = await Promise.all([
    getGroupLeaderboard(group.id),
    getFinishedMatchesForTournament(group.tournamentId, group.tournament.useFlagFallback),
    getGroupBetsForFinishedMatches(group.id),
    getUpcomingBetSummary(
      group.tournamentId,
      group.id,
      user.id,
      group.tournament.timezone,
      locale,
      group.tournament.useFlagFallback,
    ),
    getTournamentMatchTimes(group.tournamentId),
    getTipMatrixRound(
      group.id,
      group.tournamentId,
      group.tournament.useFlagFallback,
      user.id,
      null,
    ),
  ]);

  const leaderboard = hideInactiveAndRerank(leaderboardRaw);
```

> A `getTipMatrixRound` argumentumait NE változtasd — másold a meglévő hívásból (a fenti blokk a 34–53. sor tartalmát tükrözi; ha a tényleges argumentumok eltérnek, hagyd őket változatlanul, csak a destrukturált nevet és a záró szűrő sort add hozzá). A `leaderboard` további használata (106. sor, `GroupDetailTabs leaderboard={...}`) változatlan marad — innentől a szűrt listát kapja.

- [ ] **Step 5: Build verifikáció**

Run: `npm run build`
Expected: sikeres build, nincs típushiba. (Ez verifikálja, hogy a `rawLeaderboard` mező típusa illeszkedik a `filterAndRerankLeaderboard` `LeaderboardEntry[]` paraméteréhez, és hogy a wiring típushelyes.)

- [ ] **Step 6: Biome ellenőrzés**

Run: `npm run check`
Expected: nincs hiba.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[locale]/tournaments/[slug]/page.tsx" "src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(leaderboard): nem-tippelők elrejtése a torna- és csoport-oldalon

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Teljes verifikáció + manuális smoke

**Files:** nincs (csak verifikáció).

- [ ] **Step 1: Teljes teszt-futtatás**

Run: `npm run test`
Expected: minden teszt PASS.

- [ ] **Step 2: Lint + build**

Run: `npm run check && npm run build`
Expected: tiszta lint, sikeres build.

- [ ] **Step 3: Manuális smoke (dev szerver)**

Run: `npm run dev`, majd nézd át (a `beam <port>` segítségével a laptopról is):
- **Csoport-ranglista** (`/tournaments/<slug>/groups/<gSlug>`): a soha nem tippelt tagok nem jelennek meg; a rangok folytonosak (1,2,3…); a negatív profitú (vesztő) tagok látszanak.
- **Torna landing** (`/tournaments/<slug>`): a mini-leaderboard és a board panel tabjai (tipp tábla, `Összesített` és `Forduló` nézet) a szűrt játékoslistát mutatják.
- **Kör** (`/tournaments/<slug>/circles/<circleSlug>` és a landing kör-tabja): a kör nem-tippelő tagjai eltűnnek; ha a kör minden tagja tippelt-mentes, akkor a kör tagjai megjelennek (edge case).
- **Edge case csoportban:** olyan csoport, ahol senki sem tippelt → mindenki látszik (a lista nem üres).

> Ha bármelyik nézet külön leaderboard-forrásból táplálkozik, amit a fenti taskok nem érintettek, jegyezd fel és igazítsd ugyanezen mintára (`hideInactiveAndRerank` a megjelenítés előtt; a kör-filter a nyers, betCount-os listán).

- [ ] **Step 4: A munka lezárása**

A `superpowers:finishing-a-development-branch` skill szerint járj el (merge / PR / cleanup döntés).

## Self-Review jegyzet

- **Spec coverage:** a spec mind az 5 változtatási pontja le van fedve — query `betCount` (Task 3), `hideInactiveAndRerank` + típus (Task 1), `filterAndRerankLeaderboard` (Task 2), torna+csoport page wiring (Task 4), tesztek (Task 1, 2). A circle page automatikusan lefedett (Task 2 + a meglévő nyers hívás).
- **Spec-en túli finomítás:** kiderült, hogy a torna landing **kör board tab**-ja (`page.tsx:291`) is a `filterAndRerankLeaderboard`-ot hívja, de a szűkített `fullLeaderboard`-dal — ezért a Task 4 bevezet egy szerver-oldali `rawLeaderboard` mezőt, hogy a kör-filter a betCount-os, szűretlen listát kapja. Ez a kör-szintű edge case helyességéhez kell.
- **Típus-konzisztencia:** `betCount: number` egységesen (`LeaderboardEntry`, query `sql<number>`, helperek `betCount > 0`). A `hideInactiveAndRerank` generikus megkötése (`{ betCount; rank }`) illeszkedik mind a `LeaderboardEntry`-re, mind a `getGroupLeaderboard` inferred sorára.
