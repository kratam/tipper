# Public Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public group visibility, group descriptions (markdown), redesigned group cards, and a public groups section with preview dialog on the groups page.

**Architecture:** Two new columns on `groups` table (`is_public`, `description`). New `GroupCard` component with gradient header replaces inline cards. New `PublicGroupDialog` for preview+join. New `getPublicGroups` query. New `joinPublicGroup` server action. `react-markdown` for rendering descriptions.

**Tech Stack:** Drizzle ORM (migration), React/Next.js 16 (App Router), Shadcn UI (Dialog, Badge, Switch, Textarea), react-markdown, lucide-react icons, next-intl (i18n).

**Spec:** `docs/superpowers/specs/2026-04-04-public-groups-design.md`

---

### Task 1: DB schema + migration

**Files:**
- Modify: `src/db/schema.ts:101-121` (groups table)
- Create: Drizzle migration via `drizzle-kit generate`

- [ ] **Step 1: Add `isPublic` and `description` columns to groups table in schema**

In `src/db/schema.ts`, add two fields to the `groups` table definition, after `oddsBoost`:

```typescript
isPublic: boolean("is_public").default(false).notNull(),
description: text("description"),
```

- [ ] **Step 2: Generate Drizzle migration**

Run:
```bash
npx drizzle-kit generate
```

Expected: A new migration file in `drizzle/` directory with `ALTER TABLE groups ADD COLUMN is_public ...` and `ALTER TABLE groups ADD COLUMN description ...`.

- [ ] **Step 3: Apply migration to Neon DB**

Run:
```bash
npx drizzle-kit push
```

Expected: Migration applied successfully, no errors.

- [ ] **Step 4: Verify schema**

Run:
```bash
npx drizzle-kit studio
```

Open Drizzle Studio and confirm `groups` table now has `is_public` (boolean, default false) and `description` (text, nullable) columns.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add isPublic and description columns to groups table"
```

---

### Task 2: i18n translations

**Files:**
- Modify: `messages/hu.json:84-124` (groups section)
- Modify: `messages/en.json:84-124` (groups section)

- [ ] **Step 1: Add Hungarian translations**

In `messages/hu.json`, add these keys inside the `"groups"` object (before the closing `}`):

```json
"publicGroups": "Nyilvános csoportok",
"publicGroupsSubtitle": "Csatlakozz bármelyikhez egyetlen kattintással",
"joinGroup": "Csatlakozás",
"descriptionLabel": "Leírás",
"rules": "Szabályok",
"oddsBoostLabel": "Odds szorzó",
"podiumBonus": "Dobogó bónusz",
"public": "Nyilvános",
"publicDescription": "Bárki csatlakozhat meghívó nélkül",
"descriptionPlaceholder": "Írd le a csoportot (opcionális, markdown támogatott)",
"active": "aktív",
"upcoming": "hamarosan",
"finished": "befejezett",
"memberCount": "{count} tag",
"joinSuccess": "Sikeresen csatlakoztál!",
"noPublicGroups": "Nincs elérhető nyilvános csoport"
```

- [ ] **Step 2: Add English translations**

In `messages/en.json`, add these keys inside the `"groups"` object:

```json
"publicGroups": "Public Groups",
"publicGroupsSubtitle": "Join any group with a single click",
"joinGroup": "Join Group",
"descriptionLabel": "Description",
"rules": "Rules",
"oddsBoostLabel": "Odds boost",
"podiumBonus": "Podium bonus",
"public": "Public",
"publicDescription": "Anyone can join without an invite",
"descriptionPlaceholder": "Describe your group (optional, markdown supported)",
"active": "active",
"upcoming": "upcoming",
"finished": "finished",
"memberCount": "{count} members",
"joinSuccess": "Successfully joined!",
"noPublicGroups": "No public groups available"
```

- [ ] **Step 3: Verify no JSON syntax errors**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('messages/hu.json'))" && echo "hu.json OK"
node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && echo "en.json OK"
```

Expected: Both print OK.

- [ ] **Step 4: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat: add i18n translations for public groups"
```

---

### Task 3: Install react-markdown

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-markdown**

Run:
```bash
npm install react-markdown
```

Expected: `react-markdown` added to dependencies in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown dependency"
```

---

### Task 4: GroupCard component

**Files:**
- Create: `src/components/group-card.tsx`

- [ ] **Step 1: Create GroupCard component**

