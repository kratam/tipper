# Hivatalos tournament csoport — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minden versenysorozathoz egy "Hivatalos" csoport jön létre automatikusan, amibe a felhasználó az első tournament page látogatáskor transzparensen csatlakozik. Egyszerre default tipp-felület új usereknek és globális ranglista mindenkinek.

**Architecture:** Új `groups.isOfficial` boolean flag + system user (`system@tippcasino.local`) mint owner. Lazy auto-join membership a tournament detail page-en. Védelmek (delete/leave/edit) az `isOfficial` flag alapján.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, next-intl (hu/en), Vitest, Shadcn UI, Tailwind v4.

**Spec:** [docs/superpowers/specs/2026-05-03-official-tournament-group-design.md](../specs/2026-05-03-official-tournament-group-design.md)

---

## File Structure

### New files
- `src/lib/official-group.ts` — system user lookup, `createOfficialGroup`, `ensureOfficialMembership`, slug-reservation helper
- `src/components/official-group-card.tsx` — pinned UI blokk a tournament page-en
- `tests/lib/official-group.test.ts` — pure helper unit tesztek (`isReservedOfficialSlug`)
- `drizzle/0012_official_group.sql` — generated migration (Drizzle)
- `scripts/backfill-official-groups.sql` — system user + per-tournament backfill SQL (manuálisan futtatva)

### Modified files
- `src/db/schema.ts` — `isOfficial` oszlop a `groups` táblán
- `src/lib/tokens.ts` — `distributeInitialTokens` ide átmozgatva (refaktor)
- `src/actions/groups.ts` — `distributeInitialTokens` import; reserved name check; `isOfficial` guards delete/leave/update
- `src/actions/admin.ts` — `createOfficialGroup` hívás tournament-create után
- `src/actions/bets.ts` — auto-join safety net
- `src/queries/groups.ts` — `isOfficial=false` szűrő public group queryken
- `src/app/[locale]/tournaments/[slug]/page.tsx` — `ensureOfficialMembership` hívás, official vs user groups szétválasztás, OfficialGroupCard render
- `src/components/tournament-tabs.tsx` — official csoport pin az első helyre a `groupBetInfosByMatch`-ban
- `src/components/group-detail-tabs.tsx` — delete/leave gomb elrejtése + admin override settings láthatóságra
- `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx` — `isOwner` helyett `canEdit` (admin override)
- `messages/hu.json` és `messages/en.json` — új i18n key-ek

---

## Phase 1: Schema foundation

### Task 1: `isOfficial` oszlop a groups schemában

**Files:**
- Modify: `src/db/schema.ts:107-132`

- [ ] **Step 1: Adj hozzá `isOfficial` oszlopot a `groups` definícióhoz**

A `groups` pgTable definícióban, a `description` oszlop után, a tömb-záró `}` előtt:

```typescript
description: text("description"),
isOfficial: boolean("is_official").default(false).notNull(),
createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
```

- [ ] **Step 2: Generáld a Drizzle migrációt**

Run: `npm run db:generate`

A parancs interaktív lesz (`What would you like to do?`). Válaszd: **Add column**. A generált fájl: `drizzle/0012_official_group.sql`. Várt tartalom (kb.):

```sql
ALTER TABLE "groups" ADD COLUMN "is_official" boolean DEFAULT false NOT NULL;
```

- [ ] **Step 3: Verifikáld a migration tartalmát**

Run: `cat drizzle/0012_official_group.sql`
Expected: egyetlen ALTER TABLE statement az `is_official` oszlop hozzáadására.

- [ ] **Step 4: Futtasd a migrációt lokálisan**

Run: `npm run db:migrate`
Expected: "Migration applied" üzenet, error nélkül.

- [ ] **Step 5: Ellenőrizd a TypeScript típusokat**

Run: `npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/0012_official_group.sql drizzle/meta/
git commit -m "feat(db): add is_official flag to groups table"
```

---

### Task 2: System user létrehozás SQL

**Files:**
- Create: `scripts/backfill-official-groups.sql`

- [ ] **Step 1: Hozd létre a backfill SQL fájlt**

Tartalom (csak a system user részét most, a tournament backfillt majd Task 13-ban bővítjük):

```sql
-- System user a hivatalos csoportok owner-eként.
-- Idempotens: ha már létezik (email alapján), no-op.
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

- [ ] **Step 2: Futtasd a SQL-t lokálisan**

Neon MCP-vel a lokális DB-n:
```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: <fájl tartalma>)
```
Vagy `psql` direkt connection stringgel.

Expected: `INSERT 0 1` (vagy `INSERT 0 0` ha már létezett).

- [ ] **Step 3: Verifikáld**

```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: "SELECT id, email, name, is_admin FROM users WHERE email='system@tippcasino.local';")
```
Expected: 1 sor, `is_admin=true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-official-groups.sql
git commit -m "feat(db): add system user backfill SQL"
```

---

## Phase 2: Helper module foundation

### Task 3: `distributeInitialTokens` átmozgatás `lib/tokens.ts`-be

**Files:**
- Modify: `src/lib/tokens.ts` (új export hozzáadása)
- Modify: `src/actions/groups.ts:235-303` (törlés + import)

A jelenlegi `actions/groups.ts:235-303`-ban él a `distributeInitialTokens`. Átmozgatjuk hogy `lib/official-group.ts` is hívhassa, viselkedés ne változzon.

- [ ] **Step 1: Olvasd el a jelenlegi implementációt**

Run: `sed -n '231,303p' src/actions/groups.ts`
Expected: 73 sor — a komment + a `distributeInitialTokens` függvény teljes teste.

- [ ] **Step 2: Másold át a függvényt `src/lib/tokens.ts` végére**

Adj hozzá a `src/lib/tokens.ts` aljához:

```typescript
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tokenLedger } from "@/db/schema";

