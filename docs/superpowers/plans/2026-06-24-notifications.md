# In-app értesítés / inbox rendszer — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perzisztens in-app értesítés/inbox rendszer — harang-ikon olvasatlan-számlálóval a fejlécben, lista popoverben, „mind olvasott", plusz admin rendszerüzenet-broadcast.

**Architecture:** Két új tábla az esemény ↔ címzett szétválasztással (`notification_objects` + `notification_recipients`). A read-réteg `queries/notifications.ts`-ben (server-only), a kliensből hívható server action wrapperek `actions/notifications.ts`-ben (a meglévő `actions/live.ts` minta). A write-helperek `lib/notifications.ts`-ben, auth nélkül, hogy a Phase 2 scoring-cron is hívhassa. UI: client `NotificationBell` SWR-rel (a `bet-dialog.tsx` mintája), a `nav.tsx`-be illesztve; admin űrlap az admin oldalon.

**Tech Stack:** Next.js 16 App Router + Server Actions, Drizzle ORM (Neon HTTP), next-intl, SWR, Shadcn UI (Popover/Card/Input/Textarea), Vitest, Biome.

## Global Constraints

- Magyar UI-szövegek ékezetekkel; **minden** UI-szöveg `useTranslations()` / `getTranslations()` — nincs hardcoded string.
- Server Actions: `"use server"`, mindig `getCurrentUser()` ellenőrzés; admin műveletnél `user.isAdmin` is.
- DB műveletek: Drizzle query API, nem raw SQL.
- DB séma-változás **kizárólag** `npm run db:generate` → `npm run db:migrate` úton (lokálisan, `dev` Neon branch). Soha `drizzle-kit push` / kézi SQL / Neon MCP migráció.
- Commit: conventional commits (feat/fix/chore/docs).
- Design-tokenek: `bg-surface`/`bg-surface-3`, `text-foreground`/`text-muted-foreground`/`text-faint`, `border-border`, arany = `bg-gold`/`text-gold-ink`/`text-gold-text` — nincs raw hex.
- Lint/format: `npm run check` zöld a commit előtt.

---

### Task 1: DB séma — notification táblák + enum + migráció

**Files:**
- Modify: `src/db/schema.ts` (import bővítés; új enum; két tábla; relations)
- Create: `drizzle/XXXX_*.sql` (generált — ne kézzel írd)

**Interfaces:**
- Produces: `notificationObjects`, `notificationRecipients` Drizzle táblák; `notificationTypeEnum`. Oszlopok lentebb.

- [ ] **Step 1: Import bővítése a `jsonb`-vel**

`src/db/schema.ts` tetején a `drizzle-orm/pg-core` importba vedd fel a `jsonb`-t (a meglévő lista bővítése):

```ts
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Enum hozzáadása**

A meglévő enumok mellé (a `providerEnum` után):

```ts
export const notificationTypeEnum = pgEnum("notification_type", ["system", "badge"]);
```

- [ ] **Step 3: A két tábla hozzáadása**

A `circleMembers` tábla után, a `// Relations` komment elé:

```ts
export const notificationObjects = pgTable("notification_objects", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  // system: literál admin-szöveg; badge: null (a data-ból renderelve)
  title: text("title"),
  body: text("body"),
  // badge: template-paraméterek ({ badgeKey, ... }); system: null
  data: jsonb("data"),
  href: text("href"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationObjectId: uuid("notification_object_id")
      .references(() => notificationObjects.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_object_user_idx").on(table.notificationObjectId, table.userId),
    index("notification_user_read_idx").on(table.userId, table.readAt),
  ],
);
```

- [ ] **Step 4: Relations hozzáadása**

A relations blokk végére (a `circleMembersRelations` után):

```ts
export const notificationObjectsRelations = relations(notificationObjects, ({ many }) => ({
  recipients: many(notificationRecipients),
}));

export const notificationRecipientsRelations = relations(notificationRecipients, ({ one }) => ({
  object: one(notificationObjects, {
    fields: [notificationRecipients.notificationObjectId],
    references: [notificationObjects.id],
  }),
  user: one(users, { fields: [notificationRecipients.userId], references: [users.id] }),
}));
```