Create `src/components/group-card.tsx`:

```tsx
"use client";

import { Globe, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tournament: {
      name: string;
      status: string;
    };
  };
  memberCount: number;
  balance?: number;
  variant?: "own" | "public";
  onClick?: () => void;
}

function TokenBadge({ balance }: { balance: number }) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-black/25 px-2 py-1">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="#f59e0b"
        stroke="none"
      >
        <circle cx="12" cy="12" r="10" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#fff"
        >
          T
        </text>
      </svg>
      <span className="font-mono text-sm font-bold text-amber-500">
        {balance.toLocaleString()}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("groups");
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    upcoming: "bg-yellow-500/10 text-yellow-600",
    finished: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={cn("text-[10px]", styles[status])}>
      {t(status as "active" | "upcoming" | "finished")}
    </Badge>
  );
}

function CardInner({
  group,
  memberCount,
  balance,
  variant = "own",
}: GroupCardProps) {
  const t = useTranslations("groups");
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        variant === "public"
          ? "border-dashed border-border"
          : "border-border shadow-sm hover:ring-1 hover:ring-foreground/20",
      )}
    >
      {/* Gradient header */}
      <div className="bg-linear-to-br from-[#1e3a5f] to-[#2d1b69] p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {group.name}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-white/55">
              {group.tournament.name}
            </div>
          </div>
          {variant === "own" && balance != null ? (
            <TokenBadge balance={balance} />
          ) : (
            <Globe className="size-4 shrink-0 text-white/35" />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-card p-3">
        {group.description && (
          <p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {group.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Users className="size-3" />
            {t("memberCount", { count: memberCount })}
          </span>
          <StatusBadge status={group.tournament.status} />
        </div>
      </div>
    </div>
  );
}

export function GroupCard(props: GroupCardProps) {
  if (props.variant === "public" && props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className="text-left">
        <CardInner {...props} />
      </button>
    );
  }

  return (
    <Link href={`/groups/${props.group.slug}`}>
      <CardInner {...props} />
    </Link>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run:
```bash
npx next build --no-lint 2>&1 | tail -5
```

Expected: Build succeeds (component not yet used, but should compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/group-card.tsx
git commit -m "feat: add GroupCard component with gradient header design"
```

---

### Task 5: getPublicGroups query

**Files:**
- Modify: `src/queries/groups.ts`

- [ ] **Step 1: Add getPublicGroups query**

Add this import at the top of `src/queries/groups.ts` (extend existing imports):

```typescript
import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { groupMembers, groups, matches, tokenLedger, tournaments } from "@/db/schema";
```

Then add this function at the end of the file:

```typescript
export async function getPublicGroups(userId: string) {
  // Get user's existing group IDs
  const userGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const excludeIds = userGroupIds.map((r) => r.groupId);

  return db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
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

Note: The tournament status filter (`!= finished`) will be applied in the page component after fetching, since we already have the tournament data loaded via the relation.

- [ ] **Step 2: Verify TypeScript**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors related to `getPublicGroups`.

- [ ] **Step 3: Commit**

```bash
git add src/queries/groups.ts
git commit -m "feat: add getPublicGroups query"
```

---

### Task 6: joinPublicGroup server action

**Files:**
- Modify: `src/actions/groups.ts`

- [ ] **Step 1: Add joinPublicGroup action**

Add this function to `src/actions/groups.ts` after the existing `joinGroup` function:

```typescript
export async function joinPublicGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: and(eq(groups.id, groupId), eq(groups.isPublic, true)),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");
  if (group.tournament.status === "finished") {
    throw new Error("Tournament has finished");
  }

  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (existing) throw new Error("Already a member of this group");

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  await distributeInitialTokens(
    user.id,
    group.id,
    group.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
  );
}
```

Also add `and` to the drizzle-orm import if not already there (it is — confirmed from the file).

- [ ] **Step 2: Extend CreateGroupInput interface and createGroup**

Update `CreateGroupInput` to include the new fields:

```typescript
interface CreateGroupInput {
  name: string;
  tournamentId: string;
  isPublic?: boolean;
  description?: string;
  tokenPerMatch?: number;
  initialTokens?: number;
  distributionDaysBefore?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
}
```

In `createGroup`, add the new fields to the `.values()` spread:

```typescript
...(input.isPublic != null && { isPublic: input.isPublic }),
...(input.description != null && { description: input.description }),
```

- [ ] **Step 3: Extend updateGroupSettings to support description and isPublic**

Update the `GroupSettings` interface:

```typescript
interface GroupSettings {
  isPublic?: boolean;
  description?: string;
  tokenPerMatch?: number;
  initialTokens?: number;
  distributionDaysBefore?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
}
```

In `updateGroupSettings`, allow `isPublic` and `description` changes even when tournament is active. Replace the current function body:

```typescript
export async function updateGroupSettings(groupId: string, settings: GroupSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");

  // isPublic and description can always be changed
  // Game rules can only be changed when tournament is upcoming
  const { isPublic, description, ...gameSettings } = settings;
  const alwaysUpdatable: Record<string, unknown> = {};
  if (isPublic != null) alwaysUpdatable.isPublic = isPublic;
  if (description !== undefined) alwaysUpdatable.description = description;

  const hasGameSettings = Object.values(gameSettings).some((v) => v != null);
  if (hasGameSettings && group.tournament.status !== "upcoming") {
    throw new Error("Settings can only be changed while tournament is upcoming");
  }

  const updates = { ...alwaysUpdatable, ...(hasGameSettings ? gameSettings : {}) };
  if (Object.keys(updates).length > 0) {
    await db.update(groups).set(updates).where(eq(groups.id, groupId));
  }
}
```

- [ ] **Step 4: Verify TypeScript**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/actions/groups.ts
git commit -m "feat: add joinPublicGroup action and extend create/update for isPublic+description"
```