/**
 * Give a user their initial tokens + catch-up tokens for all matches
 * that have already been distributed in this group.
 */
export async function distributeInitialTokens(
  userId: string,
  groupId: string,
  tournamentId: string,
  initialTokens: number,
  tokenPerMatch: number,
): Promise<void> {
  // 1. Initial tokens (one-time, referenceId=NULL)
  const existingInitial = await db
    .select({ count: sql<number>`count(*)` })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.userId, userId),
        eq(tokenLedger.groupId, groupId),
        eq(tokenLedger.type, "distribution"),
        sql`${tokenLedger.referenceId} IS NULL`,
      ),
    );

  if (Number(existingInitial[0].count) === 0) {
    await db.insert(tokenLedger).values({
      userId,
      groupId,
      tournamentId,
      amount: initialTokens,
      type: "distribution",
    });
  }

  // 2. Catch-up: find all matches that have been distributed to ANY member in this group
  const distributedMatchIds = await db
    .selectDistinct({ matchId: tokenLedger.referenceId })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.groupId, groupId),
        eq(tokenLedger.type, "distribution"),
        sql`${tokenLedger.referenceId} IS NOT NULL`,
      ),
    );

  for (const { matchId } of distributedMatchIds) {
    if (!matchId) continue;

    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenLedger)
      .where(
        and(
          eq(tokenLedger.userId, userId),
          eq(tokenLedger.groupId, groupId),
          eq(tokenLedger.type, "distribution"),
          eq(tokenLedger.referenceId, matchId),
        ),
      );

    if (Number(existing[0].count) > 0) continue;

    await db.insert(tokenLedger).values({
      userId,
      groupId,
      tournamentId,
      amount: tokenPerMatch,
      type: "distribution",
      referenceId: matchId,
    });
  }
}
```

**Megjegyzés:** ha az `import "server-only"` és a többi import már szerepel a fájl tetején, akkor nem kell duplikálni — csak a hiányzó importokat add hozzá.

- [ ] **Step 3: Töröld az eredeti implementációt `actions/groups.ts`-ből**

A `actions/groups.ts:231-303`-as blokkot teljesen töröld (a JSDoc kommentet és a függvényt). A fájl `}` zárója a `leaveGroup` függvény végén legyen az utolsó.

- [ ] **Step 4: Cseréld le a hívásokat importra**

A `actions/groups.ts` tetején, a többi import közé:

```typescript
import { distributeInitialTokens } from "@/lib/tokens";
```

(A három meglévő hívás — `createGroup`, `joinGroup`, `joinPublicGroup` — automatikusan az importált verziót használja.)

- [ ] **Step 5: TS check**

Run: `npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 6: Lint**

Run: `npm run check`
Expected: 0 error.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tokens.ts src/actions/groups.ts
git commit -m "refactor(tokens): move distributeInitialTokens to lib/tokens"
```

---

### Task 4: `lib/official-group.ts` — konstansok + slug-reservation

Pure helpers + DB lookup-ok placeholderként. Most csak az exportált konstansokat és a tiszta `isReservedOfficialSlug` függvényt írjuk meg + tesztet rá. A DB-touching függvényeket (Task 5-6) később.

**Files:**
- Create: `src/lib/official-group.ts`
- Create: `tests/lib/official-group.test.ts`

- [ ] **Step 1: Írd meg a failing tesztet**

`tests/lib/official-group.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { isReservedOfficialSlug, RESERVED_OFFICIAL_SLUGS } from "@/lib/official-group";

describe("isReservedOfficialSlug", () => {
  it("returns true for 'hivatalos'", () => {
    expect(isReservedOfficialSlug("hivatalos")).toBe(true);
  });

  it("returns true for 'official'", () => {
    expect(isReservedOfficialSlug("official")).toBe(true);
  });

  it("returns false for 'hivatalos-vip'", () => {
    expect(isReservedOfficialSlug("hivatalos-vip")).toBe(false);
  });

  it("returns false for 'my-group'", () => {
    expect(isReservedOfficialSlug("my-group")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isReservedOfficialSlug("")).toBe(false);
  });

  it("RESERVED_OFFICIAL_SLUGS contains both languages", () => {
    expect(RESERVED_OFFICIAL_SLUGS).toContain("hivatalos");
    expect(RESERVED_OFFICIAL_SLUGS).toContain("official");
  });
});
```

- [ ] **Step 2: Futtasd a tesztet — fail várt**

Run: `npm run test -- official-group`
Expected: FAIL — "Cannot find module '@/lib/official-group'".

- [ ] **Step 3: Hozd létre a `lib/official-group.ts`-t**

```typescript
import "server-only";

export const SYSTEM_USER_EMAIL = "system@tippcasino.local";

export const OFFICIAL_GROUP_NAME = "Hivatalos";
export const OFFICIAL_GROUP_SLUG = "hivatalos";