- [ ] **Step 5: Migráció generálása**

Run: `npm run db:generate`
Expected: új `drizzle/XXXX_*.sql` keletkezik, benne `CREATE TYPE "public"."notification_type"`, `CREATE TABLE "notification_objects"`, `CREATE TABLE "notification_recipients"`, és a két index. Nézd át a fájlt, hogy csak ezt tartalmazza.

- [ ] **Step 6: Migráció futtatása (dev branch)**

Run: `npm run db:migrate`
Expected: hibamentes lefutás (exit 0). Ha „némán elhal" (status 1, üres stderr), a napló elcsúszott — lásd `CLAUDE.md` (`dev` branch `reset_from_parent`).

- [ ] **Step 7: Typecheck + commit**

Run: `npm run check`
Expected: zöld.

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(notifications): notification_objects + notification_recipients séma"
```

---

### Task 2: Pure megjelenítő logika (`notification-display.ts`)

**Files:**
- Create: `src/lib/notification-display.ts`
- Test: `tests/lib/notification-display.test.ts`

**Interfaces:**
- Consumes: semmi (pure modul, a `t` fordító függvény paraméterként jön — NEM server-only, a kliens is importálja).
- Produces:
  - `notificationContent(n, t): { title: string; body: string }` — `n: { type: "system" | "badge"; title: string | null; body: string | null; data: unknown }`
  - `formatRelativeTime(date: Date, now: Date, t): string`

- [ ] **Step 1: Failing test**

`tests/lib/notification-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatRelativeTime, notificationContent } from "@/lib/notification-display";

// Mock fordító: a kulcsot + a count paramétert adja vissza determinisztikusan.
const t = (key: string, values?: Record<string, string | number>) =>
  values && "count" in values ? `${key}:${values.count}` : key;