---

### Task 7: PublicGroupDialog component

**Files:**
- Create: `src/components/public-group-dialog.tsx`

- [ ] **Step 1: Create PublicGroupDialog component**

Create `src/components/public-group-dialog.tsx`:

```tsx
"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { joinPublicGroup } from "@/actions/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface PublicGroupDialogProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    tokenPerMatch: number;
    initialTokens: number;
    bonusGoalDiff: number;
    bonusExactScore: number;
    bonusPodiumMention: number;
    oddsBoost: number;
    tournament: {
      name: string;
      status: string;
    };
  };
  memberCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("groups");
  const styles: Record<string, string> = {
    active: "bg-green-500/20 text-green-300",
    upcoming: "bg-yellow-500/20 text-yellow-300",
  };
  return (
    <Badge variant="secondary" className={cn("text-[11px]", styles[status])}>
      {t(status as "active" | "upcoming")}
    </Badge>
  );
}

function RuleBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

export function PublicGroupDialog({
  group,
  memberCount,
  open,
  onOpenChange,
}: PublicGroupDialogProps) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      try {
        await joinPublicGroup(group.id);
        toast.success(t("joinSuccess"));
        onOpenChange(false);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md overflow-hidden p-0 sm:max-w-md"
      >
        {/* Gradient header */}
        <div className="bg-linear-to-br from-[#1e3a5f] to-[#2d1b69] p-6">
          <DialogTitle className="text-lg font-bold text-white">
            {group.name}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/60">
            {group.tournament.name}
          </DialogDescription>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-white/50">
              {t("memberCount", { count: memberCount })}
            </span>
            <StatusBadge status={group.tournament.status} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 pt-0 mt-0">
          <div className="p-0 pt-4">
            {/* Description */}
            {group.description && (
              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("descriptionLabel")}
                </div>
                <div className="prose prose-sm max-w-none text-sm text-foreground/80 prose-strong:text-foreground prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown
                    allowedElements={[
                      "p",
                      "strong",
                      "em",
                      "ul",
                      "ol",
                      "li",
                      "a",
                      "br",
                    ]}
                  >
                    {group.description}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Rules grid */}
            <div className="mb-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("rules")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RuleBox label={t("tokenPerMatch")} value={String(group.tokenPerMatch)} />
                <RuleBox label={t("initialTokens")} value={String(group.initialTokens)} />
                <RuleBox label={t("bonusGoalDiff")} value={`+${group.bonusGoalDiff}`} />
                <RuleBox label={t("bonusExactScore")} value={`+${group.bonusExactScore}`} />
                <RuleBox label={t("oddsBoostLabel")} value={`${group.oddsBoost}x`} />
                <RuleBox label={t("podiumBonus")} value={`+${group.bonusPodiumMention}`} />
              </div>
            </div>

            {/* Join button */}
            <Button
              onClick={handleJoin}
              disabled={isPending}
              className="w-full gap-2"
            >
              <UserPlus className="size-4" />
              {t("joinGroup")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/public-group-dialog.tsx
git commit -m "feat: add PublicGroupDialog component with markdown description and rules grid"
```