export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official"] as const;

export function isReservedOfficialSlug(slug: string): boolean {
  return (RESERVED_OFFICIAL_SLUGS as readonly string[]).includes(slug);
}
```

- [ ] **Step 4: Futtasd a tesztet — passing várt**

Run: `npm run test -- official-group`
Expected: PASS — 6 teszt zöld.

**Probléma:** a `"server-only"` import a teszt környezetben hibát dobhat. Ha igen:
- Mozgasd át a `SYSTEM_USER_EMAIL`, `OFFICIAL_GROUP_NAME`, `OFFICIAL_GROUP_SLUG`, `RESERVED_OFFICIAL_SLUGS`, `isReservedOfficialSlug` exportokat egy új `src/lib/official-group-constants.ts` fájlba (server-only nélkül)
- Az `official-group.ts` re-exportálja őket: `export * from "./official-group-constants";` + a server-only importot a server-side függvényekhez fenntartja
- A teszt `official-group-constants`-ből importáljon

- [ ] **Step 5: Commit**

```bash
git add src/lib/official-group.ts tests/lib/official-group.test.ts
git commit -m "feat(official-group): add slug reservation helpers and constants"
```

---

### Task 5: `getSystemUserId` lookup cache-eléssel

DB lookup, nincs unit test (a projekt nem teszteli a DB-touching kódot — manuálisan validáljuk Task 12-13 után smoke test-tel).

**Files:**
- Modify: `src/lib/official-group.ts`

- [ ] **Step 1: Add hozzá a `getSystemUserId` függvényt**

A `src/lib/official-group.ts` aljához:

```typescript
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

let cachedSystemUserId: string | null = null;

export async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;

  const row = await db.query.users.findFirst({
    where: eq(users.email, SYSTEM_USER_EMAIL),
  });

  if (!row) {
    throw new Error(
      `System user not found (email=${SYSTEM_USER_EMAIL}). ` +
        "Run scripts/backfill-official-groups.sql first.",
    );
  }

  cachedSystemUserId = row.id;
  return row.id;
}
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 3: Manuális smoke test**

Indítsd a dev servert: `npm run dev`
Nyiss egy node REPL-t vagy ideiglenes script-et (vagy hagyd ki ezt a step-et — Task 7 admin flow-jában fog elsőként fontos lenni).

- [ ] **Step 4: Commit**

```bash
git add src/lib/official-group.ts
git commit -m "feat(official-group): add cached system user lookup"
```

---

### Task 6: `createOfficialGroup` és `ensureOfficialMembership`

**Files:**
- Modify: `src/lib/official-group.ts`

- [ ] **Step 1: Add hozzá `createOfficialGroup`-ot**

A fájl aljához (a meglévő importok alá):

```typescript
import { and } from "drizzle-orm";
import { groupMembers, groups } from "@/db/schema";
import { distributeInitialTokens } from "@/lib/tokens";
import { generateInviteCode } from "@/lib/utils";

/**
 * Create the official group for a tournament. Idempotent — if one already
 * exists for this tournament, returns it. The system user is the owner but
 * NOT inserted into group_members (so it doesn't appear as a member).
 */
export async function createOfficialGroup(tournamentId: string) {
  const existing = await db.query.groups.findFirst({
    where: and(eq(groups.tournamentId, tournamentId), eq(groups.isOfficial, true)),
  });
  if (existing) return existing;

  const ownerId = await getSystemUserId();

  const [created] = await db
    .insert(groups)
    .values({
      name: OFFICIAL_GROUP_NAME,
      slug: OFFICIAL_GROUP_SLUG,
      inviteCode: generateInviteCode(),
      ownerId,
      tournamentId,
      tokenPerMatch: 100,
      initialTokens: 200,
      bonusGoalDiff: 5,
      bonusExactScore: 10,
      bonusPodiumMention: 20,
      bonusPodiumExact: 20,
      oddsBoost: 1.1,
      isPublic: true,
      isOfficial: true,
    })
    .returning();

  return created;
}
```

- [ ] **Step 2: Add hozzá `ensureOfficialMembership`-ot**

A `createOfficialGroup` után:

```typescript
/**
 * Idempotent lazy auto-join. If the user is already a member of the
 * tournament's official group → no-op. Otherwise: insert membership and
 * distribute initial + catch-up tokens.
 *
 * Safe to call on every page view. If the official group doesn't exist
 * yet (admin hasn't created the tournament via the new flow), this
 * creates it on demand.
 */
export async function ensureOfficialMembership(
  userId: string,
  tournamentId: string,
): Promise<void> {
  const officialGroup = await createOfficialGroup(tournamentId);

  const existingMembership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, officialGroup.id),
      eq(groupMembers.userId, userId),
    ),
  });
  if (existingMembership) return;

  await db.insert(groupMembers).values({
    groupId: officialGroup.id,
    userId,
  });

  await distributeInitialTokens(
    userId,
    officialGroup.id,
    tournamentId,
    officialGroup.initialTokens,
    officialGroup.tokenPerMatch,
  );
}
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/lib/official-group.ts
git commit -m "feat(official-group): add createOfficialGroup and ensureOfficialMembership"
```

---

## Phase 3: Action integrations

### Task 7: Wire `createOfficialGroup` admin tournament-create-be

**Files:**
- Modify: `src/actions/admin.ts:70-92`

