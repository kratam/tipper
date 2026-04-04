# Display Name — Design Spec

## Összefoglaló

Opcionális `displayName` mező a `users` táblában, amivel a felhasználók beállíthatják, hogy mások hogyan lássák őket. Ha nincs kitöltve, a Google-ből jövő teljes név jelenik meg (jelenlegi viselkedés).

## DB változás

Új oszlop a `users` táblán:

```sql
ALTER TABLE users ADD COLUMN display_name text;
```

- Drizzle schema: `displayName: text("display_name")` (nullable, default null)
- Migráció szükséges

## Megjelenítő logika

Mindenhol: `user.displayName ?? user.name`

### Érintett helyek

| Hely | Fájl | Jelenlegi | Új |
|------|------|-----------|-----|
| Nav header (desktop) | `src/components/nav.tsx` | `user.name` | `user.displayName ?? user.name` |
| Nav header (mobil) | `src/components/nav.tsx` | `user.name` | `user.displayName ?? user.name` |
| Nav initials | `src/components/nav.tsx` | `user.name` alapján | `(user.displayName ?? user.name)` alapján |
| Leaderboard query | `src/queries/leaderboard.ts` | `users.name` | `COALESCE(users.displayName, users.name)` |
| Csoport oldal | `src/app/[locale]/groups/[slug]/page.tsx` | `m.user.name` | `m.user.displayName ?? m.user.name` |
| Layout (NavProps) | `src/app/[locale]/layout.tsx` | `name: user.name` | + `displayName: user.displayName` |

## Szerkesztés UI

### Elérés
Nav dropdown menüben új menüpont: "Becenév" / "Display name"

### Modal (Shadcn Dialog)
- Egy szöveges input mező, placeholder: Google név
- Max 30 karakter
- Mentés gomb
- Ha a mező üres → `displayName` null-ra áll (visszaáll Google névre)
- Sikeres mentés után: `router.refresh()` a nav frissítéséhez

### Server Action

```typescript
// src/actions/profile.ts
"use server"
async function updateDisplayName(formData: FormData): Promise<{ success: boolean; error?: string }>
```

- `getCurrentUser()` ellenőrzés
- Input: trim, max 30 karakter validáció
- Üres string → null
- `db.update(users).set({ displayName }).where(eq(users.id, currentUser.id))`

## User sync viselkedés

A `user-sync.ts` NEM módosítja a `displayName` mezőt. A Google-ből jövő `name` mező továbbra is frissül minden bejelentkezéskor, de a `displayName` kizárólag a felhasználó által állítható.

## NavProps bővítés

```typescript
interface NavProps {
  user: {
    name: string;
    displayName: string | null;  // ÚJ
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  } | null;
}
```

## i18n kulcsok

### hu.json
```json
{
  "nav": {
    "displayName": "Becenév"
  },
  "profile": {
    "displayNameLabel": "Becenév",
    "displayNameDescription": "Így fognak látni mások. Ha üresen hagyod, a Google neved jelenik meg.",
    "displayNamePlaceholder": "pl. Tipper King",
    "save": "Mentés",
    "saved": "Mentve!"
  }
}
```

### en.json
```json
{
  "nav": {
    "displayName": "Display name"
  },
  "profile": {
    "displayNameLabel": "Display name",
    "displayNameDescription": "This is how others will see you. Leave empty to use your Google name.",
    "displayNamePlaceholder": "e.g. Tipper King",
    "save": "Save",
    "saved": "Saved!"
  }
}
```

## Nem érintett

- `user-sync.ts` `onConflictDoUpdate` — nem tartalmazza a `displayName`-et
- Admin felület — nem szükséges displayName szerkesztés admin oldalról
- Avatar — nem változik