---

### Task 8: Update groups page

**Files:**
- Modify: `src/app/[locale]/groups/page.tsx`

- [ ] **Step 1: Rewrite groups page with GroupCard and public groups section**

Replace the entire content of `src/app/[locale]/groups/page.tsx`:

```tsx
import { Globe, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GroupCard } from "@/components/group-card";
import { PublicGroupsSection } from "@/components/public-groups-section";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getPublicGroups, getTokenBalance, getUserGroups } from "@/queries/groups";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("groups");
  const memberships = await getUserGroups(user.id);

  const groupsWithBalances = await Promise.all(
    memberships.map(async (gm) => {
      const balance = await getTokenBalance(user.id, gm.group.id);
      return { ...gm, balance };
    }),
  );

  // Public groups: not finished, user not a member
  const allPublicGroups = await getPublicGroups(user.id);
  const publicGroups = allPublicGroups.filter(
    (g) => g.tournament.status !== "finished",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <Button size="sm" asChild>
          <Link href="/groups/new" className="gap-2">
            <Plus className="size-4" />
            {t("create")}
          </Link>
        </Button>
      </div>

      {groupsWithBalances.length === 0 ? (
        <p className="text-muted-foreground">{t("noGroups")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupsWithBalances.map((gm) => (
            <GroupCard
              key={gm.group.id}
              group={gm.group}
              memberCount={gm.group.members?.length ?? 0}
              balance={gm.balance}
              variant="own"
            />
          ))}
        </div>
      )}

      {publicGroups.length > 0 && (
        <>
          <Separator />
          <PublicGroupsSection groups={publicGroups} />
        </>
      )}
    </div>
  );
}
```

Note: `getUserGroups` needs to include `members` in the relation so we can count them. We'll handle that in step 2.

- [ ] **Step 2: Update getUserGroups query to include members**

In `src/queries/groups.ts`, update `getUserGroups` to include the members relation:

```typescript
export async function getUserGroups(userId: string) {
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: {
      group: {
        with: {
          tournament: true,
          owner: true,
          members: true,
        },
      },
    },
  });
}
```

- [ ] **Step 3: Create PublicGroupsSection client component**

Create `src/components/public-groups-section.tsx`:

```tsx
"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";

interface PublicGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  oddsBoost: number;
  tournament: {
    name: string;
    status: string;
  };
  members: { id: string }[];
}

interface PublicGroupsSectionProps {
  groups: PublicGroup[];
}

export function PublicGroupsSection({ groups }: PublicGroupsSectionProps) {
  const t = useTranslations("groups");
  const [selectedGroup, setSelectedGroup] = useState<PublicGroup | null>(null);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="size-4.5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("publicGroups")}</h2>
        </div>
        <p className="ml-6.5 text-sm text-muted-foreground">
          {t("publicGroupsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            memberCount={group.members.length}
            variant="public"
            onClick={() => setSelectedGroup(group)}
          />
        ))}
      </div>

      {selectedGroup && (
        <PublicGroupDialog
          group={selectedGroup}
          memberCount={selectedGroup.members.length}
          open={!!selectedGroup}
          onOpenChange={(open) => {
            if (!open) setSelectedGroup(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx next build --no-lint 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/groups/page.tsx src/components/public-groups-section.tsx src/queries/groups.ts
git commit -m "feat: update groups page with GroupCard and public groups section"
```

---

### Task 9: Update create group form

**Files:**
- Modify: `src/components/create-group-form.tsx`

- [ ] **Step 1: Add isPublic and description fields to CreateGroupForm**

In `src/components/create-group-form.tsx`:

1. Add imports:
```typescript
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
```

2. Add state variables after the existing `useState` calls:
```typescript
const [isPublic, setIsPublic] = useState(false);
const [description, setDescription] = useState("");
```

3. Update `handleSubmit` to include the new fields:
```typescript
const group = await createGroup({
  name: name.trim(),
  tournamentId,
  isPublic,
  description: description.trim() || undefined,
  ...settings,
});
```

4. Add UI fields after the tournament select, before the advanced settings button:

```tsx
{/* Public toggle */}
<div className="flex items-center justify-between rounded-lg border p-3">
  <div className="flex flex-col gap-0.5">
    <Label htmlFor="isPublic">{t("public")}</Label>
    <span className="text-xs text-muted-foreground">
      {t("publicDescription")}
    </span>
  </div>
  <Switch
    id="isPublic"
    checked={isPublic}
    onCheckedChange={setIsPublic}
  />
</div>

{/* Description */}
<div className="flex flex-col gap-2">
  <Label htmlFor="description">{t("descriptionLabel")}</Label>
  <Textarea
    id="description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder={t("descriptionPlaceholder")}
    rows={3}
  />
</div>
```

- [ ] **Step 2: Ensure Switch and Textarea UI components exist**

Check if `src/components/ui/switch.tsx` and `src/components/ui/textarea.tsx` exist. If not, add them:

```bash
ls src/components/ui/switch.tsx src/components/ui/textarea.tsx 2>/dev/null || echo "MISSING"
```

If missing, run:
```bash
npx shadcn@latest add switch textarea
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build --no-lint 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/create-group-form.tsx src/components/ui/
git commit -m "feat: add isPublic toggle and description textarea to create group form"
```

---

### Task 10: Update group settings tab

**Files:**
- Modify: `src/components/group-detail-tabs.tsx`

- [ ] **Step 1: Add isPublic and description to GroupDetailTabs**

In `src/components/group-detail-tabs.tsx`:

1. Add imports:
```typescript
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
```

2. Extend the `GroupDetailTabsProps` interface to include:
```typescript
isPublic: boolean;
description: string | null;
```

3. Add `isPublic` and `description` to the destructured props and create local state:
```typescript
const [isPublicState, setIsPublicState] = useState(isPublic);
const [descriptionState, setDescriptionState] = useState(description ?? "");
```

4. Update `handleSaveSettings` to include the new fields:
```typescript
await updateGroupSettings(groupId, {
  ...settings,
  isPublic: isPublicState,
  description: descriptionState.trim() || null,
});
```

5. In the Settings tab, add the public toggle and description fields BEFORE the existing grid of game settings (before the `{tournamentStatus === "upcoming" ?` block):

```tsx
{/* Always-editable settings */}
<Card>
  <CardHeader>
    <CardTitle className="text-base">{t("descriptionLabel")}</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="isPublic">{t("public")}</Label>
        <span className="text-xs text-muted-foreground">
          {t("publicDescription")}
        </span>
      </div>
      <Switch
        id="isPublic"
        checked={isPublicState}
        onCheckedChange={setIsPublicState}
      />
    </div>
    <Textarea
      value={descriptionState}
      onChange={(e) => setDescriptionState(e.target.value)}
      placeholder={t("descriptionPlaceholder")}
      rows={3}
    />
    <Button onClick={handleSaveSettings} disabled={isPending}>
      {tc("save")}
    </Button>
  </CardContent>
</Card>
```

- [ ] **Step 2: Update group detail page to pass new props**

In `src/app/[locale]/groups/[slug]/page.tsx`, pass `isPublic` and `description` to `GroupDetailTabs`:

```tsx
isPublic={group.isPublic}
description={group.description}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build --no-lint 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/group-detail-tabs.tsx src/app/[locale]/groups/[slug]/page.tsx
git commit -m "feat: add isPublic and description settings to group detail tabs"
```

---

### Task 11: Manual verification

- [ ] **Step 1: Start dev server and test create flow**

Run:
```bash
npm run dev
```

1. Go to `/groups/new`
2. Create a group with `isPublic` enabled and a markdown description
3. Verify the group card shows description and gradient header on `/groups`

- [ ] **Step 2: Test public groups section**

1. Open an incognito window, sign in as a different user
2. Navigate to `/groups`
3. Verify the public group appears in the "Nyilvános csoportok" section
4. Click the card → verify the dialog opens with description and rules
5. Click "Csatlakozás" → verify you join and the group moves to "Saját csoportok"

- [ ] **Step 3: Test settings update**

1. As the group owner, go to group settings
2. Toggle public on/off, edit description
3. Save and verify changes persist

- [ ] **Step 4: Verify responsive layout**

1. Resize browser to mobile width → verify 1 column
2. Tablet width → 2 columns
3. Desktop → 3 columns

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address manual testing feedback for public groups"
```