describe("notificationContent", () => {
  it("system: a tárolt title/body-t adja vissza", () => {
    expect(
      notificationContent({ type: "system", title: "Új funkció", body: "Próbáld ki!", data: null }, t),
    ).toEqual({ title: "Új funkció", body: "Próbáld ki!" });
  });

  it("system: null mezőkből üres stringet ad", () => {
    expect(notificationContent({ type: "system", title: null, body: null, data: null }, t)).toEqual({
      title: "",
      body: "",
    });
  });

  it("badge: a data.badgeKey alapján i18n-kulcsot képez", () => {
    expect(
      notificationContent(
        { type: "badge", title: null, body: null, data: { badgeKey: "roundWinner", count: 3 } },
        t,
      ),
    ).toEqual({ title: "badge.roundWinner.title", body: "badge.roundWinner.body" });
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-24T12:00:00Z");
  it("60 mp alatt: 'most'", () => {
    expect(formatRelativeTime(new Date("2026-06-24T11:59:30Z"), now, t)).toBe("time.now");
  });
  it("percek", () => {
    expect(formatRelativeTime(new Date("2026-06-24T11:45:00Z"), now, t)).toBe("time.minutes:15");
  });
  it("órák", () => {
    expect(formatRelativeTime(new Date("2026-06-24T09:00:00Z"), now, t)).toBe("time.hours:3");
  });
  it("napok", () => {
    expect(formatRelativeTime(new Date("2026-06-22T12:00:00Z"), now, t)).toBe("time.days:2");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm run test -- notification-display`
Expected: FAIL („Cannot find module '@/lib/notification-display'").

- [ ] **Step 3: Implementáció**

`src/lib/notification-display.ts`:

```ts
type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface DisplayNotification {
  type: "system" | "badge";
  title: string | null;
  body: string | null;
  data: unknown;
}

/** Egy értesítés megjelenített címe/szövege. system: tárolt szöveg; badge: i18n a data alapján. */
export function notificationContent(n: DisplayNotification, t: Translate): { title: string; body: string } {
  if (n.type === "badge") {
    const data = (n.data ?? {}) as { badgeKey?: string; [k: string]: unknown };
    const badgeKey = data.badgeKey ?? "unknown";
    return {
      title: t(`badge.${badgeKey}.title`, data as Record<string, string | number>),
      body: t(`badge.${badgeKey}.body`, data as Record<string, string | number>),
    };
  }
  // system (és bármi ismeretlen): a tárolt literál szöveg
  return { title: n.title ?? "", body: n.body ?? "" };
}

/** Relatív idő-címke (most / perce / órája / napja). A formázás a fordítóé. */
export function formatRelativeTime(date: Date, now: Date, t: Translate): string {
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return t("time.now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("time.minutes", { count: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t("time.hours", { count: hour });
  return t("time.days", { count: Math.floor(hour / 24) });
}
```

- [ ] **Step 4: Run — pass**

Run: `npm run test -- notification-display`
Expected: PASS (mind a 7 eset).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notification-display.ts tests/lib/notification-display.test.ts
git commit -m "feat(notifications): pure megjelenítő logika (content + relatív idő)"
```

---

### Task 3: Read-réteg (`queries/notifications.ts`)

**Files:**
- Create: `src/queries/notifications.ts`

**Interfaces:**
- Consumes: `notificationObjects`, `notificationRecipients` (Task 1).
- Produces:
  - `NotificationItem` típus: `{ recipientId: string; objectId: string; type: "system" | "badge"; title: string | null; body: string | null; data: unknown; href: string | null; readAt: Date | null; createdAt: Date }`
  - `getUnreadCountForUser(userId: string): Promise<number>`
  - `getNotificationsForUser(userId: string, opts?: { limit?: number; before?: Date }): Promise<NotificationItem[]>`

- [ ] **Step 1: Implementáció**

`src/queries/notifications.ts`:

```ts
import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationObjects, notificationRecipients } from "@/db/schema";

export interface NotificationItem {
  recipientId: string;
  objectId: string;
  type: "system" | "badge";
  title: string | null;
  body: string | null;
  data: unknown;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Olvasatlan értesítések száma (a notification_user_read_idx fedi). */
export async function getUnreadCountForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationRecipients)
    .where(and(eq(notificationRecipients.userId, userId), isNull(notificationRecipients.readAt)));
  return row?.count ?? 0;
}

/** A user értesítései, legújabb elöl, lapozható (cursor a recipient createdAt-ra). */
export async function getNotificationsForUser(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<NotificationItem[]> {
  const where = opts.before
    ? and(eq(notificationRecipients.userId, userId), lt(notificationRecipients.createdAt, opts.before))
    : eq(notificationRecipients.userId, userId);

  const rows = await db
    .select({
      recipientId: notificationRecipients.id,
      objectId: notificationObjects.id,
      type: notificationObjects.type,
      title: notificationObjects.title,
      body: notificationObjects.body,
      data: notificationObjects.data,
      href: notificationObjects.href,
      readAt: notificationRecipients.readAt,
      createdAt: notificationRecipients.createdAt,
    })
    .from(notificationRecipients)
    .innerJoin(
      notificationObjects,
      eq(notificationRecipients.notificationObjectId, notificationObjects.id),
    )
    .where(where)
    .orderBy(desc(notificationRecipients.createdAt))
    .limit(opts.limit ?? 20);

  return rows as NotificationItem[];
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: zöld.

```bash
git add src/queries/notifications.ts
git commit -m "feat(notifications): read-réteg (unread count + lista)"
```

---

### Task 4: Write-helperek + server action-ök

**Files:**
- Create: `src/lib/notifications.ts` (write-helperek, auth nélkül — cron is hívhatja)
- Create: `src/actions/notifications.ts` (kliensből hívható, auth-os wrapperek)

**Interfaces:**
- Consumes: `createBroadcast` (lib), `getUnreadCountForUser` / `getNotificationsForUser` / `NotificationItem` (Task 3).
- Produces (lib):
  - `createNotificationForUser(params: { userId: string; type: "system" | "badge"; title?: string | null; body?: string | null; data?: unknown; href?: string | null }): Promise<void>`
  - `createBroadcast(params: { title: string; body: string; href?: string | null }): Promise<{ recipientCount: number }>`
- Produces (actions, mind `"use server"`):
  - `getUnreadCount(): Promise<number>`
  - `getNotifications(): Promise<NotificationItem[]>`
  - `markRead(recipientId: string): Promise<{ success: boolean }>`
  - `markAllRead(): Promise<{ success: boolean }>`
  - `broadcastSystemNotification(input: { title: string; body: string; href?: string }): Promise<{ success: boolean; recipientCount?: number; error?: string }>`

- [ ] **Step 1: Write-helperek (`src/lib/notifications.ts`)**

```ts
import "server-only";
import { db } from "@/db";
import { notificationObjects, notificationRecipients, users } from "@/db/schema";

/** Egy értesítés egy usernek (1 object + 1 recipient). A Phase 2 cron hívja badge-re. */
export async function createNotificationForUser(params: {
  userId: string;
  type: "system" | "badge";
  title?: string | null;
  body?: string | null;
  data?: unknown;
  href?: string | null;
}): Promise<void> {
  const [obj] = await db
    .insert(notificationObjects)
    .values({
      type: params.type,
      title: params.title ?? null,
      body: params.body ?? null,
      data: params.data ?? null,
      href: params.href ?? null,
    })
    .returning({ id: notificationObjects.id });

  await db.insert(notificationRecipients).values({
    notificationObjectId: obj.id,
    userId: params.userId,
  });
}

/**
 * Egy system-üzenet MINDEN usernek: 1 object + N vékony recipient sor.
 * A user-szám a baráti léptékben kicsi, ezért sima bulk insert (nincs szükség INSERT...SELECT-re).
 */
export async function createBroadcast(params: {
  title: string;
  body: string;
  href?: string | null;
}): Promise<{ recipientCount: number }> {
  const [obj] = await db
    .insert(notificationObjects)
    .values({ type: "system", title: params.title, body: params.body, href: params.href ?? null })
    .returning({ id: notificationObjects.id });

  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length > 0) {
    await db
      .insert(notificationRecipients)
      .values(allUsers.map((u) => ({ notificationObjectId: obj.id, userId: u.id })));
  }
  return { recipientCount: allUsers.length };
}
```

- [ ] **Step 2: Server action-ök (`src/actions/notifications.ts`)**

```ts
"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notificationRecipients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { createBroadcast } from "@/lib/notifications";
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  type NotificationItem,
} from "@/queries/notifications";

export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  return getUnreadCountForUser(user.id);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getNotificationsForUser(user.id, { limit: 20 });
}

export async function markRead(recipientId: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  await db
    .update(notificationRecipients)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, user.id),
        isNull(notificationRecipients.readAt),
      ),
    );
  return { success: true };
}

export async function markAllRead(): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  await db
    .update(notificationRecipients)
    .set({ readAt: new Date() })
    .where(and(eq(notificationRecipients.userId, user.id), isNull(notificationRecipients.readAt)));
  return { success: true };
}

