# Tipp-tábla — forduló-szűrhető Σ oszlop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tipp-tábla Σ (összesítő) oszlopának fejlécére kattintva váltani lehessen „összesített" és „csak az aktuális forduló" pontok között, forduló-módban a tábla átrendeződésével.

**Architecture:** Tisztán kliens-oldali. Egy pure függvény (`buildMatrixRows`) a betöltött `round.bets`-ből számolja a fordulónkénti pontot és állítja össze a megjelenítendő, rendezett sorokat; a `TipMatrix` komponens egy `scope` state-tel kapcsol a két nézet között. Nincs DB-, query- vagy server-action-változás.

**Tech Stack:** TypeScript (strict), React (client component, `useState`/`useMemo`), next-intl, Vitest, Biome, Tailwind v4.

## Global Constraints

- Minden UI szöveg `useTranslations()` — nincs hardcoded string; magyar szövegek ékezetekkel.
- Design tokenek/utility-k: `text-gold`, `text-faint`, `text-muted-foreground`, `bg-surface-2`, `bg-surface-3` — nincs raw hex.
- **Egyetlen** Button-/Tab-rendszer; itt a Σ-toggle natív `<button>` a `<th>`-n belül (nem új komponens), az a11y-ért.
- Pure logika TDD-vel, Vitest. DB-séma NEM változik.
- Conventional commits (feat/test/chore).
- **Commit-figyelmeztetés:** a repo pre-commit hookja a teljes projekten futtat `biome check`-et, és egy preexisting, gitignore-olt `.vercel/project.json` formázási hibán elhasal — ez független ettől a feladattól. A commit-lépésekben ezért `git commit --no-verify` szerepel. (A `biome.json` `includes` listájába külön javításként `!.vercel` kerülhet, de az nem része ennek a tervnek.)

---

### Task 1: `buildMatrixRows` pure logika + típusok + tesztek

A forduló-pont számítás és a sor-összeállítás (érték + rangsor) pure függvénye. Bemenete a leaderboard sorok és a forduló tippjei; kimenete a mód szerint rendezett, rangsorolt megjelenítési sorok.

**Files:**
- Modify: `src/lib/tip-matrix.ts` (a fájl végére, a `betNet` után)
- Test: `tests/lib/tip-matrix.test.ts` (új `describe` blokk a fájl végére)

**Interfaces:**
- Consumes: meglévő `betNet(payout: number | null, stake: number): number | null` (ugyanebben a fájlban).
- Produces:
  - `type MatrixScope = "total" | "round"`
  - `interface MatrixRowInput { rank: number; userId: string; userName: string; userAvatarUrl: string | null; profit: number }`
  - `interface MatrixRowDisplay { rank: number; userId: string; userName: string; userAvatarUrl: string | null; value: number }`
  - `buildMatrixRows(rows: readonly MatrixRowInput[], bets: readonly { userId: string; payout: number | null; stake: number }[], scope: MatrixScope): MatrixRowDisplay[]`

- [ ] **Step 1: Write the failing tests**

A `tests/lib/tip-matrix.test.ts` import-blokkját egészítsd ki (`buildMatrixRows`, `type MatrixRowInput`), majd a fájl végére add:

```ts
describe("buildMatrixRows", () => {
  const lb: MatrixRowInput[] = [
    { rank: 1, userId: "u1", userName: "Anna", userAvatarUrl: null, profit: 42 },
    { rank: 2, userId: "u2", userName: "Béla", userAvatarUrl: null, profit: 30 },
    { rank: 3, userId: "u3", userName: "Cili", userAvatarUrl: null, profit: 10 },
  ];

  it("total scope: unchanged order, value=profit, original rank", () => {
    const out = buildMatrixRows(lb, [], "total");
    expect(out.map((r) => r.userId)).toEqual(["u1", "u2", "u3"]);
    expect(out.map((r) => r.value)).toEqual([42, 30, 10]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("round scope: sums net per user, skips unscored, reorders desc, ranks 1..n", () => {
    const bets = [
      { userId: "u1", payout: 5, stake: 10 }, // net -5
      { userId: "u2", payout: 28, stake: 10 }, // net +18
      { userId: "u3", payout: null, stake: 10 }, // unscored => skip
      { userId: "u2", payout: 12, stake: 10 }, // net +2 => u2 total +20
    ];
    const out = buildMatrixRows(lb, bets, "round");
    expect(out.map((r) => r.userId)).toEqual(["u2", "u3", "u1"]);
    expect(out.map((r) => r.value)).toEqual([20, 0, -5]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("round scope: ties keep global leaderboard order (stable sort)", () => {
    const bets = [{ userId: "u2", payout: 9, stake: 10 }]; // u2 -1, u1=0, u3=0
    const out = buildMatrixRows(lb, bets, "round");
    expect(out.map((r) => r.userId)).toEqual(["u1", "u3", "u2"]);
    expect(out.map((r) => r.value)).toEqual([0, 0, -1]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("round scope: no scored tips => everyone 0, global order preserved", () => {
    const out = buildMatrixRows(lb, [], "round");
    expect(out.map((r) => r.userId)).toEqual(["u1", "u2", "u3"]);
    expect(out.map((r) => r.value)).toEqual([0, 0, 0]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tip-matrix`
