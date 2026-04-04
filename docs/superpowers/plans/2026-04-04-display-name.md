# Display Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set a custom display name shown everywhere instead of their Google name.

**Architecture:** Add nullable `displayName` column to `users` table. All name displays use `COALESCE(displayName, name)`. A modal in the nav dropdown lets users edit their display name via a server action.

**Tech Stack:** Drizzle ORM migration, Next.js Server Action, Shadcn Dialog, next-intl

**Spec:** `docs/superpowers/specs/2026-04-04-display-name-design.md`

---

### Task 1: DB migration + schema

**Files:**
- Create: `drizzle/0004_display_name.sql`
- Modify: `src/db/schema.ts:33-41`

- [ ] **Step 1: Create migration file**

```sql
-- drizzle/0004_display_name.sql
ALTER TABLE "users" ADD COLUMN "display_name" text;
```

- [ ] **Step 2: Update Drizzle schema**

In `src/db/schema.ts`, add `displayName` to the `users` table definition:

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: text("google_id").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  displayName: text("display_name"),  // NEW
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Run migration**

```bash
npx drizzle-kit migrate
```

Expected: Migration applied successfully. Verify with `npx drizzle-kit studio` or Neon console that column exists.

- [ ] **Step 4: Commit**

```bash
git add drizzle/0004_display_name.sql src/db/schema.ts
git commit -m "feat: add display_name column to users table"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Hungarian translations**

Add a new `"profile"` section to `messages/hu.json` (after `"nav"` section), and add `"displayName"` key to the `"nav"` section:

```json
"nav": {
  "tournaments": "Versenysorozatok",
  "groups": "Csoportjaim",
  "admin": "Admin",
  "locale": "Nyelv",
  "displayName": "Becenév"
},
"profile": {
  "displayNameLabel": "Becenév",
  "displayNameDescription": "Így fognak látni mások. Ha üresen hagyod, a Google neved jelenik meg.",
  "displayNamePlaceholder": "pl. Tipper King",
  "saved": "Mentve!"
},
```

- [ ] **Step 2: Add English translations**

Same structure in `messages/en.json`:

```json
"nav": {
  "tournaments": "Tournaments",
  "groups": "My Groups",
  "admin": "Admin",
  "locale": "Language",
  "displayName": "Display name"
},
"profile": {
  "displayNameLabel": "Display name",
  "displayNameDescription": "This is how others will see you. Leave empty to use your Google name.",
  "displayNamePlaceholder": "e.g. Tipper King",
  "saved": "Saved!"
},
```

- [ ] **Step 3: Commit**

```bash
git add messages/hu.json messages/en.json
git commit -m "feat: add display name i18n keys"
```

---

### Task 3: Server Action

**Files:**
- Create: `src/actions/profile.ts`

- [ ] **Step 1: Create the server action**

```typescript
// src/actions/profile.ts
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";

const MAX_DISPLAY_NAME_LENGTH = 30;

export async function updateDisplayName(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const raw = formData.get("displayName");
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return { success: false, error: "Too long" };
  }

  const displayName = trimmed.length > 0 ? trimmed : null;

  await db.update(users).set({ displayName }).where(eq(users.id, user.id));

  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/profile.ts
git commit -m "feat: add updateDisplayName server action"
```

---

### Task 4: Display Name Dialog component

**Files:**
- Create: `src/components/display-name-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
// src/components/display-name-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDisplayName } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

interface DisplayNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDisplayName: string | null;
  googleName: string;
}

