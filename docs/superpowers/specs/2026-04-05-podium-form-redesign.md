# Dobogós tipp form újratervezés

## Összefoglaló

A jelenlegi dobogós tipp UI (3 sima dropdown Select) vizuálisan lapos. Cseréljük egy **vizuális dobogó** megjelenítésre, ahol a 3 érem pozíció eltérő magasságú oszlopként jelenik meg, csapatlogókkal/zászlókkal. Desktop: popover csapatválasztó, mobil: shadcn Drawer (vaul).

## Jelenlegi állapot

- **Fájl:** `src/components/podium-form.tsx`
- **UI:** Card > 3x Label+Select dropdown > Submit button
- **Működés:** 3 shadcn Select, egymástól független, már kiválasztott csapatok disabled
- **Probléma:** Vizuálisan semmitmondó, nem illik a tippjáték hangulathoz

## Új dizájn

### Dobogó vizualizáció

3 oszlop egymás mellett, `flex` elrendezéssel, `items-end` igazítással:

| Pozíció | Érem | Oszlop magasság | Szín gradiens | Szélesség |
|---------|------|-----------------|---------------|-----------|
| 1. (közép) | 🥇 | ~130px | `fef3c7 → fde68a` (arany) | 32% |
| 2. (bal) | 🥈 | ~95px | `e2e8f0 → cbd5e1` (ezüst) | 28% |
| 3. (jobb) | 🥉 | ~70px | `fed7aa → fdba74` (bronz) | 26% |

### Állapotok

**Üres (nincs kiválasztva):**
- Dashed border az oszlopon
- "+" ikon + "Válassz" felirat
- Submit gomb disabled

**Kitöltött:**
- Solid border, subtle box-shadow
- Csapatlogó (kör alakú, fehér háttér) + csapatnév
- Ha mind a 3 ki van választva → submit gomb aktív

**Lezárt (podiumLockDate után):**
- Megmarad a jelenlegi logika: "A dobogós tippelés lezárult" üzenet
- Ha van leadott tipp, a dobogó read-only módban mutatja a kiválasztott csapatokat

### Csapatválasztó interakció

**Desktop (≥768px): Popover**
- Shadcn `Popover` nyílik a dobogó oszlopra kattintva
- Csapatlista: zászló/logó + csapatnév
- Már kiválasztott csapatok kiszürkítve (disabled, érem ikon mellette)
- Kiválasztás → popover bezárul, csapat megjelenik a dobogón

**Mobil (<768px): Drawer**
- Shadcn `Drawer` (vaul) alulról felcsúszik
- Handle bar a tetején
- Header: érem ikon + "Válaszd ki a bajnokot/2. helyezettet/3. helyezettet"
- Csapatlista: nagy touch targetek (48px row height)
- Már kiválasztott csapatok kiszürkítve
- Kiválasztás → drawer bezárul

**Responsiveness váltás:** `useMediaQuery("(min-width: 768px)")` hook — desktop: Popover, mobil: Drawer. Ugyanaz a csapatlista komponens mindkettőben, csak a wrapper különbözik.

### Csapatlogó megjelenítés

- Elsődleges: `team.logoUrl` (ha van) — `<Image>` kör alakú
- Fallback: csapatnév első 3 betűje (`bg-muted` kör, pl. "FIN")
- A jelenlegi `podium-form.tsx`-ben már van ez a logika, újrahasználjuk

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `src/components/podium-form.tsx` | Teljes UI refaktor |
| `src/components/ui/drawer.tsx` | Új shadcn komponens (vaul) |
| Shadcn popover | Már megvan: `src/components/ui/popover.tsx` |
| `src/hooks/use-media-query.ts` | Új hook (ha nincs) |

## Nem változik

- Server action (`placePodiumBet`) — változatlan
- DB séma — változatlan
- Queries — változatlan
- Üzleti logika (lock date, group membership) — változatlan
- Translation keys — meglévők maradnak, esetleg 1-2 új (drawer címek)

## Szükséges shadcn komponensek

- `Popover` — már telepítve
- `Drawer` — **telepíteni kell** (`npx shadcn@latest add drawer`)
- `ScrollArea` — opcionális, ha a csapatlista hosszú

## Tesztelési terv

- Vizuális ellenőrzés desktop és mobil nézetben
- Csapatválasztás: mindhárom pozíció kitöltése
- Duplikáció megelőzés: ugyanaz a csapat nem választható két helyre
- Lezárt állapot: submit nem elérhető
- Meglévő tipp betöltése: dobogó mutatja a korábban leadott tippet