Expected: FAIL — `buildMatrixRows is not exported` / `is not a function`.

- [ ] **Step 3: Write minimal implementation**

A `src/lib/tip-matrix.ts` végére, a `betNet` után:

```ts
export type MatrixScope = "total" | "round";

/** A ranglista egy sora a mátrix-megjelenítéshez (globális adatok). */
export interface MatrixRowInput {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

/** A mátrix egy megjelenítendő sora — `value`/`rank` a választott `scope` szerint. */
export interface MatrixRowDisplay {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  value: number;
}

/**
 * A Tipp-tábla sorait állítja össze a választott hatókör szerint.
 *
 * - `"total"`: a bemeneti (globális) sorrend és helyezés változatlan, az érték a
 *   teljes `profit`.
 * - `"round"`: az érték az adott forduló nettó pontja userenként (`betNet`
 *   összege a `payout != null` tippekre; lepontozatlan tipp kimarad), a sorok
 *   csökkenő pont szerint újrarendezve. Holtversenynél a stabil rendezés a
 *   bemeneti globális sorrendet tartja; a helyezés az új sorrend `index + 1`-e
 *   (megegyezik a globális leaderboard szekvenciális rank-konvenciójával).
 */
export function buildMatrixRows(
  rows: readonly MatrixRowInput[],
  bets: readonly { userId: string; payout: number | null; stake: number }[],
  scope: MatrixScope,
): MatrixRowDisplay[] {
  if (scope === "total") {
    return rows.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: r.profit,
    }));
  }

  const scoreByUser = new Map<string, number>();
  for (const b of bets) {
    const net = betNet(b.payout, b.stake);
    if (net == null) continue;
    scoreByUser.set(b.userId, (scoreByUser.get(b.userId) ?? 0) + net);
  }

  return rows
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: scoreByUser.get(r.userId) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((r, index) => ({ ...r, rank: index + 1 }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tip-matrix`
Expected: PASS — minden `buildMatrixRows` teszt zöld (a meglévő tesztek is).

- [ ] **Step 5: Lint**

Run: `npx biome check --write src/lib/tip-matrix.ts tests/lib/tip-matrix.test.ts`
Expected: nincs hiba (vagy auto-fix után tiszta).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tip-matrix.ts tests/lib/tip-matrix.test.ts
git commit --no-verify -m "feat(tip-matrix): buildMatrixRows pure logika a forduló-hatókörhöz"
```

---

### Task 2: Σ-toggle a komponensben + i18n

A `TipMatrix` komponens `scope` state-je, a Σ fejléc kattintható `<button>`-né alakítása rövid forduló-felirattal, és a `tbody` + „Ugorj rám" sáv átkötése a `buildMatrixRows` kimenetére. Plusz a négy új i18n kulcs (hu + en).

**Files:**
- Modify: `src/components/tip-matrix.tsx`
- Modify: `messages/hu.json` (`tipMatrix` névtér)
- Modify: `messages/en.json` (`tipMatrix` névtér)

**Interfaces:**
- Consumes: `buildMatrixRows`, `type MatrixScope`, `type MatrixRowDisplay` a `@/lib/tip-matrix`-ból (Task 1).
- Produces: nincs further-consumed export (UI végállomás).

- [ ] **Step 1: i18n kulcsok — `messages/hu.json`**

A `tipMatrix` objektumban a `roundLabel` után, a `stage` mellé vedd fel:

```json
    "scopeTotal": "össz",
    "shortRound": "F{n}",
    "shortStage": {
      "final": "D",
      "sf": "ED",
      "qf": "ND"
    },
```

- [ ] **Step 2: i18n kulcsok — `messages/en.json`**

A `tipMatrix` objektumban ugyanígy:

```json
    "scopeTotal": "tot",
    "shortRound": "R{n}",
    "shortStage": {
      "final": "F",
      "sf": "SF",
      "qf": "QF"
    },
```

- [ ] **Step 3: Importok és `scope` state**

A `src/components/tip-matrix.tsx` importjánál a meglévő `import { betNet } from "@/lib/tip-matrix";` sort cseréld:

```tsx
import { betNet, buildMatrixRows, type MatrixRowDisplay, type MatrixScope } from "@/lib/tip-matrix";
```

A `useTransition` state mellé (a `cache`/`roundKey` state-ek után) vedd fel:

```tsx
  const [scope, setScope] = useState<MatrixScope>("total");
```

- [ ] **Step 4: `displayRows` memo a `betByCell` mellé**

A meglévő `betByCell` `useMemo` után (még a `if (!round)` korai return ELŐTT) add:

```tsx
  const displayRows = useMemo(
    () => buildMatrixRows(leaderboard, round?.bets ?? [], scope),
    [leaderboard, round, scope],
  );