export async function broadcastSystemNotification(input: {
  title: string;
  body: string;
  href?: string;
}): Promise<{ success: boolean; recipientCount?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };
  if (!user.isAdmin) return { success: false, error: "Unauthorized" };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { success: false, error: "Empty" };
  const href = input.href?.trim() || null;

  const { recipientCount } = await createBroadcast({ title, body, href });
  return { success: true, recipientCount };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run check`
Expected: zöld.

```bash
git add src/lib/notifications.ts src/actions/notifications.ts
git commit -m "feat(notifications): write-helperek + server action-ök (mark read, broadcast)"
```

---

### Task 5: i18n szövegek (`notifications` + admin broadcast)

**Files:**
- Modify: `messages/hu.json`
- Modify: `messages/en.json`

**Interfaces:**
- Produces: `notifications.*` namespace (`title`, `markAllRead`, `empty`, `time.now|minutes|hours|days`) és `admin.broadcast*` kulcsok — a Task 6/7 UI ezeket olvassa.

- [ ] **Step 1: `messages/hu.json` — `notifications` namespace**

Adj hozzá egy új top-level `notifications` blokkot (pl. a `nav` után):

```json
"notifications": {
  "title": "Értesítések",
  "markAllRead": "Mind olvasott",
  "empty": "Még nincs értesítésed.",
  "time": {
    "now": "most",
    "minutes": "{count} perce",
    "hours": "{count} órája",
    "days": "{count} napja"
  }
}
```

- [ ] **Step 2: `messages/hu.json` — admin broadcast kulcsok**

A meglévő `admin` blokkba vedd fel:

```json
"broadcastTitle": "Rendszerüzenet küldése",
"broadcastFieldTitle": "Cím",
"broadcastFieldBody": "Szöveg",
"broadcastFieldHref": "Link (opcionális)",
"broadcastSend": "Küldés mindenkinek",
"broadcastConfirm": "Biztosan kiküldöd minden felhasználónak?",
"broadcastSent": "Elküldve {count} felhasználónak.",
"broadcastError": "Nem sikerült elküldeni."
```

- [ ] **Step 3: `messages/en.json` — ugyanezek angolul**

`notifications`:

```json
"notifications": {
  "title": "Notifications",
  "markAllRead": "Mark all read",
  "empty": "No notifications yet.",
  "time": {
    "now": "now",
    "minutes": "{count}m ago",
    "hours": "{count}h ago",
    "days": "{count}d ago"
  }
}
```

`admin` blokkba:

```json
"broadcastTitle": "Send system message",
"broadcastFieldTitle": "Title",
"broadcastFieldBody": "Message",
"broadcastFieldHref": "Link (optional)",
"broadcastSend": "Send to everyone",
"broadcastConfirm": "Send this to all users?",
"broadcastSent": "Sent to {count} users.",
"broadcastError": "Could not send."
```

- [ ] **Step 4: Validálás + commit**

Run: `npm run check`
Expected: zöld (a JSON-ok érvényesek).

```bash
git add messages/hu.json messages/en.json
git commit -m "feat(notifications): i18n szövegek (hu/en) + admin broadcast kulcsok"
```

---

### Task 6: `NotificationBell` komponens + nav beillesztés

**Files:**
- Create: `src/components/notification-bell.tsx`
- Modify: `src/components/nav.tsx` (import + render a jobb oldali blokkban, csak bejelentkezve)

**Interfaces:**
- Consumes: `getUnreadCount`, `getNotifications`, `markRead`, `markAllRead` (Task 4); `notificationContent`, `formatRelativeTime` (Task 2); `notifications.*` i18n (Task 5); `ui/popover` (létezik), `Link` (`@/i18n/navigation`).
- Produces: `NotificationBell` (named export), prop nélkül (saját adatot tölt).

- [ ] **Step 1: A komponens (`src/components/notification-bell.tsx`)**

```tsx
"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "@/actions/notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { formatRelativeTime, notificationContent } from "@/lib/notification-display";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);

  const { data: unread = 0, mutate: mutateUnread } = useSWR(
    "notif-unread",
    () => getUnreadCount(),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  // A listát csak nyitott popovernél töltjük.
  const { data: items = [], mutate: mutateItems } = useSWR(
    open ? "notif-list" : null,
    () => getNotifications(),
    { revalidateOnFocus: false },
  );

  async function handleMarkAll() {
    await markAllRead();
    mutateUnread(0, { revalidate: false });
    mutateItems();
  }

  async function handleOpenItem(recipientId: string, readAt: Date | null) {
    if (readAt) return;
    await markRead(recipientId);
    mutateUnread();
    mutateItems();
  }

  const now = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("title")}
          className="relative inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/[0.13] bg-white/[0.07] text-white/90 transition hover:bg-white/[0.14]"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="-top-1 -right-1 absolute inline-flex min-w-[18px] items-center justify-center rounded-full bg-gold px-1 font-bold text-[10px] text-gold-ink">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
        <div className="flex items-center justify-between border-border border-b px-3 py-2">
          <span className="font-semibold text-sm">{t("title")}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-gold-text text-xs hover:underline"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            items.map((n) => {
              const { title, body } = notificationContent(n, t);
              const inner = (
                <div className="flex gap-2 px-3 py-2.5 hover:bg-surface-3">
                  {n.readAt ? (
                    <span className="w-2 shrink-0" />
                  ) : (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{title}</p>
                    {body && <p className="text-muted-foreground text-xs">{body}</p>}
                    <p className="text-[11px] text-faint">
                      {formatRelativeTime(new Date(n.createdAt), now, t)}
                    </p>
                  </div>
                </div>
              );
              return n.href ? (
                <Link
                  key={n.recipientId}
                  href={n.href}
                  onClick={() => handleOpenItem(n.recipientId, n.readAt)}
                  className="block"
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={n.recipientId}
                  type="button"
                  onClick={() => handleOpenItem(n.recipientId, n.readAt)}
                  className="block w-full text-left"
                >
                  {inner}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Import a `nav.tsx`-be**

`src/components/nav.tsx` importjai közé (a többi `@/components/...` mellé):

```ts
import { NotificationBell } from "@/components/notification-bell";
```

- [ ] **Step 3: Render a jobb oldali blokkban**

`src/components/nav.tsx`-ben a „Theme toggle" elé (a `{/* Theme toggle */}` komment fölé) szúrd be — csak bejelentkezett usernek:

```tsx
{/* Notifications */}
{user && <NotificationBell />}

{/* Theme toggle */}
<ThemeToggle />
```

- [ ] **Step 4: Build + lint**

Run: `npm run check && npm run build`
Expected: zöld build, nincs típushiba.

- [ ] **Step 5: Commit**

```bash
git add src/components/notification-bell.tsx src/components/nav.tsx
git commit -m "feat(notifications): harang-ikon + popover lista a navban"
```

---

### Task 7: Admin broadcast űrlap

**Files:**
- Create: `src/components/admin-broadcast-form.tsx`
- Modify: `src/app/[locale]/admin/page.tsx` (render az `AdminPanel` fölé/mellé)

**Interfaces:**
- Consumes: `broadcastSystemNotification` (Task 4); `admin.broadcast*` i18n (Task 5); `ui/card`, `ui/input`, `ui/textarea`, `ui/label`, `ui/button` (léteznek); `toast` (`sonner`).
- Produces: `AdminBroadcastForm` (named export).

- [ ] **Step 1: A komponens (`src/components/admin-broadcast-form.tsx`)**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { broadcastSystemNotification } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AdminBroadcastForm() {
  const t = useTranslations("admin");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [isPending, startTransition] = useTransition();

  const disabled = isPending || !title.trim() || !body.trim();

  function handleSend() {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(t("broadcastConfirm"))) return;
    startTransition(async () => {
      const res = await broadcastSystemNotification({
        title,
        body,
        href: href.trim() || undefined,
      });
      if (res.success) {
        toast.success(t("broadcastSent", { count: res.recipientCount ?? 0 }));
        setTitle("");
        setBody("");
        setHref("");
      } else {
        toast.error(t("broadcastError"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("broadcastTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-title">{t("broadcastFieldTitle")}</Label>
          <Input
            id="bc-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-body">{t("broadcastFieldBody")}</Label>
          <Textarea
            id="bc-body"
            value={body}
            maxLength={500}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-href">{t("broadcastFieldHref")}</Label>
          <Input
            id="bc-href"
            value={href}
            placeholder="/tournaments/..."
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
        <Button onClick={handleSend} disabled={disabled}>
          {t("broadcastSend")}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Beillesztés az admin oldalra**

Nyisd meg `src/app/[locale]/admin/page.tsx`-et. Vedd fel az importot:

```ts
import { AdminBroadcastForm } from "@/components/admin-broadcast-form";
```

A renderben az `<AdminPanel ... />` **fölé** szúrd be (egy egyszerű wrapperben, ha kell a margó):

```tsx
<div className="mb-6">
  <AdminBroadcastForm />
</div>
```

(Az oldal már admin-védett — a server action ettől függetlenül is ellenőrzi az `isAdmin`-t.)

- [ ] **Step 3: Build + lint**

Run: `npm run check && npm run build`
Expected: zöld.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-broadcast-form.tsx "src/app/[locale]/admin/page.tsx"
git commit -m "feat(notifications): admin rendszerüzenet-broadcast űrlap"
```

---

### Task 8: Manuális smoke-teszt + záró ellenőrzés

**Files:** nincs új fájl — verifikáció.

- [ ] **Step 1: Teljes teszt + build**

Run: `npm run test && npm run check && npm run build`
Expected: minden zöld.

- [ ] **Step 2: Dev szerver + smoke**

Run: `npm run dev` (és `beam 3000` a laptopra, ha kell).
Ellenőrizd:
1. Admin userként a `/admin` oldalon a „Rendszerüzenet küldése" űrlap megjelenik; küldj egy üzenetet → toast „Elküldve N felhasználónak".
2. A fejlécben a harangon megjelenik az olvasatlan-számláló (esetleg fókusz-váltás / 60s után frissül).
3. A harangra kattintva a popoverben ott az üzenet (cím + szöveg + relatív idő + arany olvasatlan-pötty).
4. Az elemre kattintva eltűnik a pötty és csökken a számláló; „Mind olvasott" lenullázza.
5. Másik (nem admin) userrel belépve ugyanaz az üzenet ott van (broadcast mindenkinek).
6. Nyelvváltás (hu↔en) a harang/popover szövegeit váltja; a system-üzenet törzse az admin által beírt nyelven marad (ez szándékos — egynyelvű broadcast).

- [ ] **Step 3: (ha minden zöld) nincs külön commit** — a feature kész.

---

## Self-Review

**Spec coverage:**
- Adatmodell (2 tábla, enum, indexek, cascade) → Task 1. ✅
- Read-réteg (`getNotifications`, `getUnreadCount`) → Task 3 (+ action wrapper Task 4). ✅
- `markRead` / `markAllRead` → Task 4. ✅
- `broadcastSystemNotification` (admin-only, 1 object + N recipient) → Task 4. ✅
- `createNotificationForUser` (Phase 2 cron helper) → Task 4. ✅
- Deferred rendering (system literál / badge i18n a data-ból) → Task 2 (`notificationContent`). ✅
- Olvasatlan-szám SWR (load + focus revalidate, nincs WebSocket) → Task 6. ✅
- Harang a `nav.tsx`-be + popover lista + „mind olvasott" → Task 6. ✅
- Admin broadcast űrlap (cím/szöveg/link + megerősítés) → Task 7. ✅
- i18n `notifications` namespace hu/en → Task 5. ✅
- YAGNI (nincs email/push/kategória/preferencia/WebSocket/aktor-aggregáció) → betartva. ✅

**Placeholder scan:** nincs TBD/TODO; minden lépés tartalmaz futtatható kódot vagy konkrét parancsot + várt kimenetet. A `src/app/[locale]/admin/page.tsx` beillesztés (Task 7/Step 2) az egyetlen, ahol a pontos sor a fájltól függ — ezért import + konkrét JSX-blokk + egyértelmű horgony („az `<AdminPanel/>` fölé") van megadva.

**Type consistency:** `NotificationItem` (Task 3) mezőnevei (`recipientId`, `objectId`, `type`, `title`, `body`, `data`, `href`, `readAt`, `createdAt`) végig egyeznek a query SELECT-jével, a `notificationContent` `DisplayNotification` alakjával (a `NotificationItem` strukturálisan illeszkedik), és a `NotificationBell` használatával. A `createBroadcast` / `broadcastSystemNotification` `recipientCount` mezője konzisztens a Task 7 toast-hívásával. A `markRead(recipientId)` paraméter a `NotificationItem.recipientId`-t kapja a bellből. ✅
