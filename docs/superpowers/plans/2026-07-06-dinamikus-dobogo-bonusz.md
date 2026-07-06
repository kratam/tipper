# Dinamikus dobogó-bónusz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fix dobogó-bónuszt (`bonusPodiumMention`/`bonusPodiumExact` token) meccsszám-arányos, %-alapú bónuszra cseréljük, hogy a torna végi tokenszinthez igazodjon.

**Architecture:** A `groups` tábla két int oszlopa (`bonus_podium_mention`, `bonus_podium_exact`) helyére két real pct oszlop kerül (`bonus_podium_mention_pct` default 1.5, `bonus_podium_exact_pct` default 3). A `finishTournament` a torna nem-`cancelled` meccseinek számából és a csoport `tokenPerMatch`-éből számol per-játékos token-egységet egy új pure `computePodiumUnit` függvénnyel; a `calculatePodiumPoints` változatlan (abszolút token-értékeket kap). A szabály-dialog `{pct}%`-ot mutat magyarázó szöveggel, a meccs-bónusz mintájára.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle ORM (Neon Postgres), Vitest, next-intl, Biome.

## Global Constraints

- Séma-változás **kizárólag** `db:generate` → `db:migrate` úton; a migrációt kézzel futtatjuk deploy előtt (a Vercel build nem futtat migrációt). Soha ne `drizzle-kit push` / kézi SQL / Neon MCP.
- Minden magyar UI-szöveg ékezetesen. Nincs hardcoded string — minden UI szöveg `useTranslations()` / `getTranslations()`.
- Default értékek: `bonusPodiumMentionPct = 1.5`, `bonusPodiumExactPct = 3`.
- A `calculatePodiumPoints` pure függvény és annak `settings: { bonusPodiumMention, bonusPodiumExact }` paraméterneve (abszolút token) **változatlan** — ne írd át pct-re.
- Az i18n **kulcsnevek** (`t("bonusPodiumMention")`, `labelKey: "bonusPodiumMention"`) **változatlanok**; csak a data-mezők (`group.bonusPodiumMention` → `group.bonusPodiumMentionPct`) és a fordítás-szövegek változnak.
- Commit: conventional commits (feat/fix/chore/docs).

---

### Task 1: `computePodiumUnit` pure függvény + tesztek

**Files:**
- Modify: `src/lib/scoring.ts` (új export a fájl végére, a `calculatePodiumPoints` mellé)
- Test: `src/lib/scoring.test.ts`