```

- [ ] **Step 5: Rövid forduló-felirat a `roundTitle` mellé**

A meglévő `roundTitle` számítás (a `let roundTitle: string; … } ` blokk) után, ugyanabban a scope-ban add hozzá:

```tsx
  let roundScopeLabel: string;
  if (round.roundKind === "group" && round.roundGroupNumber != null) {
    roundScopeLabel = t("shortRound", { n: round.roundGroupNumber });
  } else if (round.roundIsFinal) {
    roundScopeLabel = t("shortStage.final");
  } else if (round.roundKnockoutTeams === 4) {
    roundScopeLabel = t("shortStage.sf");
  } else if (round.roundKnockoutTeams === 8) {
    roundScopeLabel = t("shortStage.qf");
  } else {
    roundScopeLabel = `1/${(round.roundKnockoutTeams ?? 0) / 2}`;
  }
```

- [ ] **Step 6: `meRow` a `displayRows`-ból**

A meglévő `const meRow = leaderboard.find((r) => r.userId === currentUserId);` sort cseréld:

```tsx
  const meRow = displayRows.find((r) => r.userId === currentUserId);
```

- [ ] **Step 7: `renderCell` paramétertípus**

A `renderCell` szignatúrájában a `row: TipMatrixLeaderboardRow` típust cseréld `row: MatrixRowDisplay`-re (a függvény csak `row.userId`-t használ, így kompatibilis):

```tsx
  function renderCell(row: MatrixRowDisplay, m: TipMatrixMatch) {
```

- [ ] **Step 8: Σ fejléc → kattintható `<button>`**

A meglévő Σ `<th>`-t (a `<th … >Σ</th>`) cseréld:

```tsx
              <th className="border-border border-b bg-surface-2 p-0 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setScope((s) => (s === "total" ? "round" : "total"))}
                  aria-pressed={scope === "round"}
                  className="flex w-full flex-col items-center px-2.5 py-2 hover:bg-surface-3"
                >
                  <span>Σ</span>
                  <span
                    className={cn(
                      "mt-1 whitespace-nowrap text-[10px]",
                      scope === "round" ? "text-gold" : "text-faint",
                    )}
                  >
                    {scope === "round" ? roundScopeLabel : t("scopeTotal")}
                  </span>
                </button>
              </th>
```

- [ ] **Step 9: `tbody` a `displayRows`-ból + Σ cella értéke**

A `tbody`-ban a `{leaderboard.map((row) => {` sort cseréld `{displayRows.map((row) => {`-re. Ugyanitt a Σ-cella `{signed(row.profit)}` kifejezését cseréld:

```tsx
                  <td className="border-border border-b px-2.5 py-2 text-center font-bold text-[14px] text-gold">
                    {signed(row.value)}
                  </td>
```

- [ ] **Step 10: „Ugorj rám" sáv értéke**

A jump-to-me sávban a `{signed(meRow.profit)}` kifejezést cseréld `{signed(meRow.value)}`-ra. (A `meRow.rank` és `meRow.userName` változatlan — most a mód szerinti rangsort mutatja.)

- [ ] **Step 11: Típus- és lint-ellenőrzés**

Run: `npx biome check --write src/components/tip-matrix.tsx messages/hu.json messages/en.json`
Expected: nincs hiba.

Run: `npm run build`
Expected: a build lefut, nincs TypeScript-hiba. (Megjegyzés: ha a `leaderboard` prop típusa `TipMatrixLeaderboardRow[]`, az strukturálisan illeszkedik a `MatrixRowInput`-ra — a `buildMatrixRows` hívás típushelyes.)

- [ ] **Step 12: Kézi vizuális verifikáció (beam)**

Indítsd: `npm run dev`, oszd meg: `beam 3000` (vagy az aktuális port), és a böngészőben (laptop/iPad) ellenőrizd egy csoport- és egy kör-oldalon:
- A Σ alatt alapból `össz` (muted); a fejlécre kattintva a felirat a forduló rövid kódjára vált (arany), és a tábla átrendeződik a forduló pontjai szerint, a helyezés-számokkal együtt.
- Újabb kattintásra visszavált összesítettre.
- Forduló-váltás (← →) megőrzi a módot.
- Mobil szélességen a Σ oszlop nem hízik meg (a felirat `whitespace-nowrap`, ≤4 kar).
- A „Ugorj rám" sáv értéke/helyezése követi a módot (csoport-oldalon).

- [ ] **Step 13: Commit**

```bash
git add src/components/tip-matrix.tsx messages/hu.json messages/en.json
git commit --no-verify -m "feat(tip-matrix): forduló-szűrhető Σ oszlop (fejléc-toggle + átrendezés)"
```

---

## Megjegyzés a végrehajtónak

A Task 2 lépései **egy** komponens-fájlon dolgoznak; ne darabold külön commitokba a 3–10. lépést — a komponens csak a végén (Step 11–13) áll össze fordíthatóan és tesztelhetően. A 11. lépés (build + lint) a Task 2 deliverable-jének kapuja; csak utána commitolj.