- [ ] **Step 1: Importáld a helpert**

A `src/actions/admin.ts` tetején, a többi import közé:

```typescript
import { createOfficialGroup } from "@/lib/official-group";
```

- [ ] **Step 2: Hívd meg a tournament insert után**

Cseréld ki a `createTournament` függvényt:

```typescript
export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const slug = slugify(input.name);
  const logoUrl = await fetchLeagueLogoUrl(input.apiLeagueId);

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug,
      apiLeagueId: input.apiLeagueId,
      apiSeason: input.apiSeason,
      podiumLockDate: input.podiumLockDate,
      timezone: input.timezone,
      logoUrl,
    })
    .returning();

  // Create the official group for this tournament.
  // If it fails the tournament still exists — the backfill SQL or a manual
  // re-run will create it later.
  await createOfficialGroup(tournament.id);

  return tournament;
}
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Manuális smoke test (opcionális, Task 13 után érdemesebb)**

Hagyd ki most — a teljes flow-t a UI integráció után validáljuk.

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin.ts
git commit -m "feat(admin): auto-create official group on tournament create"
```

---

### Task 8: Reserved name check `createGroup`-ban

**Files:**
- Modify: `src/actions/groups.ts:25-77`

- [ ] **Step 1: Importáld a helpert**

A `src/actions/groups.ts` tetején:

```typescript
import { isReservedOfficialSlug } from "@/lib/official-group";
```

- [ ] **Step 2: Adj hozzá ellenőrzést a `createGroup` elejéhez**

A `slug = slugify(input.name)` sor UTÁN, az `inviteCode` sor előtt:

```typescript
  const slug = slugify(input.name);
  if (isReservedOfficialSlug(slug)) {
    throw new Error("officialGroupNameReserved");
  }
  const inviteCode = generateInviteCode();
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat(groups): block creation of groups with reserved official names"
```

---

### Task 9: `isOfficial` guards `deleteGroup` és `leaveGroup`-ban

**Files:**
- Modify: `src/actions/groups.ts:197-229`

- [ ] **Step 1: Bővítsd a `deleteGroup`-ot**

Cseréld:

```typescript
export async function deleteGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");
  if (group.isOfficial) throw new Error("cannotDeleteOfficial");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");

  // Delete in FK order (podium bets are tournament-scoped, not group-scoped)
  await db.delete(tokenLedger).where(eq(tokenLedger.groupId, groupId));
  await db.delete(bets).where(eq(bets.groupId, groupId));
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
}
```

- [ ] **Step 2: Bővítsd a `leaveGroup`-ot**

Cseréld:

```typescript
export async function leaveGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");
  if (group.isOfficial) throw new Error("cannotLeaveOfficial");
  if (group.ownerId === user.id) {
    throw new Error("Owner cannot leave the group. Transfer ownership or delete the group.");
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
}
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat(groups): block delete/leave on official groups"
```

---

### Task 10: Admin override `updateGroupSettings`-ben

**Files:**
- Modify: `src/actions/groups.ts:152-179`

- [ ] **Step 1: Bővítsd a check-et**

Cseréld le a `updateGroupSettings` ownership-check sorát:

```typescript
export async function updateGroupSettings(groupId: string, settings: GroupSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");

  const canEdit = group.ownerId === user.id || (user.isAdmin && group.isOfficial);
  if (!canEdit) throw new Error("Unauthorized");

  // ... rest unchanged
```

A többi (isPublic/description vs game settings) változatlan.

- [ ] **Step 2: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat(groups): allow admins to edit settings of official groups"
```

---

### Task 11: `placeBet` safety net auto-join

**Files:**
- Modify: `src/actions/bets.ts:21-46`

- [ ] **Step 1: Importáld a helpert**

A `src/actions/bets.ts` tetején:

```typescript
import { ensureOfficialMembership } from "@/lib/official-group";
```

- [ ] **Step 2: Add hozzá auto-join-t a membership check előtt**

Cseréld a `placeBet` elejét (a `Verify membership` blokk előtt):

```typescript
  const { matchId, groupId, predictedHome, predictedAway, stake } = input;

  // Get group info early — needed for tournamentId and isOfficial check
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) return { success: false, error: "Group not found" };

  // Safety net: auto-join official group if user is somehow not a member.
  // Idempotent — no-op if already joined.
  if (group.isOfficial) {
    await ensureOfficialMembership(user.id, group.tournamentId);
  }

  // Verify membership
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (!membership) return { success: false, error: "Not a member of this group" };
```

**Fontos:** ezzel a `Get group info for tournamentId` blokk (37-46. sor) duplikálódik — töröld a régi `const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });` blokkot és a kapcsolódó `if (!group)` ellenőrzést a fájl alsóbb részéről, ahol már megvan az új helyen.

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/actions/bets.ts
git commit -m "feat(bets): auto-join official group as safety net on placeBet"
```

---

## Phase 4: Query updates

### Task 12: Public group queryk szűrése `isOfficial=false`-ra

A `getTopPublicGroupsForTournament` és `getPublicGroups` jelenleg a hivatalos csoportot is felajánlaná (mert `isPublic=true`). Szűrjük ki.

**Files:**
- Modify: `src/queries/groups.ts:289-374`

- [ ] **Step 1: Bővítsd a `getPublicGroups`-ot**