export function DisplayNameDialog({
  open,
  onOpenChange,
  currentDisplayName,
  googleName,
}: DisplayNameDialogProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateDisplayName(formData);
      if (result.success) {
        toast.success(t("saved"));
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("displayNameLabel")}</DialogTitle>
          <DialogDescription>{t("displayNameDescription")}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">{t("displayNameLabel")}</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={currentDisplayName ?? ""}
                placeholder={t("displayNamePlaceholder")}
                maxLength={30}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {tc("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/display-name-dialog.tsx
git commit -m "feat: add DisplayNameDialog component"
```

---

### Task 5: Update Nav — add dialog trigger + use displayName

**Files:**
- Modify: `src/components/nav.tsx:17-24` (NavProps interface)
- Modify: `src/components/nav.tsx:51-58` (initials computation)
- Modify: `src/components/nav.tsx:112` (desktop name display)
- Modify: `src/components/nav.tsx:150` (mobile name display)
- Modify: `src/components/nav.tsx:116-119` (dropdown menu items)

- [ ] **Step 1: Update NavProps to include displayName**

In `src/components/nav.tsx`, change the interface:

```typescript
interface NavProps {
  user: {
    name: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  } | null;
}
```

- [ ] **Step 2: Add imports and state for dialog**

Add to imports:

```typescript
import { Pencil } from "lucide-react";
import { DisplayNameDialog } from "@/components/display-name-dialog";
```

Inside the `Nav` component, add state:

```typescript
const [displayNameOpen, setDisplayNameOpen] = useState(false);
```

- [ ] **Step 3: Update name display logic**

Change the `initials` computation to use displayName:

```typescript
const displayedName = user?.displayName ?? user?.name;
const initials = displayedName
  ? displayedName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  : "?";
```

Replace all `{user.name}` occurrences in JSX with `{displayedName}` (line 112 desktop, line 150 mobile).

- [ ] **Step 4: Add menu item to desktop dropdown**

In the desktop `DropdownMenuContent` (after line 115), add the display name menu item before the sign out item:

```tsx
<DropdownMenuItem onClick={() => setDisplayNameOpen(true)}>
  <Pencil className="mr-2 size-4" />
  {t("displayName")}
</DropdownMenuItem>
```

- [ ] **Step 5: Add menu item to mobile menu + dialog**

In the mobile menu section (before the sign out button, around line 181), add:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="justify-start"
  onClick={() => {
    setDisplayNameOpen(true);
    setMobileOpen(false);
  }}
>
  <Pencil className="mr-2 size-4" />
  {t("displayName")}
</Button>
```

At the very end of the component (before the closing `</nav>` or after it, inside the fragment), render the dialog:

```tsx
{user && (
  <DisplayNameDialog
    open={displayNameOpen}
    onOpenChange={setDisplayNameOpen}
    currentDisplayName={user.displayName}
    googleName={user.name}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: add display name editing to nav dropdown"
```

---

### Task 6: Update layout to pass displayName

**Files:**
- Modify: `src/app/[locale]/layout.tsx:26-31`

- [ ] **Step 1: Add displayName to navUser**

In `src/app/[locale]/layout.tsx`, update the `navUser` object:

```typescript
const navUser = user
  ? {
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
    }
  : null;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat: pass displayName to Nav component"
```

---

### Task 7: Update leaderboard query

**Files:**
- Modify: `src/queries/leaderboard.ts:10`

- [ ] **Step 1: Use COALESCE in the query**

In `src/queries/leaderboard.ts`, change the `userName` select field:

```typescript
userName: sql<string>`COALESCE(${users.displayName}, ${users.name})`.as("user_name"),
```

Update the import if `users.displayName` isn't resolved — it should be since we updated the schema in Task 1. Also update the `groupBy` clause:

```typescript
.groupBy(groupMembers.userId, users.id, users.name, users.displayName, users.avatarUrl)
```

- [ ] **Step 2: Commit**

```bash
git add src/queries/leaderboard.ts
git commit -m "feat: use display name in leaderboard query"
```

---

### Task 8: Update group detail page — members list

**Files:**
- Modify: `src/app/[locale]/groups/[slug]/page.tsx:56-61`

- [ ] **Step 1: Use displayName for members**

In the `members` mapping (line 56-61):

```typescript
members={group.members.map((m) => ({
  id: m.id,
  userId: m.userId,
  name: m.user.displayName ?? m.user.name,
  avatarUrl: m.user.avatarUrl,
}))}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/groups/[slug]/page.tsx
git commit -m "feat: show display name in group members list"
```

---

### Task 9: Verify and test

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Log in — nav shows Google name (no displayName set yet)
2. Click user dropdown — "Becenév" menu item visible
3. Click it — dialog opens with empty input, placeholder visible
4. Type a name (e.g. "Teszt Név"), click Save — toast appears, dialog closes, nav updates
5. Refresh page — name persists
6. Open dialog again — previous display name pre-filled
7. Clear the field, save — nav reverts to Google name
8. Check leaderboard in a group — display name shown
9. Check members tab — display name shown
10. Switch to English — "Display name" label works

- [ ] **Step 3: Run type check and lint**

```bash
npx tsc --noEmit
npx biome check src/
```

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address display name review findings"
```