**Interfaces:**
- Produces: `computePodiumUnit(pct: number, tokenPerMatch: number, matchCount: number): number` — a per-játékos dobogó-bónusz token-egység, `Math.floor((pct / 100) * tokenPerMatch * matchCount)`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/scoring.test.ts` (a fájl tetején importáld a függvényt a meglévő scoring-importhoz: `import { ..., computePodiumUnit } from "./scoring";`):

```ts
describe("computePodiumUnit", () => {
  it("a pct/100 × tokenPerMatch × matchCount lefelé kerekítve", () => {
    expect(computePodiumUnit(1.5, 100, 104)).toBe(156);
    expect(computePodiumUnit(3, 100, 104)).toBe(312);
  });

  it("lefelé kerekít (Math.floor)", () => {
    expect(computePodiumUnit(1.5, 100, 5)).toBe(7); // 7.5 → 7
    expect(computePodiumUnit(1, 100, 7)).toBe(7);
  });

  it("0 pct → 0", () => {
    expect(computePodiumUnit(0, 100, 104)).toBe(0);
  });

  it("0 meccs → 0", () => {
    expect(computePodiumUnit(1.5, 100, 0)).toBe(0);
  });

  it("magasabb tokenPerMatch arányosan nagyobb egység", () => {
    expect(computePodiumUnit(1.5, 200, 104)).toBe(312);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/scoring.test.ts`
Expected: FAIL — `computePodiumUnit is not a function` / import hiba.

- [ ] **Step 3: Write minimal implementation**

Add to the end of `src/lib/scoring.ts`:

```ts
/**
 * A dobogó-bónusz per-játékos token-egysége. A meccsszám-arányos „floor"-hoz
 * horgonyzott: pct%-a a csoport (tokenPerMatch × meccsszám) keretének. Lefelé
 * kerekít. A torna végén egyszer, a `finishTournament`-ben hívva.
 */
export function computePodiumUnit(
  pct: number,
  tokenPerMatch: number,
  matchCount: number,
): number {
  return Math.floor((pct / 100) * tokenPerMatch * matchCount);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/scoring.test.ts`
Expected: PASS (a `computePodiumUnit` blokk + a meglévő scoring-tesztek).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): computePodiumUnit — meccsszám-arányos dobogó-egység"
```

---

### Task 2: Séma — int dobogó-oszlopok cseréje pct oszlopokra + migráció

**Files:**
- Modify: `src/db/schema.ts:151-152`
- Create: `drizzle/00XX_*.sql` (a `db:generate` hozza létre)

**Interfaces:**
- Produces: `groups.bonusPodiumMentionPct` (real, default 1.5), `groups.bonusPodiumExactPct` (real, default 3). A régi `bonusPodiumMention`/`bonusPodiumExact` **megszűnik**.

- [ ] **Step 1: Séma szerkesztése**

`src/db/schema.ts`, a 151-152. sor cseréje:

```ts
    bonusPodiumMentionPct: real("bonus_podium_mention_pct").default(1.5).notNull(),
    bonusPodiumExactPct: real("bonus_podium_exact_pct").default(3).notNull(),
```

(A `real` már importált — a `bonusGoalDiffPct` is azt használja.)

- [ ] **Step 2: Migráció generálása**

Run: `npm run db:generate`
Expected: új `drizzle/00XX_*.sql` fájl.

- [ ] **Step 3: Migráció ellenőrzése**

Run: `cat drizzle/00XX_*.sql` (a legújabb fájl)
Expected: két `ADD COLUMN ... _pct real DEFAULT ... NOT NULL` és két `DROP COLUMN "bonus_podium_mention"` / `"bonus_podium_exact"`. Ha bármi mást is tartalmaz (más oszlop drop/rename), **ÁLLJ MEG** — a séma elcsúszott, ne futtasd.

- [ ] **Step 4: Commit** (a build ezen a ponton PIROS lehet, mert a TS-hivatkozások még a régi mezőkre mutatnak — a Task 3 állítja zöldre; ez tudatos, kohézív refaktor-lépés)

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): dobogó-bónusz pct oszlopok (expand+contract)"
```

---

### Task 3: Kód-refaktor — minden hivatkozás a pct oszlopokra + `finishTournament` dinamikus pontozás

Ez a lépés zöldre állítja a buildet: minden `bonusPodiumMention`/`bonusPodiumExact` **data-mező** átáll a pct oszlopokra, a `finishTournament` a `computePodiumUnit`-tal számol, és a szabály-dialog `{pct}%`-ot mutat. (Az i18n szövegek a Task 4-ben.)

**Files:**
- Modify: `src/lib/group-rules.ts` (típus + podium sorok)
- Modify: `src/lib/group-rules.test.ts` (base objektum + podium teszt)
- Modify: `src/actions/admin.ts` (finishTournament wiring)
- Modify: `src/lib/official-group.ts:70-71` (seed)
- Modify: `src/components/create-group-form.tsx:46-47, 197-213`
- Modify: `src/components/group-detail-tabs.tsx:326-338`
- Modify: `src/actions/groups.ts:23-24, 64-65, 143-144` (create + update input)
- Modify: `src/queries/groups.ts:570, 626`
- Modify: `src/actions/tip-matrix.ts:126-127`
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx:164-165, 197-198, 225-226, 270-271, 293-294`
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx:116-117`
- Modify: `src/components/tournament-tabs.tsx:37-38, 88-89`
- Modify: `src/components/bet-form.tsx:35-36`
- Modify: `src/components/bet-dialog.tsx:43-44`
- Modify: `src/components/public-groups-section.tsx:18`
- Modify: `src/components/public-group-dialog.tsx:29, 138`

**Interfaces:**
- Consumes: `computePodiumUnit` (Task 1), `groups.bonusPodiumMentionPct`/`bonusPodiumExactPct` (Task 2).
- Produces: `GroupRules` típus mezői `bonusPodiumMentionPct: number` / `bonusPodiumExactPct: number`.

- [ ] **Step 1: `src/lib/group-rules.ts` — típus + podium sorok**

A `GroupRules` interfészben (10-11. sor) cseréld:

```ts
  bonusPodiumMentionPct: number;
  bonusPodiumExactPct: number;
```

A podium sorok blokkját (81-96. sor) cseréld:

```ts
  const podiumRows: RuleRow[] = [];
  if (rules.bonusPodiumMentionPct > 0) {
    podiumRows.push({
      labelKey: "bonusPodiumMention",
      value: `${rules.bonusPodiumMentionPct}%`,
      explainKey: "bonusPodiumMentionExplain",
      explainParams: { pct: rules.bonusPodiumMentionPct },
    });
  }
  if (rules.bonusPodiumExactPct > 0) {
    podiumRows.push({
      labelKey: "bonusPodiumExact",
      value: `${rules.bonusPodiumExactPct}%`,
      explainKey: "bonusPodiumExactExplain",
      explainParams: { pct: rules.bonusPodiumExactPct },
    });
  }
  if (podiumRows.length > 0) {
    sections.push({ titleKey: "rulesPodium", rows: podiumRows });
  }
```

- [ ] **Step 2: `src/lib/group-rules.test.ts` frissítése**

A `base` objektumban (5-14. sor) cseréld a két mezőt:

```ts
  bonusPodiumMentionPct: 1.5,
  bonusPodiumExactPct: 3,
```

Cseréld a „hides the podium section when both podium bonuses are 0" tesztet:

```ts
  it("hides the podium section when both podium bonuses are 0", () => {
    const sections = buildRuleSections({
      ...base,
      bonusPodiumMentionPct: 0,
      bonusPodiumExactPct: 0,
    });
    expect(sections.find((s) => s.titleKey === "rulesPodium")).toBeUndefined();
  });
```

Adj hozzá egy sort a „formats core token and scoring rows" teszthez (a podium `{pct}%` ellenőrzésére), a meglévő `bonusGoalDiff` assertek mellé:

```ts
    expect(findRow(sections, "bonusPodiumMention")?.value).toBe("1.5%");
    expect(findRow(sections, "bonusPodiumExact")?.value).toBe("3%");
    expect(findRow(sections, "bonusPodiumMention")?.explainKey).toBe("bonusPodiumMentionExplain");
```

- [ ] **Step 3: `src/actions/admin.ts` — finishTournament dinamikus egység**

Az importoknál (3. és 5. és 11. sor) egészítsd ki:
- `import { and, eq, ne } from "drizzle-orm";` (a `and`, `ne` kell)
- a schema-importhoz add: `matches` → `import { groupMembers, groups, matches, podiumBets, tokenLedger, tournaments } from "@/db/schema";`
- a scoring-importhoz add: `import { calculatePodiumPoints, computePodiumUnit } from "@/lib/scoring";`

A `finishTournament`-ben, a `const actual = ...` sor **elé** (a 227. sor környékén) szúrd be a meccsszám lekérdezését:

```ts
  // A dobogó-bónusz horgonya: a torna nem-cancelled meccseinek száma (a token-floor
  // gerince). A torna végén ~az összes meccs.
  const activeMatches = await db.query.matches.findMany({
    where: and(eq(matches.tournamentId, tournamentId), ne(matches.status, "cancelled")),
    columns: { id: true },
  });
  const matchCount = activeMatches.length;
```

A per-group ciklusban (244-248. sor) a `calculatePodiumPoints` hívást cseréld:

```ts
      const points = calculatePodiumPoints(prediction, actual, {
        bonusPodiumMention: computePodiumUnit(
          group.bonusPodiumMentionPct,
          group.tokenPerMatch,
          matchCount,
        ),
        bonusPodiumExact: computePodiumUnit(
          group.bonusPodiumExactPct,
          group.tokenPerMatch,
          matchCount,
        ),
      });
```

(A `group` a `tournamentGroups`-ból jön, `db.query.groups.findMany` → minden oszlop, tehát `tokenPerMatch`, `bonusPodiumMentionPct`, `bonusPodiumExactPct` elérhető.)

- [ ] **Step 4: `src/lib/official-group.ts:70-71` — seed**

```ts
      bonusPodiumMentionPct: 1.5,
      bonusPodiumExactPct: 3,
```

- [ ] **Step 5: `src/components/create-group-form.tsx` — default + inputok**

A `settings` default (46-47. sor):

```ts
    bonusPodiumMention: 20,
    bonusPodiumExact: 20,
```
→
```ts
    bonusPodiumMentionPct: 1.5,
    bonusPodiumExactPct: 3,
```

A két input (197-213. sor) `value` és `onChange` mezőit írd át `bonusPodiumMentionPct` / `bonusPodiumExactPct`-re (a `t("bonusPodiumMention")` / `t("bonusPodiumExact")` **kulcsokat NE** változtasd), és add hozzá `step={0.5}`-öt, ha a `NumericInput` támogatja (ha nem fogad `step`-et, hagyd el). Példa a mention inputra:

```tsx
                  <Label className="text-xs">{t("bonusPodiumMention")}</Label>
                  <NumericInput
                    value={settings.bonusPodiumMentionPct}
                    onChange={(val) => setSettings({ ...settings, bonusPodiumMentionPct: val })}
                    min={0}
                    className="font-mono"
                  />
```
Ugyanígy az exact inputot `bonusPodiumExactPct`-re.

- [ ] **Step 6: `src/components/group-detail-tabs.tsx:326-338` — inputok**

A két NumericInput `value`/`onChange`-ét írd át `bonusPodiumMentionPct` / `bonusPodiumExactPct`-re (a `t(...)` kulcsok maradnak). A `settings` forrása a group-objektum; ha van külön default-inicializálás a fájlban, azt is állítsd pct-re (keresd a `bonusPodiumMention`-t a fájlban és cseréld mindet `bonusPodiumMentionPct`-re, `bonusPodiumExact`-et `bonusPodiumExactPct`-re — a `t("...")` kulcsokat kivéve).

- [ ] **Step 7: `src/actions/groups.ts` — create + update input**

A `CreateGroupInput` (23-24. sor) és az `UpdateGroupInput` (143-144. sor) mezőit:

```ts
  bonusPodiumMentionPct?: number;
  bonusPodiumExactPct?: number;
```

A `createGroup` insert spread (64-65. sor):

```ts
      ...(input.bonusPodiumMentionPct != null && { bonusPodiumMentionPct: input.bonusPodiumMentionPct }),
      ...(input.bonusPodiumExactPct != null && { bonusPodiumExactPct: input.bonusPodiumExactPct }),
```

Az `updateGroup`-ban is (keresd a `bonusPodiumMention`/`bonusPodiumExact` set-spreadeket a fájl update-ágában és állítsd pct-re, ugyanezzel a mintával).

- [ ] **Step 8: `src/queries/groups.ts:570, 626`**

570. sor (típusmező) → `bonusPodiumMentionPct: number;` (és ha van `bonusPodiumExact` is a típusban, azt is). 626. sor (értékadás) → `bonusPodiumMentionPct: g.bonusPodiumMentionPct,` (és a párja, ha van). Keresd a fájlban mindkét mezőt és állítsd pct-re.

- [ ] **Step 9: `src/actions/tip-matrix.ts:126-127`**

```ts
    bonusPodiumMentionPct: group.bonusPodiumMentionPct,
    bonusPodiumExactPct: group.bonusPodiumExactPct,
```

(És ahol ez az objektum egy típushoz illeszkedik — `GroupRules` — az már a Task 3 Step 1-ben átállt.)

- [ ] **Step 10: `src/app/[locale]/tournaments/[slug]/page.tsx`**

Minden `bonusPodiumMention`/`bonusPodiumExact` data-mezőt (164-165, 197-198, 225-226, 270-271, 293-294. sor) cserélj `bonusPodiumMentionPct` / `bonusPodiumExactPct`-re, a jobb oldalon `gm.group.bonusPodiumMentionPct` / `officialGroup.bonusPodiumMentionPct` / `og.bonusPodiumMentionPct` forrással. (A 164-165 egy inline típus, a 197-198 a hozzá tartozó objektum — mindkettőt pct-re.)

- [ ] **Step 11: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx:116-117`**

```ts
    bonusPodiumMentionPct: group.bonusPodiumMentionPct,
    bonusPodiumExactPct: group.bonusPodiumExactPct,
```

- [ ] **Step 12: `tournament-tabs.tsx`, `bet-form.tsx`, `bet-dialog.tsx`, `public-groups-section.tsx`**

Ezekben a `bonusPodiumMention: number` / `bonusPodiumExact: number` **típusmezőket** írd át `bonusPodiumMentionPct: number` / `bonusPodiumExactPct: number`-re (tournament-tabs 37-38 és 88-89; bet-form 35-36; bet-dialog 43-44; public-groups-section 18). Ezek nem jelenítik meg az értéket, csak továbbadják — a rename tartja őket konzisztensen a forrással.

- [ ] **Step 13: `src/components/public-group-dialog.tsx:29, 138`**

29. sor típusmező → `bonusPodiumMentionPct: number;`. A 138. sor megjelenítése:

```tsx
                <RuleBox label={t("podiumBonus")} value={`${group.bonusPodiumMentionPct}%`} />
```

- [ ] **Step 14: Typecheck + lint**

Run: `npm run check`
Expected: nincs hiba. Ha maradt `bonusPodiumMention`/`bonusPodiumExact` data-hivatkozás (nem i18n-kulcs, nem a `calculatePodiumPoints` settings-param), a TS jelzi — javítsd.

- [ ] **Step 15: Tesztek**

Run: `npm run test -- src/lib/group-rules.test.ts src/lib/scoring.test.ts`
Expected: PASS.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: dinamikus %-alapú dobogó-bónusz (finishTournament + UI + config)"
```

---

### Task 4: i18n — label + magyarázó szövegek (hu/en)

**Files:**
- Modify: `messages/hu.json:244-245` (+ új explain kulcsok a 289. sor környékén)
- Modify: `messages/en.json:244-245` (+ új explain kulcsok)

**Interfaces:**
- Consumes: `explainKey: "bonusPodiumMentionExplain"` / `"bonusPodiumExactExplain"` (Task 3 Step 1).

- [ ] **Step 1: `messages/hu.json` — label + explain**

A 244-245. sor label-szövegét igazítsd a %-jelleghez:

```json
    "bonusPodiumMention": "Dobogós említés bónusz (%)",
    "bonusPodiumExact": "Pontos helyezés bónusz (%)",
```

A `groups` névtérben (a `bonusExactScoreExplain` mellé, 289. sor környékére) add hozzá:

```json
    "bonusPodiumMentionExplain": "A csoport meccsenkénti token-keretének {pct}%-a a torna meccsszámával szorozva — minden dobogóra eltalált csapatért, a torna végén egyszer jóváírva.",
    "bonusPodiumExactExplain": "A csoport meccsenkénti token-keretének {pct}%-a a torna meccsszámával szorozva — a pontos helyezés eltalálásáért, az említés bónusz tetejére.",
```

- [ ] **Step 2: `messages/en.json` — label + explain**

```json
    "bonusPodiumMention": "Podium mention bonus (%)",
    "bonusPodiumExact": "Exact placement bonus (%)",
```

```json
    "bonusPodiumMentionExplain": "{pct}% of the group's per-match token allowance times the number of matches — for each team you correctly place on the podium, credited once when the tournament ends.",
    "bonusPodiumExactExplain": "{pct}% of the group's per-match token allowance times the number of matches — for getting the exact placement right, on top of the mention bonus.",
```

- [ ] **Step 3: JSON validitás + build**

Run: `npm run check && npm run build`
Expected: nincs JSON/TS hiba, a build sikeres.

- [ ] **Step 4: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "i18n: dinamikus dobogó-bónusz szövegek (hu/en)"
```

---

### Task 5: Teljes verifikáció + deploy

**Files:** nincs új fájl.

- [ ] **Step 1: Teljes teszt + build**

Run: `npm run check && npm run test && npm run build`
Expected: minden zöld.

- [ ] **Step 2: Manuális ellenőrzés (dev)**

Run: `npm run dev`, majd nyisd meg egy csoport szabály-dialogját (`Szabályok` gomb). Expected: a „Dobogó" szekcióban `1.5%` és `3%` látszik, alattuk a magyarázó szöveg. A csoport-létrehozás/beállítás űrlapon a dobogó-mezők %-értéket vesznek fel (default 1.5 / 3).

- [ ] **Step 3: Prod migráció (deploy előtt, kézzel)**

A `.env.local` a **dev** branch-re mutat; a prod migrációhoz a prod DATABASE_URL kell. Futtasd a migrációt a production Neon branch-en (a projekt bevett módján — pl. a prod URL-lel `npm run db:migrate`, vagy a szokásos deploy-migrációs lépéssel).
Expected: a `0022`… utáni új migráció lefut, a `groups` táblán megjelenik a két `_pct` oszlop, eltűnik a két régi.

> **FIGYELEM:** a séma-változás csak `db:migrate`-tel mehet ki (CLAUDE.md). A `db:migrate` némán elhasal, ha a napló elcsúszott — ellenőrizd a kimenetet (status 0, a migráció „applied").

- [ ] **Step 4: Push (Vercel deploy)**

```bash
git push
```
Expected: a Vercel elindítja a deployt; mivel a migráció már lefutott, az új kód a `_pct` oszlopokra épül.

- [ ] **Step 5: Prod smoke-check**

A prod (tippcasino.hu) egy csoport szabály-dialogjában ellenőrizd a `%`-os dobogó-sorokat és a magyarázó szöveget.

---

## Megjegyzés a futó WC-hez

A dobogó **egyszer, a `finishTournament`-ben** pontozódik; a WC még aktív. A deploy után, amikor a WC véget ér, már a dinamikus képlet fut: `computePodiumUnit(1.5, 100, meccsszám)` ≈ 156 (mention) és ≈ 312 (exact) a hivatalos csoportban (104 meccs). A már befejezett jégkorong-tornák érintetlenek (nincs visszamenőleges átszámolás).