Cseréld:

```typescript
export async function getPublicGroups(userId: string) {
  const userGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const excludeIds = userGroupIds.map((r) => r.groupId);

  return db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      eq(groups.isOfficial, false),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      owner: true,
      members: true,
    },
  });
}
```

- [ ] **Step 2: Bővítsd a `getTopPublicGroupsForTournament`-et**

Cseréld a `where` blokkot:

```typescript
  const rows = await db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      eq(groups.isOfficial, false),
      eq(groups.tournamentId, tournamentId),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      members: true,
    },
  });
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/queries/groups.ts
git commit -m "feat(queries): exclude official groups from public group suggestions"
```

---

## Phase 5: Backfill SQL

### Task 13: Tournament backfill — minden meglévő tournamenthez hivatalos csoport

**Files:**
- Modify: `scripts/backfill-official-groups.sql`

- [ ] **Step 1: Bővítsd a backfill SQL-t**

Add hozzá a `scripts/backfill-official-groups.sql` aljához (a system user insert UTÁN):

```sql
-- Backfill: minden tournament-hez hivatalos csoport, ha még nincs.
-- Idempotens: WHERE NOT EXISTS check az is_official=true flag-en.
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
  encode(gen_random_bytes(6), 'hex'),
  (SELECT id FROM users WHERE email = 'system@tippcasino.local'),
  t.id,
  100, 200, 5, 10, 20, 20, 1.1, true, true
FROM tournaments t
WHERE NOT EXISTS (
  SELECT 1 FROM groups g
  WHERE g.tournament_id = t.id AND g.is_official = true
);
```

- [ ] **Step 2: Futtasd a backfillt lokálisan**

```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: "<scripts/backfill-official-groups.sql tartalma>")
```

Expected: `INSERT 0 N` ahol N = aktuális tournamentek száma (pl. 2-3).

- [ ] **Step 3: Verifikáld**

```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: "SELECT t.name AS tournament, g.name AS group_name, g.is_official, g.odds_boost FROM groups g JOIN tournaments t ON g.tournament_id = t.id WHERE g.is_official = true;")
```
Expected: minden tournament-hez 1 sor, `is_official=true`, `odds_boost=1.1`.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-official-groups.sql
git commit -m "feat(db): add tournament official group backfill SQL"
```

---

## Phase 6: UI integráció

### Task 14: Tournament page — `ensureOfficialMembership` + group szétválasztás

**Files:**
- Modify: `src/app/[locale]/tournaments/[slug]/page.tsx:20-95`

- [ ] **Step 1: Importáld a helpert**

A page.tsx tetején:

```typescript
import { ensureOfficialMembership } from "@/lib/official-group";
```

- [ ] **Step 2: Hívd meg a Phase 1 után**

A `if (!tournament) notFound();` UTÁN, a `Phase 2` Promise.all ELŐTT:

```typescript
  if (!tournament) notFound();

  // Lazy auto-join to the tournament's official group. Idempotent.
  await ensureOfficialMembership(user.id, tournament.id);

  // Phase 2: all independent data in parallel
```

- [ ] **Step 3: Szeparáld official vs user groups**

A `relevantGroups` definíció UTÁN:

```typescript
  const relevantGroups = userGroupMemberships.filter(
    (gm) => gm.group.tournamentId === tournament.id,
  );

  const officialGroupMembership = relevantGroups.find((gm) => gm.group.isOfficial);
  const userGroupMemberships_ = relevantGroups.filter((gm) => !gm.group.isOfficial);

  // Phase 2.5: top public groups if user has NO custom groups (official always exists)
  const topPublicGroups: PublicGroupSuggestion[] =
    userGroupMemberships_.length === 0
      ? await getTopPublicGroupsForTournament(user.id, tournament.id, 2)
      : [];
```

**Megjegyzés:** a `topPublicGroups` feltétel `relevantGroups.length === 0` helyett `userGroupMemberships_.length === 0` lett — most már mindig van legalább a hivatalos, de a public ajánlás csak akkor érdekes, ha NINCS sajátja.

- [ ] **Step 4: Add hozzá officialGroupCard adatait a render előtt**

A `groupBetInfosByMatch` build UTÁN, a `return` ELŐTT:

```typescript
  // Build official group card data
  const officialCard = officialGroupMembership
    ? (() => {
        const og = officialGroupMembership.group;
        const lb = groupLeaderboards.find((l) => l.groupId === og.id);
        return {
          groupId: og.id,
          groupName: og.name,
          groupSlug: og.slug,
          tournamentSlug: tournament.slug,
          oddsBoost: og.oddsBoost,
          tokenPerMatch: og.tokenPerMatch,
          myProfit: lb?.myProfit ?? 0,
          myRank: lb?.myRank ?? null,
          miniLeaderboard: lb?.miniLeaderboard ?? [],
        };
      })()
    : null;
```

- [ ] **Step 5: Adj hozzá `officialCard` propot a `TournamentTabs`-nak**

A `<TournamentTabs ... />` JSX-ben (utolsó prop előtt):

```tsx
        topPublicGroups={topPublicGroups}
        officialCard={officialCard}
