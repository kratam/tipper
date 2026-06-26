# In-app értesítés / inbox rendszer — tervdokumentum

**Dátum:** 2026-06-24
**Státusz:** jóváhagyott terv (implementáció előtt)
**Fázis:** 1/2 — ez a fundamentum; a Phase 2 (badge-ek/achievementek) erre épül és csak *küld* rá.

## Cél és hatókör

Perzisztens, user-szintű **in-app** értesítések. A `nav.tsx` fejlécbe kerül egy harang-ikon
olvasatlan-számlálóval; kattintásra egy lista (popover/dialog) jelenik meg a felhasználó
értesítéseivel; „mind olvasott" gomb. Plusz egy **admin „system broadcast"** képesség
(pl. új funkció bejelentése minden usernek).

Ez egy **badge-független fundamentum**: a Phase 2 a scoring-cronból fog `badge` típusú
értesítést létrehozni rajta keresztül.

**v1 explicit korlátok:** csak in-app (nincs email/push), nincs valós idejű WebSocket
(SWR-poll elég), nincs kategória/preferencia/leiratkozás, nincs aktor-aggregáció.

## Adatmodell

Két új tábla. A modell a [„Designing a notification
system"](https://tannguyenit95.medium.com/designing-a-notification-system-1da83ca971bc)
cikk **esemény ↔ címzett szétválasztását** veszi át (a cikk `notification_object` +
`notification` táblái), az aktor-tábla (`notification_change`) **nélkül** — a mi
típusainknál nincs aktor-aggregáció.

### `notification_objects` — maga az esemény (egyszer tárolva)

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | uuid PK | |
| `type` | enum `notification_type` (`system`, `badge`) | bővíthető |
| `title` | text, nullable | csak `system` broadcastnál (literál admin-szöveg) |
| `body` | text, nullable | csak `system` broadcastnál (literál admin-szöveg) |
| `data` | jsonb, nullable | csak `badge`-nél: template-paraméterek (`{badgeKey, tournamentName, count, scope, …}`) — read-time renderelve |
| `href` | text, nullable | opcionális cél-link (pl. a torna/profil oldalra) |
| `createdAt` | timestamp, default now | |

**Kétféle tartalom-stratégia (a cikk „deferred rendering" elve):**
- **`system`** (broadcast): `title`/`body` **literál szövegként tárolva**, ahogy az admin
  beírta. `data` null.
- **`badge`** (Phase 2): `title`/`body` null; a `data` jsonb tartalmazza a
  template-paramétereket, és a **kliens i18n-nel, a user nyelvén** rendereli megjelenítéskor.
  Így a badge-értesítések lokalizáltak maradnak, és a szövegezés utólag is változtatható.

### `notification_recipients` — címzettenként egy sor (per-user olvasott-állapot)

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | uuid PK | |
| `notificationObjectId` | uuid FK → `notification_objects.id` (cascade delete) | |
| `userId` | uuid FK → `users.id` (cascade delete) | |
| `readAt` | timestamp, nullable | `null` = olvasatlan |
| `createdAt` | timestamp, default now | a kézbesítés ideje |

- **Unique** `(notificationObjectId, userId)` — idempotencia (egy eseményt egy user egyszer kap).
- **Index** `(userId, readAt)` — az olvasatlan-szám és a lista-lekérdezés gyorsításához.

**Miért 2 tábla 1 helyett:** egy `system` broadcast így **egy** esemény-sor + N vékony
címzett-sor (csak `userId`+`readAt`), nem N teljes szöveg-duplikátum. A broadcast
szerkesztése/törlése egy helyen történik. A `badge` eseménynél a címzett 1:1 (a badge-et
egy user szerzi) — a kis többletsor elhanyagolható, cserébe a modell egységes.

## Logika (server actions + query-k)

Új fájlok a meglévő mintába illesztve (`src/actions/notifications.ts`,
`src/queries/notifications.ts`). Minden action `getCurrentUser()` ellenőrzéssel.

### Query-k (read-only)

- **`getNotifications({ limit, before? })`** — a hívó user értesítései (join
  `notification_recipients` ⋈ `notification_objects`), `createdAt` szerint csökkenő,
  lapozható (cursor a `createdAt`-ra). Visszaadja az objektum-mezőket + `readAt`-et.
- **`getUnreadCount()`** — `COUNT(*) WHERE userId = ? AND readAt IS NULL`. Az
  `(userId, readAt)` index fedi.

### Server actions (mutáló)

- **`markRead(recipientId)`** — `UPDATE … SET readAt = now() WHERE id = ? AND userId = ?
  AND readAt IS NULL`. Csak a saját sorát írhatja.
- **`markAllRead()`** — `UPDATE … SET readAt = now() WHERE userId = ? AND readAt IS NULL`.
- **`broadcastSystemNotification({ title, body, href? })`** — **admin-only** (`user.isAdmin`).
  1. `INSERT notification_objects (type='system', title, body, href)` → kap egy `objectId`-t.
  2. `INSERT notification_recipients (objectId, userId) SELECT objectId, id FROM users`
     — minden usernek egy vékony sor.
- **`createNotification(userId, type, { data?, href? })`** — belső helper a Phase 2-nek
  (a scoring-cron hívja badge-eseményekre): egy object + egy recipient sor. **Nem** server
  action a szokásos értelemben (nincs user-bejelentkezés a cron-kontextusban) — sima
  lib-függvény `src/lib/notifications.ts`-ben, a scoring tranzakció-úton hívható.

### Olvasatlan-szám frissítés

A meglévő SWR/`live.ts` mintára: a harang az `getUnreadCount`-ot hívja **betöltéskor** és
**fókusz-visszatéréskor revalidálva**. Nincs WebSocket. A lista a popover megnyitásakor
tölt (`getNotifications`).

## UI

- **Harang-ikon** a `nav.tsx`-be (Lucide `Bell`), abszolút pozícionált olvasatlan-count a
  meglévő `ui/badge.tsx`-szel (0 esetén nincs badge).
- **Lista**: a meglévő `ui/popover.tsx` (desktop) / `ui/dialog.tsx` (mobil, teljes szélesség)
  — soronként: típus-ikon + szöveg + relatív idő + olvasatlan-pötty; soronkénti link
  (`href`); fejlécben „mind olvasott".
- **Kiindulási UI**: a shadcn **„Notification List Sheet"** block mintájából, a projekt
  design-tokenjeire (`bg-surface`, `text-foreground`, `text-gold`, stb.) átstílusozva.
  Owned kód, nincs futásidejű függőség.
- **Megjelenítés-renderelés:** `system` → `title`/`body` ahogy tárolva; `badge` → i18n
  kulcs + `data` paraméterek a user nyelvén (`useTranslations('notifications')`).
- Elem-kattintáskor / popover-megnyitáskor a látott elemek olvasottá válnak (vagy explicit
  „mind olvasott").
- Minden szöveg `useTranslations()` — `notifications` i18n namespace (`hu.json` + `en.json`).

## Admin broadcast

A meglévő `/admin` (`admin-panel.tsx`) alá egy egyszerű űrlap: **cím**, **szöveg**,
**opcionális link** → `broadcastSystemNotification`. Megerősítés („Biztosan kiküldöd
minden felhasználónak?"), mert visszafordíthatatlan és mindenkit érint.

## Tesztelés

- **Unit (Vitest):** a pure részek — pl. a lista-rendezés/cursor-lapozás segédfüggvénye,
  a relatív-idő formázás, és (Phase 2 előkészítés) a badge `data` → i18n-paraméter mapping.
- A query/action réteg integrációs tesztje opcionális (DB-függő); a kézi smoke-teszt
  (admin broadcast → másik userként harang+lista+mark-read) elég v1-re.

## Migráció

Séma-változás `npm run db:generate` → `npm run db:migrate` úton (lokálisan), a
`CLAUDE.md`/`ARCHITECTURE.md` konvenció szerint. Két új tábla + egy új enum
(`notification_type`). A `dev` Neon branch-en futtatva, deploy előtt a `production`-ön kézzel.

## Mi marad ki (YAGNI, v1)

Email/push csatorna, kategóriák, per-notification preferenciák/leiratkozás, valós idejű
WebSocket-kézbesítés, aktor-aggregáció („X és még 3-an"), értesítés-szerkesztés UI.

## Phase 2 kapcsolódás (előretekintés, nem ennek a spec-nek a része)

A badge-rendszer a `createNotification(userId, 'badge', { data })`-t hívja a
scoring-cronból, amikor egy achievement teljesül. A badge-ek tárolása, számlálói, a
publikus profil trófea-szekrény és a relatív/abszolút badge-logika **külön spec** lesz
(`2026-…-badges-design.md`).