```

(A `TournamentTabs` propot Task 16-ban definiáljuk.)

- [ ] **Step 6: TS check**

Run: `npx tsc --noEmit`
Expected: error a `officialCard` propnál (még nincs definiálva `TournamentTabs`-ban) — Task 16-ban javítjuk. **Ne commit-olj még** — együtt megy a következő task-kal.

---

### Task 15: `OfficialGroupCard` komponens

**Files:**
- Create: `src/components/official-group-card.tsx`

- [ ] **Step 1: Hozd létre a komponenst**

```tsx
"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface OfficialGroupCardProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
}

export function OfficialGroupCard({
  groupName,
  groupSlug,
  tournamentSlug,
  oddsBoost,
  myProfit,
  myRank,
  miniLeaderboard,
  currentUserId,
}: OfficialGroupCardProps) {
  const t = useTranslations("groups");

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-amber-500" />
          <CardTitle className="text-base">{groupName}</CardTitle>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
            {t("officialBadge")}
          </Badge>
        </div>
        <Link
          href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
          className="text-muted-foreground text-xs hover:text-foreground"
        >
          {t("viewDetails")} →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("oddsBoost")}: <span className="font-mono text-amber-500">×{oddsBoost}</span>
          </span>
          <span className="text-muted-foreground">
            {t("myRank")}:{" "}
            <span className="font-bold font-mono">
              {myRank ? `#${myRank}` : "—"}
            </span>{" "}
            • {t("myProfit")}:{" "}
            <span className="font-bold font-mono text-amber-500">{myProfit}</span>
          </span>
        </div>
        {miniLeaderboard.length > 0 && (
          <div className="flex flex-col gap-1 border-border/40 border-t pt-2">
            {miniLeaderboard.map((row) => {
              const isCurrentUser = row.userId === currentUserId;
              return (
                <div
                  key={row.userId}
                  className={`flex items-center gap-2 px-2 py-1 text-xs ${
                    isCurrentUser ? "bg-amber-500/5" : ""
                  }`}
                >
                  <span className="w-6 font-mono">#{row.rank}</span>
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[10px]">
                      {row.userName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{row.userName}</span>
                  <span className="font-mono text-amber-500">{row.profit}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: TS check (lesz error a Task 16-ig)**

Run: `npx tsc --noEmit`
Expected: error a `i18n` key-ekre (`officialBadge`, `viewDetails`, `myRank`, `myProfit`) — Task 18-ban adjuk hozzá.

---

### Task 16: `TournamentTabs` propot fogad + sorrend

**Files:**
- Modify: `src/components/tournament-tabs.tsx`

- [ ] **Step 1: Olvasd el a render-blokkot a tournament-tabs.tsx-ből**

Run: `sed -n '60,76p' src/components/tournament-tabs.tsx`
Expected: a `TournamentTabsProps` interface.

- [ ] **Step 2: Add hozzá a propot az interface-hez**

A `TournamentTabsProps` interface-ben, az utolsó prop előtt:

```typescript
interface OfficialCardData {
  groupId: string;
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  tokenPerMatch: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}

interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  timezone: string;
  podiumLockDate: string;
  teams: TeamOption[];
  existingPodiumBet: ExistingPodiumBet | null;
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
  groupLeaderboards: GroupLeaderboardData[];
  currentUserId: string;
  topPublicGroups?: PublicGroupSuggestion[];
  officialCard: OfficialCardData | null;
}
```

- [ ] **Step 3: Destructureáld az új propot**

A komponens body elején, a többi destructure mellé add hozzá `officialCard`-ot.

- [ ] **Step 4: Importáld az `OfficialGroupCard`-ot**

A többi import közé:

```typescript
import { OfficialGroupCard } from "@/components/official-group-card";
```

- [ ] **Step 5: Renderelj OfficialGroupCard-ot a Tabs FELETT**

A `return (...)` JSX root-ja jelenleg `<Tabs>` (vagy hasonló). Csomagold be egy fragmentbe és tedd elé a kártyát:

```tsx
  return (
    <>
      {officialCard && (
        <OfficialGroupCard
          groupName={officialCard.groupName}
          groupSlug={officialCard.groupSlug}
          tournamentSlug={officialCard.tournamentSlug}
          oddsBoost={officialCard.oddsBoost}
          myProfit={officialCard.myProfit}
          myRank={officialCard.myRank}
          miniLeaderboard={officialCard.miniLeaderboard}
          currentUserId={currentUserId}
        />
      )}
      <Tabs ... >
        ...
      </Tabs>
    </>
  );
```

- [ ] **Step 6: A meccs-tipp formoknál a hivatalos csoport mindig elsõ**

A `groupBetInfosByMatch` használatánál (keresd meg a komponensben a `groupBetInfosByMatch[match.id]` referenciát — feltehetően a MatchCard-nak adja át valamilyen useMemo-val sortolva). Ha jelenleg nincs sorrend-stabilizálás:

A `useMemo` blokkban — vagy közvetlenül a használat előtt — sortold:

```typescript
const sortedGroupInfosByMatch = useMemo(() => {
  const result: Record<string, GroupBetInfo[]> = {};
  for (const [matchId, groups] of Object.entries(groupBetInfosByMatch)) {
    result[matchId] = [...groups].sort((a, b) => {
      // Official group always first — find it by groupId match with officialCard
      if (a.groupId === officialCard?.groupId) return -1;
      if (b.groupId === officialCard?.groupId) return 1;
      return 0;
    });
  }
  return result;
}, [groupBetInfosByMatch, officialCard?.groupId]);
```

És cseréld a `groupBetInfosByMatch` minden használatát `sortedGroupInfosByMatch`-re.

- [ ] **Step 7: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: error a hiányzó i18n key-ekre — Task 18-ban javítjuk. Egyéb error nélkül.

---

### Task 17: `group-detail-tabs.tsx` — official védelem és admin override

**Files:**
- Modify: `src/components/group-detail-tabs.tsx`
- Modify: `src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`

- [ ] **Step 1: Új prop a `GroupDetailTabsProps`-hoz**

A `src/components/group-detail-tabs.tsx:70-82` interface-ben:

```typescript
interface GroupDetailTabsProps {
  groupId: string;
  isOwner: boolean;
  isOfficial: boolean;        // ÚJ
  canEditSettings: boolean;   // ÚJ — owner OR (admin AND isOfficial)
  currentUserId: string;
  tournamentStatus: string;
  isPublic: boolean;
  description: string | null;
  leaderboard: LeaderboardRow[];
  members: MemberInfo[];
  settings: GroupSettings;
  finishedMatches: FinishedMatch[];
  groupBets: GroupBet[];
}
```

És a destructure-ban add hozzá `isOfficial, canEditSettings`-et.

- [ ] **Step 2: Cseréld a vezérlő boolean-eket**

A jelenlegi:
- `{isOwner && <TabsTrigger value="settings">...}` → `{canEditSettings && ...}`
- A Settings tab teljes blokkja `{isOwner && (<TabsContent value="settings">...)}` → `{canEditSettings && (...)}`
- A "Csoport elhagyása" gomb `{!isOwner && (<Button ... onClick={handleLeaveGroup}>...)}` → `{!isOwner && !isOfficial && (...)}`
- A "Csoport törlése" gomb a settings tabon: csomagold be `{!isOfficial && (<Button ...>)}`-be

- [ ] **Step 3: A page.tsx-ben számold ki a propokat**

`src/app/[locale]/tournaments/[slug]/groups/[gSlug]/page.tsx`-ben (jelenleg `const isOwner = group.ownerId === user.id;` van a 36. soron):

```typescript
const isOwner = group.ownerId === user.id;
const canEditSettings = isOwner || (user.isAdmin && group.isOfficial);
```

És add át a `<GroupDetailTabs>` JSX-nek:

```tsx
<GroupDetailTabs
  ...
  isOwner={isOwner}
  isOfficial={group.isOfficial}
  canEditSettings={canEditSettings}
  ...
/>
```

- [ ] **Step 4: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error (i18n key-ek külön task-ban).

- [ ] **Step 5: Commit (Task 14-17 együtt)**

```bash
git add src/app/\[locale\]/tournaments/\[slug\]/page.tsx \
        src/app/\[locale\]/tournaments/\[slug\]/groups/\[gSlug\]/page.tsx \
        src/components/official-group-card.tsx \
        src/components/tournament-tabs.tsx \
        src/components/group-detail-tabs.tsx
git commit -m "feat(ui): pinned official group card + protect official group on detail page"
```

---

### Task 18: i18n kulcsok

**Files:**
- Modify: `messages/hu.json` (a `groups` szekcióhoz)
- Modify: `messages/en.json` (a `groups` szekcióhoz)

- [ ] **Step 1: Add hozzá a magyar kulcsokat**

A `messages/hu.json` `"groups": { ... }` szekciójának végére (a záró `}` előtt):

```json
    "officialBadge": "Hivatalos",
    "viewDetails": "Részletek",
    "myRank": "Helyezésed",
    "myProfit": "Profitod",
    "officialGroupNameReserved": "Ez a név fenntartva a hivatalos csoportoknak",
    "cannotDeleteOfficial": "Hivatalos csoport nem törölhető",
    "cannotLeaveOfficial": "Hivatalos csoportból nem lehet kilépni"
```

(figyelj a meglévő utolsó kulcs vesszőjére, ha kell tedd ki)

- [ ] **Step 2: Add hozzá az angol kulcsokat**

A `messages/en.json` `"groups": { ... }` szekciójának végére:

```json
    "officialBadge": "Official",
    "viewDetails": "Details",
    "myRank": "Your rank",
    "myProfit": "Your profit",
    "officialGroupNameReserved": "This name is reserved for official groups",
    "cannotDeleteOfficial": "Official groups cannot be deleted",
    "cannotLeaveOfficial": "Cannot leave the official group"
```

- [ ] **Step 3: TS check + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: 0 error.

- [ ] **Step 4: Build sanity check**

Run: `npm run build`
Expected: build sikeres, errors nélkül.

- [ ] **Step 5: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat(i18n): add official group translation keys"
```

---

## Phase 7: End-to-end smoke test

### Task 19: Manuális smoke test

**Cél:** validáld a teljes flow-t lokálisan a dev serveren.

- [ ] **Step 1: Indítsd el a dev servert**

Run: `npm run dev`
Várd amíg a "Ready in" üzenet megjelenik.

- [ ] **Step 2: Bejelentkezés és tournament page nyitás**

Nyisd: `http://localhost:3000/tournaments` — log in Google-lel ha kell.

Kattints egy meglévő tournament-re (pl. "Jégkorong VB 2026" vagy bármelyik upcoming/active).

**Várt eredmény:**
- A page tetején megjelenik a **Hivatalos** kártya (arany koronával)
- A meccs-tipp formoknál a "Hivatalos" mindig az első sor
- Az új kártyán látszik az `oddsBoost: ×1.1`, helyezésed és profitod (kezdetben "—" / 0)

- [ ] **Step 3: Tipp leadása a hivatalos csoportban**

Kattints egy upcoming meccsre, válaszd a "Hivatalos" csoport sorát, adj le egy tippet (pl. 50 token).

**Várt eredmény:**
- Toast siker
- Token egyenleg csökken
- A `token_ledger` táblában látszik a `bet` típusú sor

Verifikáció:
```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: "SELECT type, amount FROM token_ledger tl JOIN groups g ON tl.group_id = g.id WHERE g.is_official = true AND tl.user_id = (SELECT id FROM users WHERE email = '<saját email>') ORDER BY tl.created_at DESC LIMIT 5;")
```

- [ ] **Step 4: Próbáld törölni / elhagyni a hivatalos csoportot**

Nyisd meg a hivatalos csoport detail oldalát: `/tournaments/<tslug>/groups/hivatalos`.

**Várt eredmény:**
- "Csoport elhagyása" gomb **nem látszik**
- Settings tab **látszik** (mert admin vagy)
- Settings tab-on "Csoport törlése" gomb **nem látszik**

- [ ] **Step 5: Próbálj "Hivatalos" nevű csoportot létrehozni**

Nyisd meg `/groups` (vagy ahonnan a "Új csoport létrehozása" elérhető). Kérj létrehozást "Hivatalos" névvel.

**Várt eredmény:**
- Toast hiba: "Ez a név fenntartva a hivatalos csoportoknak"

- [ ] **Step 6: Új tournament létrehozás admin felületen**

`/admin` → új tournament. A tournament insertálódik, és az official csoport automatikusan létrejön.

Verifikáció:
```
mcp__Neon__run_sql(projectId: "patient-leaf-69938778", sql: "SELECT t.name, g.name AS group_name FROM tournaments t LEFT JOIN groups g ON g.tournament_id = t.id AND g.is_official = true ORDER BY t.created_at DESC LIMIT 5;")
```
Expected: minden új tournament-hez van `Hivatalos` csoport.

- [ ] **Step 7: Második user (incognito) — onboarding**

Nyiss inkognitó ablakot, jelentkezz be egy másik Google-lel (vagy logout + login egy másik fiókkal). Nyiss meg egy tournament page-et.

**Várt eredmény:**
- A Hivatalos kártya rögtön ott van
- A user-nek azonnal van token-egyenlege (initial 200)
- Tippelhet a Hivatalos sorra anélkül hogy bármit "csatlakozott" volna

- [ ] **Step 8: Ha minden OK, commit-old a smoke test eredményét (opcionális dokumentáció)**

Nincs kód-változás itt, csak validáció. Ha bármi nem stimmel, javítsd a megfelelő task implementációját és re-run.

---

## Self-Review

### Spec coverage

- ✅ Schema: `groups.isOfficial` → Task 1
- ✅ System user: `system@tippcasino.local` → Task 2
- ✅ Helpers (`createOfficialGroup`, `ensureOfficialMembership`): Task 4-6
- ✅ Auto-creation tournament-create: Task 7
- ✅ Reserved name check: Task 8
- ✅ Delete/Leave guards: Task 9
- ✅ Admin override settings: Task 10 + 17
- ✅ placeBet safety net: Task 11
- ✅ Public group query exclusion: Task 12
- ✅ Backfill SQL: Task 13
- ✅ Tournament page lazy join + UI: Task 14
- ✅ OfficialGroupCard: Task 15
- ✅ Tournament-tabs sort + render: Task 16
- ✅ Group-detail-tabs guards + admin override: Task 17
- ✅ i18n keys: Task 18
- ✅ Manual smoke test: Task 19

### Type/name consistency

- `OFFICIAL_GROUP_NAME` / `OFFICIAL_GROUP_SLUG` / `RESERVED_OFFICIAL_SLUGS` / `SYSTEM_USER_EMAIL` — konzisztens, ugyanaz a forrás (`lib/official-group.ts`).
- `isReservedOfficialSlug(slug)` használat: Task 4 definiálja, Task 8 használja — egyezik.
- `createOfficialGroup(tournamentId)` definíció Task 5-ben → használat Task 7 (`admin.ts`) + Task 6 (`ensureOfficialMembership`) → egyezik.
- `ensureOfficialMembership(userId, tournamentId)` definíció Task 6 → használat Task 11 (`placeBet`) + Task 14 (page.tsx) → egyezik.
- `OfficialCardData` interface Task 14-ben definiálva (page.tsx-ben épül), Task 16-ban deklarálva mint prop-típus — mezők azonosak.

### Placeholder scan

- Nincs "TBD" / "TODO" / "implement later".
- Minden lépésnél konkrét kód vagy konkrét parancs.
- Egyetlen helyen van feltételes lépés (Task 4 Step 4 — server-only import probléma): explicit fallback megoldás van leírva (constants külön fájlba).

### Out-of-scope (kihagyott)

- Leaderboard pagination (1000+ aktív user) — későbbi
- Tournament-create wizardban inline hivatalos beállítások — admin majd a Settings tabon
- E2E Playwright tesztek (a TODO.md-ben van önállóan)
