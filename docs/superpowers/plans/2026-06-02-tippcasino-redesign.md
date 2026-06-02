# TippCasino Prémium Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az egész TippCasino UI újraépítése a `docs/assets/design_handoff_tippcasino_redesign` hifi handoff szerint — egységes, dark-default „kaszinó" design system, egyetlen Segmented tab- és egyetlen Button-rendszerrel.

**Architektúra:** Tiszta Tailwind v4 utility rebuild. A handoff `styles.css` token-rendszerét a `globals.css` `@theme` + CSS-custom-property rendszerébe ültetjük (shadcn semantic tokenek értékeit a redesignra hangoljuk + design-specifikus tokeneket adunk). Minden komponens Tailwind utility-class-ekkel épül újra; a shadcn primitivek (`button`, `tabs`, `card`, stb.) variánsait a rendszerhez igazítjuk. **Nincs bespoke CSS osztály-réteg** (`.match`, `.seg` stb. NEM kerül a globals.css-be) — a `styles.css` csak **pixel-referencia**.

**Tech Stack:** Next.js 16 App Router · React · TypeScript · Tailwind v4 (`@theme`) · shadcn/ui (radix-ui) · lucide-react · next-intl · next/font.

**A pixel-igazság forrása:** `docs/assets/design_handoff_tippcasino_redesign/styles.css` (a hivatkozott sorszámok ide mutatnak) és a `src/*.jsx` prototípus-fájlok (struktúra-referencia). A README a `README.md` ugyanott.

---

## Token-megfeleltetés (a teljes terv alapja)

A `styles.css` `--surface`, `--accent`, `--win` stb. tokenjeit a következőképp képezzük le. **Két csoport:** (A) meglévő shadcn semantic tokenek értékének átírása (így minden shadcn primitív és meglévő `bg-card`/`text-muted-foreground` használat azonnal átveszi a dark redesignt), (B) új design-specifikus `@theme` tokenek a shadcn-ben nem létező fogalmakra.

**FONTOS névütközés:** a shadcn `--accent` token a *halvány hover-háttér* (= design `--surface-3`), NEM az arany brand-szín. Az arany brandet a **`--primary`** (és külön `--color-gold*`) hordozza. Tehát: arany szöveg/ikon → `text-primary` v. `text-gold`; arany gomb → `bg-primary`; halvány hover → `bg-accent`.

| styles.css token | Hova kerül | Dark érték |
|---|---|---|
| `--bg` | `--background` | `#0e1320` |
| `--bg-2` | `--color-bg-2` (új) | `#131a2b` |
| `--surface` | `--card`, `--popover` | `#182135` |
| `--surface-2` | `--secondary`, `--muted`, `--color-surface-2` (új) | `#1e2940` |
| `--surface-3` | `--accent` (shadcn hover), `--color-surface-3` (új) | `#25324d` |
| `--border` | `--border` | `rgba(255,255,255,0.09)` |
| `--border-strong` | `--input`, `--color-border-strong` (új) | `rgba(255,255,255,0.16)` |
| `--text` | `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#f2f5fb` |
| `--text-muted` | `--muted-foreground` | `#9aa7c2` |
| `--text-faint` | `--color-faint` (új) | `#66718c` |
| `--accent` (gold) | `--primary`, `--ring`, `--color-gold` (új) | `#f0b850` |
| `--accent-2` | `--color-gold-2` (új) | `#d99a2e` |
| `--accent-ink` | `--primary-foreground`, `--color-gold-ink` (új) | `#2a1c05` |
| `--accent-soft` (16%) | `--color-gold-soft` (új) | `color-mix(in oklab,#f0b850 16%,transparent)` |
| `--accent-line` (38%) | `--color-gold-line` (új) | `color-mix(in oklab,#f0b850 38%,transparent)` |
| `--win` | `--color-win` (új) | `#39d99b` |
| `--win-soft` | `--color-win-soft` (új) | `rgba(57,217,155,0.14)` |
| `--loss` | `--destructive`, `--color-loss` (új) | `#ff6b81` |
| `--loss-soft` | `--color-loss-soft` (új) | `rgba(255,107,129,0.14)` |
| `--nav-bg` | `--color-nav-bg` (új) | `#0a0f1a` |
| `--radius` (14px) | `--radius` | `0.875rem` |

**Density:** a `compact/regular/comfy` váltás prototípus-tweak — production NEM kell. A `regular` értékeket (`--pad-card:15px`, `--gap:12px`, `--row-h:40px`) fixen használjuk. Ahol kell, közvetlen utility (`p-[15px]`, `gap-3`, `h-10`).

**Fontok:** `--font-sans → Sora`, `--font-mono → JetBrains Mono`, `--font-brand → Russo One`, `--font-heading → var(--font-mono)` (oldalcímek mono-ban).

**Light téma:** a redesign light tokenjei (`styles.css:65-86`) a `:root`-ba kerülnek, a dark a `.dark`-ba; a `<html>` fixen `dark` (alapértelmezett dark). Téma-váltó UI most NEM készül (a `dark:` variánsok így is működnek a `.dark` osztály alatt).

---

## Fázis-struktúra

Minden fázis önállóan működő, tesztelhető, commitolható egység. Sorrend kötött (a foundation-re épül minden).

- **Fázis 0 — Foundation:** tokenek, fontok, háttér, base réteg.
- **Fázis 1 — Core primitívek:** Button, Tabs(Segmented), Avatar, Badge/Pill, Card, Switch, NumericInput, Textarea, Input, Dialog overlay+pop.
- **Fázis 2 — Shell & Nav:** nav, page-header, layout shell.
- **Fázis 3 — Onboarding:** landing, név-megadás dialog, torna-választó.
- **Fázis 4 — Torna-oldal:** match-card (3 állapot), nap-akkordeon, hivatalos-szalag, szűrő-Segmented.
- **Fázis 5 — Tipp-leadás modal.**
- **Fázis 6 — Meccs-modal:** scoreboard, Tippek tab, Statisztika tab.
- **Fázis 7 — Csoport-oldal:** Ranglista / Eredmények / Beállítások + szabályok-dialog.
- **Fázis 8 — Csoportok:** lista, group-card, új-csoport form, publikus csatlakozás, archivált, own-groups summary, podium-tab, team-picker.
- **Fázis 9 — Polish:** reszponzivitás, reduced-motion, takarítás, teljes verifikáció.

### Verifikáció minden fázis végén
Ez vizuális redesign — a fő ellenőrzés a futó app + a `styles.css` referencia összevetése. Minden fázis után KÖTELEZŐ:
1. `npm run build` → sikeres (0 hiba).
2. `npm run check` → Biome tiszta (0 error; warning a meglévő szinten marad).
3. `npm run test` → a meglévő unit tesztek zöldek.
4. `npm run dev` → az érintett képernyő(k) vizuális összevetése a prototípussal (a prototípus megnyitható: `open docs/assets/design_handoff_tippcasino_redesign/TippCasino.html`). Eltérés esetén javítás a styles.css értékei szerint.
5. Commit (conventional commit, lásd lent).

---

## Fázis 0 — Foundation

### Task 0.1: Fontok cseréje (Sora + JetBrains Mono)

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Fontok importja és változói**

`src/app/layout.tsx` teljes csere a font-blokkra:

```tsx
import type { Metadata } from "next";
import { JetBrains_Mono, Russo_One, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});
const russoOne = Russo_One({ variable: "--font-russo", weight: "400", subsets: ["latin"] });
```

- [ ] **Step 2: `<html>` osztályok — dark default + font-változók**

```tsx
    <html
      lang="hu"
      className={`${sora.variable} ${jetbrainsMono.variable} ${russoOne.variable} dark h-full antialiased`}
    >
```

- [ ] **Step 3: Build & lint**

Run: `npm run build && npm run check`
Expected: PASS (a `--font-geist-*` referenciák a globals.css-ben a 0.2 taskban frissülnek; ha a build a régi változókra panaszkodik, az a 0.2 után tűnik el — a két taskot együtt commitold).

### Task 0.2: globals.css — token-rendszer újraírása

**Files:**
- Modify: `src/app/globals.css` (teljes újraírás az `@theme inline` és `:root`/`.dark`/base blokkokra)

- [ ] **Step 1: `@theme inline` blokk** — az új és átképzett tokenek + utilityk

A meglévő `@theme inline` blokkot (globals.css:7-50) cseréld erre (a font-sorok Sora/JetBrains-re mutatnak, plusz a design-specifikus `--color-*` tokenek):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sora);
  --font-mono: var(--font-jetbrains);
  --font-heading: var(--font-jetbrains);
  --font-brand: var(--font-russo);

  /* shadcn semantic (értékek a :root/.dark-ban) */
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* design-specifikus (új) */
  --color-bg-2: var(--bg-2);
  --color-surface: var(--card);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border-strong: var(--border-strong);
  --color-faint: var(--faint);
  --color-win: var(--win);
  --color-win-soft: var(--win-soft);
  --color-loss: var(--loss);
  --color-loss-soft: var(--loss-soft);
  --color-gold: var(--gold);
  --color-gold-2: var(--gold-2);
  --color-gold-ink: var(--gold-ink);
  --color-gold-soft: var(--gold-soft);
  --color-gold-line: var(--gold-line);
  --color-nav-bg: var(--nav-bg);

  --radius-sm: calc(var(--radius) * 0.55);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.2);
}
```

- [ ] **Step 2: `.dark` (alapértelmezett, dark redesign értékek)**

A `.dark` blokkot cseréld erre (értékek: `styles.css:41-62, 89` gold accent):

```css
.dark {
  --background: #0e1320;
  --bg-2: #131a2b;
  --foreground: #f2f5fb;
  --card: #182135;
  --card-foreground: #f2f5fb;
  --popover: #182135;
  --popover-foreground: #f2f5fb;
  --primary: #f0b850;
  --primary-foreground: #2a1c05;
  --secondary: #1e2940;
  --secondary-foreground: #f2f5fb;
  --muted: #1e2940;
  --muted-foreground: #9aa7c2;
  --accent: #25324d;
  --accent-foreground: #f2f5fb;
  --destructive: #ff6b81;
  --border: rgba(255, 255, 255, 0.09);
  --input: rgba(255, 255, 255, 0.16);
  --ring: #f0b850;

  --surface-2: #1e2940;
  --surface-3: #25324d;
  --border-strong: rgba(255, 255, 255, 0.16);
  --faint: #66718c;
  --win: #39d99b;
  --win-soft: rgba(57, 217, 155, 0.14);
  --loss: #ff6b81;
  --loss-soft: rgba(255, 107, 129, 0.14);
  --gold: #f0b850;
  --gold-2: #d99a2e;
  --gold-ink: #2a1c05;
  --gold-soft: color-mix(in oklab, #f0b850 16%, transparent);
  --gold-line: color-mix(in oklab, #f0b850 38%, transparent);
  --nav-bg: #0a0f1a;
  color-scheme: dark;
}
```

- [ ] **Step 3: `:root` (light redesign értékek; fallback)**

A `:root` blokkot cseréld erre (értékek: `styles.css:65-86`; a `--radius` itt közös):

```css
:root {
  --radius: 0.875rem;

  --background: #f4efe3;
  --bg-2: #efe7d6;
  --foreground: #221c10;
  --card: #fffdf8;
  --card-foreground: #221c10;
  --popover: #fffdf8;
  --popover-foreground: #221c10;
  --primary: #f0b850;
  --primary-foreground: #2a1c05;
  --secondary: #fbf6ec;
  --secondary-foreground: #221c10;
  --muted: #fbf6ec;
  --muted-foreground: #6c6149;
  --accent: #f4ecdb;
  --accent-foreground: #221c10;
  --destructive: #d64560;
  --border: rgba(40, 30, 10, 0.12);
  --input: rgba(40, 30, 10, 0.22);
  --ring: #f0b850;

  --surface-2: #fbf6ec;
  --surface-3: #f4ecdb;
  --border-strong: rgba(40, 30, 10, 0.22);
  --faint: #9b9070;
  --win: #18936a;
  --win-soft: rgba(24, 147, 106, 0.12);
  --loss: #d64560;
  --loss-soft: rgba(214, 69, 96, 0.1);
  --gold: #f0b850;
  --gold-2: #d99a2e;
  --gold-ink: #2a1c05;
  --gold-soft: color-mix(in oklab, #f0b850 16%, transparent);
  --gold-line: color-mix(in oklab, #f0b850 38%, transparent);
  --nav-bg: #0e1320;
  color-scheme: light;
}
```

- [ ] **Step 4: Töröld a `.nav-header` és régi `--brand-*` blokkokat**

A `globals.css:131-143` `.nav-header` blokk és a `--brand-blue*`/`--brand-gold*` sorok (`:root`/`.dark`-ban) **törlendők** — a nav a Fázis 2-ben `bg-nav-bg` + saját utilityk alapján épül újra. (A `landing-content.tsx` még hivatkozza a `--brand-*`-ot; az a Fázis 3-ban frissül. Átmenetileg a build emiatt NEM törik — a `bg-(--brand-gold)` ismeretlen custom prop, ami `transparent`-re esik vissza, de a 0.x commit után a 3-as fázisig ez kozmetikai. Ha zavar, ideiglenesen hagyd benne a `--brand-gold`/`--brand-blue` sorokat a `.dark`-ban és a 3-as fázisban töröld.)

- [ ] **Step 5: base réteg + kaszinó-háttér**

A `@layer base` blokkot (globals.css:145-169) cseréld erre — a háttér a `styles.css:106-123` `.tc-bg` portja `body::before`/`::after`-re:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
  }
  body {
    @apply text-foreground;
    background-color: var(--background);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  /* glow + gradiens */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -2;
    pointer-events: none;
    background:
      radial-gradient(120% 70% at 50% -8%, color-mix(in oklab, var(--gold) 26%, transparent) 0%, transparent 46%),
      linear-gradient(180deg, var(--bg-2) 0%, var(--background) 60%);
  }
  /* halvány argyle textúra, felülre maszkolva */
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    --texture: color-mix(in oklab, var(--foreground) 2.2%, transparent);
    background-image:
      repeating-linear-gradient(45deg, var(--texture) 0 1px, transparent 1px 22px),
      repeating-linear-gradient(-45deg, var(--texture) 0 1px, transparent 1px 22px);
    -webkit-mask-image: radial-gradient(140% 90% at 50% 0%, #000 30%, transparent 92%);
    mask-image: radial-gradient(140% 90% at 50% 0%, #000 30%, transparent 92%);
  }
  @media (prefers-reduced-motion: no-preference) {
    /* élő-pulzálás engedélyezve (lásd live-dot utility a komponenseknél) */
  }
}
```

- [ ] **Step 6: Build, lint, vizuális ellenőrzés**

Run: `npm run build && npm run check && npm run test`
Expected: PASS. `npm run dev` → az oldalháttér sötét kaszinó-gradiens arany glow-val; a meglévő (még nem átírt) komponensek dark felületeken jelennek meg (lehetnek elcsúszások — ezeket a következő fázisok javítják).

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(design): dark casino token system + Sora/JetBrains fonts (Phase 0)"
```

---

## Fázis 1 — Core primitívek

> A cél: **egyetlen** Button- és **egyetlen** Segmented-rendszer, plusz az atomi UI-elemek a redesign szerint. Minden későbbi fázis ezekre épül.

### Task 1.1: Button variánsok a redesign szerint

**Files:**
- Modify: `src/components/ui/button.tsx`
- Referencia: `styles.css:229-249` (.btn rendszer), README „Button" szekció.

Méret/variáns leképezés:
- alap magasság **38px** (`h-[38px]`), `--radius-sm` (`rounded-sm`), 14px/650, `:active` 1px le (`active:translate-y-px`).
- `default`(=primary): `bg-linear-to-b from-gold to-gold-2 text-gold-ink font-bold shadow-[0_10px_22px_-12px_var(--gold-2),0_1px_0_rgba(255,255,255,0.3)_inset] hover:brightness-105`.
- `secondary`: `bg-secondary text-foreground border-border hover:bg-surface-3 hover:border-border-strong`.
- `ghost`: `bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground`.
- `outline`: `bg-transparent text-foreground border-border-strong hover:bg-secondary`.
- `destructive`: `bg-loss-soft text-loss hover:bg-[color-mix(in_oklab,var(--loss)_22%,transparent)]`.
- `link`: változatlan (`text-primary underline-offset-4 hover:underline`).
- size: `default → h-[38px] px-4 gap-1.5`, `sm → h-8 px-3 text-[13px]`, `lg → h-[50px] px-7 text-base` (landing CTA), `icon → size-[38px]`, `icon-sm → size-8`.

- [ ] **Step 1: cva base + variants átírása**

Cseréld a `buttonVariants` cva-t (button.tsx:7-42) erre:

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent bg-clip-padding text-sm font-[650] transition-[transform,border-color,box-shadow,filter,background-color] duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-gold to-gold-2 font-bold text-gold-ink shadow-[0_10px_22px_-12px_var(--gold-2),0_1px_0_rgba(255,255,255,0.3)_inset] hover:brightness-105",
        secondary:
          "border-border bg-secondary text-foreground hover:border-border-strong hover:bg-surface-3",
        ghost: "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        outline: "border-border-strong bg-transparent text-foreground hover:bg-secondary",
        destructive:
          "bg-loss-soft text-loss hover:bg-[color-mix(in_oklab,var(--loss)_22%,transparent)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 rounded-[calc(var(--radius-sm)*0.9)] px-3 text-[13px]",
        lg: "h-[50px] px-7 text-base",
        icon: "size-[38px] px-0",
        "icon-sm": "size-8 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

- [ ] **Step 2: A `Button` függvény** — hagyd a meglévő szerkezetet (button.tsx:44-65), csak az új cva-val. Ellenőrizd, hogy `data-variant`/`data-size` megmarad.

- [ ] **Step 3: Build & lint & vizuális**

Run: `npm run build && npm run check`
Expected: PASS. Megjegyzés: a `size` prop-ok `xs`/`icon-xs`/`icon-lg` eltűntek — `git grep "size=\"xs\"\|icon-xs\|icon-lg"` a `src`-ben; ha van használat, írd át `sm`/`icon-sm`-re ugyanebben a commitban.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): unify Button system per redesign (Phase 1)"
```

### Task 1.2: Tabs → Segmented (az EGYETLEN tab-vezérlő)

**Files:**
- Modify: `src/components/ui/tabs.tsx`
- Referencia: `styles.css:191-224` (.seg/.seg-item).

Cél: a `TabsList` = `.seg` (surface-2 háttér, border, p-1 gap-1, grid egyenlő oszlopok), a `TabsTrigger` = `.seg-item` (h-10, muted→aktívban foreground, aktív: surface-3→surface gradiens + belső gold-line keret + **arany alsó-vonal** `::after`-rel). Mobilon (≤560px) vízszintes görgetés.

- [ ] **Step 1: `TabsList` — grid Segmented konténer**

Cseréld a `tabsListVariants` cva-t (tabs.tsx:24-37) és a `TabsList`-et:

```tsx
const tabsListVariants = cva(
  "group/tabs-list grid w-full auto-cols-fr grid-flow-col gap-1 rounded-[calc(var(--radius)*0.9)] border border-border bg-secondary p-1 text-muted-foreground max-[560px]:auto-cols-max max-[560px]:overflow-x-auto max-[560px]:[scrollbar-width:none] max-[560px]:[&::-webkit-scrollbar]:hidden",
  {
    variants: {
      variant: {
        default: "",
        line: "border-0 bg-transparent p-0",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
```

- [ ] **Step 2: `TabsTrigger` — seg-item aktív állapottal**

Cseréld a `TabsTrigger` className-jét (tabs.tsx:54-68) erre:

```tsx
      className={cn(
        "relative inline-flex h-10 items-center justify-center gap-[7px] whitespace-nowrap rounded-[calc(var(--radius)*0.62)] border-0 px-3.5 font-semibold text-[14px] text-muted-foreground transition-[color,box-shadow] duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 max-[560px]:scroll-ml-1 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        // aktív: gradiens háttér + belső gold-line keret + arany alsó-vonal
        "data-active:bg-linear-to-b data-active:from-surface-3 data-active:to-surface data-active:text-foreground data-active:shadow-[0_1px_0_var(--border-strong)_inset,0_6px_14px_-10px_rgba(0,0,0,0.7),0_0_0_1px_var(--gold-line)_inset]",
        "after:pointer-events-none after:absolute after:inset-x-[22%] after:bottom-[5px] after:h-[2.5px] after:rounded-full after:bg-gold after:opacity-0 after:shadow-[0_0_8px_var(--gold)] after:transition-opacity data-active:after:opacity-100",
        className,
      )}
```

- [ ] **Step 3: Build & lint & vizuális**

Run: `npm run build && npm run check`
Expected: PASS. `npm run dev` → bárhol használt `Tabs` most a Segmented-stílust mutatja: aktív tabnak arany alsó-vonala van.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "feat(design): Tabs → unified Segmented control (Phase 1)"
```

### Task 1.3: Card, Badge, Avatar, Switch, Input, Textarea, NumericInput, Dialog

**Files:**
- Modify: `src/components/ui/card.tsx`, `badge.tsx`, `avatar.tsx`, `switch.tsx`, `input.tsx`, `textarea.tsx`, `numeric-input.tsx`, `dialog.tsx`
- Referencia: Card `styles.css:183-186`; Pill/badge `253-262`; Avatar `292-293`; Switch `534-539`; num-input `523-529`; textarea/name-input `540-541,746-748`; modal overlay/pop `354-365`.

- [ ] **Step 1: Card** — `bg-card border-border rounded-lg` + `shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_28px_-22px_rgba(0,0,0,0.9)]`. A `Card` gyökerére tedd ezt az árnyékot és `hover` nélkül (a hover-emelkedést a konkrét kártya-komponensek adják, nem az alap Card). Igazítsd a `card.tsx` gyökér className-jét; a tartalmi rész-utilityket hagyd.

- [ ] **Step 2: Badge** — adj `pill` jelleget: alap `inline-flex items-center gap-1.5 h-[22px] px-[9px] rounded-full font-mono text-[11px] font-semibold bg-surface-3 text-muted-foreground border border-border`. Variánsok: `win → bg-win-soft text-win border-transparent`, `loss → bg-loss-soft text-loss border-transparent`, státusz: `active → bg-win-soft text-win`, `upcoming → bg-gold-soft text-gold`, `finished → bg-surface-3 text-faint`. Bővítsd a `badgeVariants` cva variants listáját ezekkel (a meglévő variánsok megtartásával vagy átnevezésével — `git grep "variant=" src/components/ui/badge.tsx` használat ellenőrzése után).

- [ ] **Step 3: Avatar** — kör, kezdőbetűk, megadott háttér. Biztosítsd: `rounded-full`, fallback `font-bold text-white text-[11px]`. A háttérszínt a hívó adja inline (`style={{ backgroundColor }}`) — ez már bevett a `bet-row.tsx`-ben, ne bontsd el.

- [ ] **Step 4: Switch** — `w-[42px] h-6 rounded-full bg-surface-3 border border-border data-[state=checked]:bg-linear-to-b data-[state=checked]:from-gold data-[state=checked]:to-gold-2 data-[state=checked]:border-transparent`; knob `size-[18px] bg-white shadow translate-x-0 data-[state=checked]:translate-x-[18px]`. Igazítsd a `switch.tsx` Root/Thumb className-jeit.

- [ ] **Step 5: Input / name-input** — `h-[38px] px-3 bg-secondary border-border rounded-sm text-foreground focus-visible:border-gold-line focus-visible:ring-0`. (A landing/név nagy input a saját komponensében `h-[46px] text-center text-base`.)

- [ ] **Step 6: Textarea** — `min-h-[76px] bg-secondary border-border rounded-sm px-3 py-2.5 text-[13.5px] focus-visible:border-gold-line`.

- [ ] **Step 7: NumericInput** — konténer `flex items-center h-[38px] border-border rounded-sm bg-secondary overflow-hidden`; léptető gombok `w-9 h-full grid place-items-center text-muted-foreground hover:bg-surface-3 hover:text-foreground`; érték `flex-1 text-center font-mono font-bold text-[14px]`; suffix `pr-2.5 font-mono text-[11px] text-faint`. Igazítsd `numeric-input.tsx`-et e struktúrához.

- [ ] **Step 8: Dialog** — overlay `bg-[rgba(5,8,15,0.66)] backdrop-blur-[3px]` + fade; content `bg-card border-border-strong rounded-xl shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)] max-w-[430px]` + pop-animáció. A radix `DialogOverlay`/`DialogContent` className-jeit igazítsd; a pop/fade-hez `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2` (tw-animate-css már elérhető). `@media (prefers-reduced-motion: reduce)` esetén az animációkat a tw-animate-css alap kezeli.

- [ ] **Step 9: Build, lint, test, vizuális**

Run: `npm run build && npm run check && npm run test`
Expected: PASS. `npm run dev` → bármely meglévő dialog (pl. help) sötét felülettel, lekerekített sarokkal, blur-overlay-jel nyílik; switch/inputok a beállítás-formokban a redesign szerintiek.

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/
git commit -m "feat(design): restyle core primitives — card, badge, avatar, switch, inputs, dialog (Phase 1)"
```

---

## Fázis 2 — Shell & Nav

### Task 2.1: Nav

**Files:**
- Modify: `src/components/nav.tsx`
- Referencia: `styles.css:133-166, 559-564, 757-782` (nav + nav-links + reszponzív), README 4. „Nav".

Cél: sticky, `bg-nav-bg/92 backdrop-blur-[14px]`, alsó hajszálkeret, 60px magas inner (max-w-1024 mx-auto px-4). Bal: brand (logó 30px + Russo One gradiens név — mobilon csak logó). Közép/bal-linkek: Tornák / Csoportok (`nav-link`: muted→hover/aktív fehér + halvány háttér). Jobb: súgó-ikon (`≤400px` rejtve), nyelv-pill (HU; mobilon csak ikon), user-pill (avatar + név + kijelentkezés-ikon; mobilon csak avatar).

- [ ] **Step 1:** A nav gyökér: `sticky top-0 z-40 border-b border-white/[0.07] bg-[color-mix(in_oklab,var(--nav-bg)_92%,transparent)] backdrop-blur-[14px] backdrop-saturate-150 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)]`. Inner: `mx-auto flex h-[60px] max-w-[1024px] items-center justify-between gap-3 px-4 text-[#f2f5fb]`.

- [ ] **Step 2:** Brand: link `flex items-center gap-2.5`; logó `Image` 30×30; név `<span className="bg-linear-to-r from-white via-gold to-gold-2 bg-clip-text font-brand text-[21px] text-transparent max-[700px]:hidden">TippCasino</span>`.

- [ ] **Step 3:** Nav-linkek (`Tornák`, `Csoportok`) — közös class: `inline-flex h-[34px] items-center rounded-[9px] px-3 font-semibold text-[13px] text-white/60 transition hover:bg-white/[0.07] hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white`. Az aktív állapotot a meglévő route-egyezés logikával jelöld (`aria-current`).

- [ ] **Step 4:** Jobb oldal: súgó-ikon `Button` `variant="ghost" size="icon-sm"` fehér ikonnal + `max-[400px]:hidden`; nyelv-pill (`h-[34px] rounded-[10px] bg-white/[0.07] border border-white/[0.13] px-[11px] text-[12px] font-semibold text-white/90`, a „HU" szöveg `max-[700px]:hidden`); user-pill (`h-[38px] rounded-sm bg-white/[0.06] border border-white/[0.09] pl-1 pr-2 flex items-center gap-2`, név `text-[13.5px] font-semibold max-[700px]:hidden`, kijelentkezés lucide ikon).

- [ ] **Step 5: Build, lint, vizuális (mobil is)**

Run: `npm run build && npm run check`
Expected: PASS. `npm run dev` → nav a sötét sávval, arany-gradiens brand; 700px alatt brand-felirat/nyelv-szöveg/usernév eltűnik, 400px alatt súgó-ikon rejtve.

- [ ] **Step 6: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(design): redesign nav bar (Phase 2)"
```

### Task 2.2: Page header + shell szélesség

**Files:**
- Modify: a torna/csoport oldalak layout-wrapperje (keresd: `git grep -l "max-w-" src/app/\[locale\]` és a fő content wrapper) + `src/components/group-page-header.tsx`
- Referencia: page-head `styles.css:171-178`; shell `128`; gp-head `504-513`.

- [ ] **Step 1:** A tartalmi shell egységes szélessége: `mx-auto w-full max-w-[1024px] px-4 pt-6 pb-20`. Igazítsd a fő oldal-wrappereket (tournaments, groups, group/[id]).

- [ ] **Step 2:** Page-header (torna-oldal): `flex items-center gap-3.5 mb-[18px] mt-1.5`; badge `grid size-[46px] place-items-center rounded-xl bg-linear-to-br from-gold to-gold-2 text-gold-ink shadow-[0_8px_20px_-8px_var(--gold-2)]` (korona lucide `Crown`); cím `font-heading text-[27px] font-bold` (`max-[700px]:text-[22px]`).

- [ ] **Step 3:** `group-page-header.tsx`: breadcrumb (`gp-crumb`: `inline-flex items-center gap-[7px] text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground`), cím `font-heading text-[26px] font-bold` (`max-[700px]:text-[21px]`), jobb oldal „N hiányzó tipp" (`text-gold text-[12.5px] font-semibold`) + szabályok-ikon gomb.

- [ ] **Step 4: Build, lint, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): page headers + content shell (Phase 2)"
```

---

## Fázis 3 — Onboarding

### Task 3.1: Landing

**Files:**
- Modify: `src/components/landing-content.tsx`
- Referencia: `styles.css:715-743` (landing + btn-google); `src/landing.jsx` (struktúra); README 1.

- [ ] **Step 1:** Gyökér: `flex min-h-screen flex-1 flex-col items-center justify-center gap-14 px-5 py-16 text-center max-[680px]:gap-10`.

- [ ] **Step 2:** Hero: logó `Image` `className="size-[104px] [filter:drop-shadow(0_10px_28px_color-mix(in_oklab,var(--gold)_26%,transparent))]"`; cím `<h1 className="m-0 bg-linear-to-r from-white via-gold to-gold-2 bg-clip-text font-brand text-transparent leading-[0.98] text-[clamp(48px,9vw,80px)]">`; alcím `max-w-[440px] text-lg text-muted-foreground`; CTA a `Button size="lg"` + google-variáns.

- [ ] **Step 3: Google gomb** — vagy új `variant="google"` a button.tsx-ben (`bg-white text-[#1f2937] border-black/[0.08] shadow-[0_8px_22px_-12px_rgba(0,0,0,0.5)] hover:bg-[#f6f7f9] font-[650]`), VAGY a landingen `className` override-dal. **Döntés:** adj `google` variánst a button.tsx cva-hoz (a Fázis 1 Task 1.1 listáját bővítsd vele, ha még nem tetted) — így marad „egy gombrendszer". A gomb tartalmazza a valódi színes Google-G SVG-t (másold `src/landing.jsx`-ből).

- [ ] **Step 4: Feature-kártyák** — `grid w-full max-w-[860px] grid-cols-3 gap-3 max-[680px]:grid-cols-1`; kártya `Card` `p-5 text-left`; ikon-korong `grid size-[42px] place-items-center rounded-[11px] bg-gold-soft text-gold mb-3.5` (Target/Users/Trophy); cím `text-[15.5px] font-bold`; leírás `text-[13.5px] text-muted-foreground`.

- [ ] **Step 5: Lábléc** — `flex gap-3 text-[12.5px] text-faint`, linkek `hover:text-muted-foreground hover:underline`.

- [ ] **Step 6: Build, lint, vizuális → Commit**

```bash
git add src/components/landing-content.tsx src/components/ui/button.tsx
git commit -m "feat(design): landing redesign (Phase 3)"
```

### Task 3.2: Név-megadás dialog + torna-választó

**Files:**
- Modify: `src/components/display-name-dialog.tsx`, `src/components/tournament-tabs.tsx` (torna-választó rész) vagy a torna-választó oldal komponense.
- Referencia: NameModal & TournamentPicker `src/landing.jsx`; `styles.css:703-713,745-748`.

- [ ] **Step 1: Név-dialog** — hero-fejléc (`Users` ikon korongban + „Üdv a fedélzeten!" `font-heading`), középre igazított név-input (`h-[46px] text-center text-base bg-secondary border-border rounded-sm focus:border-gold-line`, max 20 kar + számláló `text-faint text-[11px]`), „Kezdés" `Button` (disabled ha üres).

- [ ] **Step 2: Torna-választó sorok** — `tour-row`: `flex w-full items-center gap-3.5 p-[15px] rounded-lg border border-border bg-card shadow-card text-left transition hover:-translate-y-0.5 hover:border-gold-line`; ikon `grid size-[46px] place-items-center rounded-xl` aktívnál `bg-linear-to-br from-gold to-gold-2 text-gold-ink` / jövőbelinél `bg-secondary border border-border text-muted-foreground` (lucide `Trophy`); fő `text-[16px] font-bold` + meta `font-mono text-[12px] text-faint`; jobb: státusz-badge + „N csoportod" + `ChevronRight`. Csak aktív kattintható (`disabled` + `opacity` a jövőbelin).

- [ ] **Step 3: Build, lint, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): name dialog + tournament picker (Phase 3)"
```

---

## Fázis 4 — Torna-oldal

### Task 4.1: Match-card (3 állapot)

**Files:**
- Modify: `src/components/match-card.tsx`
- Referencia: `styles.css:316-349` (.match + állapotok); `src/app.jsx` MatchCard; README 4. „Match-kártya".

- [ ] **Step 1: Kártya-konténer** — `flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-[15px] text-left shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-gold-line hover:shadow-[0_16px_30px_-22px_rgba(0,0,0,0.9),0_0_0_1px_var(--gold-line)_inset]`. Állapot-bal-sáv: nincs-tipp → `border-l-[3px] border-l-gold`; élő → `border-l-[3px] border-l-loss`.

- [ ] **Step 2: Idő-blokk** — közelgő: `font-mono font-bold text-[15px]` idő + `text-[10px] text-faint` helyszín. Élő: az idő helyén `inline-flex items-center gap-1.5 text-loss text-[13px]` + pulzáló pont (`size-[9px] rounded-full bg-loss animate-[livepulse_1.4s_ease-out_infinite]` — a `livepulse` keyframe-et add a globals.css-hez, `styles.css:450-451`). Befejezett: az idő helyén az eredmény `font-mono font-bold`.

- [ ] **Step 3: Csapat-sor** — `grid grid-cols-[1fr_auto_1fr] items-center gap-2`; csapat `flex items-center gap-2 min-w-0` (away: `justify-end`); zászló `TeamLogo`/`Image` `w-[26px] h-[19px] rounded-[3px] object-cover shadow-[0_0_0_1px_var(--border)]`; név `font-semibold text-[14px] truncate`; közép „VS" `text-[10px] tracking-[0.2em] text-faint`.

- [ ] **Step 4: Odds 1/X/2** — `grid grid-cols-3 gap-1`; cella `flex items-baseline justify-center gap-1.5 font-mono text-[12px] py-[3px] rounded-[7px] bg-secondary`; kulcs `text-[9px] text-faint font-bold`; érték `font-semibold`. Érték-szín az odds nagysága szerint (kék→lila→narancs) — segédfüggvény: kis odds (`<2`) `text-sky-400`, közepes `text-violet-400`, nagy (`>4`) `text-orange-400` (a prototípus `src/app.jsx` oddsColor logikáját portold).

- [ ] **Step 5: Tipp-sáv** — `flex flex-col items-center gap-1.5 border-t border-border pt-[9px]`; saját tipp eredménye `font-mono font-bold text-[15px]` (nyert `text-win`, vesztes `text-loss line-through`) + tipp-pillek; „Nincs tipp" `text-gold text-[12.5px] font-semibold`.

- [ ] **Step 6: Kattintás** — közelgő → bet-dialog; élő/befejezett → match-modal (a meglévő handler-eket tartsd meg).

- [ ] **Step 7: livepulse keyframe a globals.css-be**

```css
@keyframes livepulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--loss) 55%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
```
`@media (prefers-reduced-motion: reduce)` esetén `.animate-[livepulse...]` → `animation: none` (add a base-be).

- [ ] **Step 8: Build, lint, test, vizuális → Commit**

```bash
git add src/components/match-card.tsx src/app/globals.css
git commit -m "feat(design): match card 3 states (Phase 4)"
```

### Task 4.2: Nap-akkordeon + szűrő-Segmented + hivatalos-szalag

**Files:**
- Modify: `src/components/tournament-tabs.tsx` (szűrő), a nap-csoportosító komponens, `src/components/official-group-ribbon.tsx`
- Referencia: `.day*` `styles.css:298-311`; `.ribbon*` `267-291`; `.seg` (Task 1.2); README 4.

- [ ] **Step 1: Szűrő-Segmented** — Közelgő / Lejátszott / Mind / Dobogósok a `Tabs`/`TabsList`/`TabsTrigger`-rel (már Segmented-stílusú).

- [ ] **Step 2: Nap-akkordeon** — fejléc `flex w-full items-center gap-2.5 h-10 px-4 rounded-[calc(var(--radius)*0.85)] border border-border bg-secondary hover:bg-surface-3`; `d-label` `font-[650] text-[14px]`; `d-count` `font-mono text-[12px] text-faint` (teljesnél `text-win`); chevron `ml-auto text-faint transition-transform data-[open=true]:rotate-180`. Body: `grid grid-cols-3 gap-3 pt-3 max-[880px]:grid-cols-2 max-[560px]:grid-cols-1`. Használd a meglévő `Collapsible`/`Accordion` primitívet.

- [ ] **Step 3: Hivatalos-szalag** — `overflow-hidden rounded-lg border border-gold-line bg-card shadow-card`; fejléc-gomb `flex w-full items-center gap-3 p-3 px-4 bg-linear-to-r from-gold-soft to-transparent text-left`; korona-korong `grid size-[30px] place-items-center rounded-[9px] bg-linear-to-br from-gold to-gold-2 text-gold-ink`; stat `font-mono text-[13.5px]` (kiemelt szám `text-gold font-bold`); „köv. 3 nap" jegyzet `text-muted-foreground text-[12.5px]`; „Részletek →" link + chevron. Body: `border-t border-gold-line p-3.5 px-4 flex flex-col gap-3` — „Ranglista" + Szabályok gomb, majd lb-sorok (`lb-row`: `flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[14px]`, `me` sor `bg-gold-soft`, rank `font-mono text-muted-foreground font-bold w-[30px]`, pts `font-mono text-gold font-bold`), a teljes lista kattintható → csoport-oldal, alul „Csoport megnyitása →" (`text-gold font-mono text-[12.5px]`).

- [ ] **Step 4: Build, lint, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): day accordion + filter segmented + official ribbon (Phase 4)"
```

---

## Fázis 5 — Tipp-leadás modal

### Task 5.1: Bet-form / bet-dialog

**Files:**
- Modify: `src/components/bet-form.tsx`, `src/components/bet-dialog.tsx`
- Referencia: `.score-set/.stepper/.step-btn/.odd-cells/.odd-cell/.stake-presets/.preset` `styles.css:366-387`; `src/app.jsx` BetModal; README 5.

- [ ] **Step 1: Fejléc** — modal-head dátummal (`font-mono text-[12px] text-muted-foreground`), X-zárás (a `Dialog` primitív adja).

- [ ] **Step 2: Eredmény-beállító zászlókkal** — `flex items-center justify-center gap-3.5`: haza zászló (`w-[38px] h-[28px] rounded-[5px] object-cover`) — stepper — `:` — stepper — vendég zászló. Stepper: `flex flex-col items-center gap-1.5`, szám `font-mono font-extrabold text-[34px] w-11 text-center`, gombok `step-btn`: `w-[38px] h-6 grid place-items-center rounded-[8px] bg-secondary border border-border text-muted-foreground hover:bg-surface-3 hover:text-foreground active:scale-90`.

- [ ] **Step 3: 1/X/2 cellák** — `grid grid-cols-3 gap-2 mb-4`; cella `flex items-center justify-center gap-1.5 p-[7px] rounded-[9px] font-mono text-[14px] bg-secondary text-muted-foreground border border-border`; a tippelt kimenetel `bg-gold-soft text-gold border-gold-line font-bold`. (A kimenetelt az eredmény-beállítóból számold, ahogy a prototípus.)

- [ ] **Step 4: Elválasztó + Ranglista + egyenleg** — `divider` (`h-px bg-border my-3.5`); „Ranglista" sor + egyenleg `font-mono`.

- [ ] **Step 5: Tét-presetek** — `grid grid-cols-4 gap-1.5 my-2.5`; preset `flex items-center justify-center gap-1 px-1 py-2 rounded-[8px] font-mono text-[13px] font-semibold bg-secondary text-muted-foreground border border-border hover:text-foreground`; kiválasztott `bg-foreground text-card border-transparent`. Értékek a meglévő logika szerint (a prototípus 10/50/100/250 — de a valós preseteket a meglévő bet-form adja, ne írd felül a logikát).

- [ ] **Step 6: Elsődleges gomb** — „Tipp leadása/módosítása" `Button` (default/gold). Csak érvényes állapotban aktív.

- [ ] **Step 7: Build, lint, test, vizuális → Commit**

```bash
git add src/components/bet-form.tsx src/components/bet-dialog.tsx
git commit -m "feat(design): bet placement modal (Phase 5)"
```

---

## Fázis 6 — Meccs-modal (élő / befejezett)

### Task 6.1: Scoreboard

**Files:**
- Modify: `src/components/match-scoreboard.tsx`
- Referencia: `.sb*` `styles.css:438-453`; README 6.

- [ ] **Step 1:** `grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 px-0.5 pt-1.5 pb-3.5`; oldal `flex flex-col items-center gap-[7px] min-w-0` zászló `w-11 h-8 rounded-[5px] object-cover shadow-[0_0_0_1px_var(--border)]` + név `font-[650] text-[13.5px] text-center line-clamp-2`; közép `flex flex-col items-center gap-[3px] min-w-[78px]` — eredmény `font-mono font-extrabold text-[32px]` VAGY élő `inline-flex items-center gap-[7px] text-loss font-bold text-[15px]` + `live-dot` (pulzáló).

- [ ] **Step 2: Build, lint, vizuális → Commit**

```bash
git add src/components/match-scoreboard.tsx
git commit -m "feat(design): match scoreboard (Phase 6)"
```

### Task 6.2: Tippek tab + bet-row

**Files:**
- Modify: `src/components/match-tips-tab.tsx`, `src/components/bet-row.tsx`
- Referencia: `.bet-row*` `styles.css:459-479`; README 6 „Tippek".

- [ ] **Step 1: bet-row** — `grid grid-cols-[26px_26px_1fr_auto] items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] bg-secondary border border-transparent`; `me` sor `bg-gold-soft border-gold-line`; rank `font-mono text-[13px] font-bold text-faint text-center`; érem `text-[16px] text-center`; fő-blokk: név `text-[13.5px] font-semibold truncate` + meta `flex items-center gap-[7px] font-mono text-[11px] text-muted-foreground` (`br-pred` `text-foreground font-semibold`); jobb: nyeremény `font-mono font-bold text-[13.5px]` (win `text-win` / loss `text-loss`) + tét `font-mono text-[10.5px] text-faint`.

- [ ] **Step 2: Tippek tab (élő)** — tét szerint rendezett bet-row lista (`flex flex-col gap-[5px]`); saját sor kiemelt; „Összes (N)" kibontás (`Collapsible`).

- [ ] **Step 3: Tippek tab (befejezett)** — „Dobogó" (🥇🥈🥉 érmek a `br-medal`-ban) + „Körülötted" ablak (saját helyezés köré), `section-label` (`text-[10px] font-bold uppercase tracking-[0.12em] text-faint`); profit +/− színezve; „Teljes ranglista (N)" kibontás.

- [ ] **Step 4: Build, lint, test, vizuális → Commit**

```bash
git add src/components/match-tips-tab.tsx src/components/bet-row.tsx
git commit -m "feat(design): match tips tab + bet rows (Phase 6)"
```

### Task 6.3: Statisztika tab

**Files:**
- Modify: `src/components/match-stats-tab.tsx`
- Referencia: `.stat-block/.stacked/.seg-fill/.legend/.kv` `styles.css:481-499`; README 6 „Statisztika".

- [ ] **Step 1: 1–X–2 megoszlás** — KÉT vízszintes sáv (db szerint és tét szerint): `stacked` `flex gap-1 h-[30px]`; szegmens `seg-fill` `flex items-center justify-center rounded-[7px] min-w-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.14)]` gradiens háttérrel (1=sky, X=violet, 2=orange — a prototípus színskálája), benne `seg-tag` `font-mono font-extrabold text-[11px] text-white`. Legend `flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2.5` `lg-dot` `size-[9px] rounded-[3px]`.

- [ ] **Step 2: Eredmény-tippek** — `kv` sorok (`flex items-center justify-between py-[7px] border-b border-border text-[13px]`, `kv-k` `text-muted-foreground`, `kv-v` `font-mono font-semibold`): leggyakoribb, átlag, pontos találat **célkereszt-ikonnal** (lucide `Crosshair`, NEM emoji), helyes kimenetel.

- [ ] **Step 3: Tét** — kv-sorok: legnagyobb / össz / átlag.

- [ ] **Step 4: Build, lint, vizuális → Commit**

```bash
git add src/components/match-stats-tab.tsx
git commit -m "feat(design): match stats tab (Phase 6)"
```

---

## Fázis 7 — Csoport-oldal

### Task 7.1: Group-detail tabs + akkordeon-kártya (Ranglista & Eredmények)

**Files:**
- Modify: `src/components/group-detail-tabs.tsx`, `src/components/group-leaderboard-content.tsx`, `src/components/group-results-content.tsx`, `src/components/group-bets-section.tsx`
- Referencia: `.acc-card*` `styles.css:566-585`; README 8.

- [ ] **Step 1: Tabs** — Ranglista / Eredmények / Beállítások a Segmented-del.

- [ ] **Step 2: Akkordeon-kártya (SHARED)** — `acc-card`: `overflow-hidden rounded-sm border border-border bg-card shadow-card`; `me` `bg-gold-soft border-gold-line`; fejléc `flex w-full items-center gap-2.5 p-2.5 px-3 text-left hover:bg-secondary` (a `me` fejléc hover marad átlátszó); rank `font-mono font-bold text-faint min-w-[26px]` (érem `text-[16px]`); név `flex-1 font-semibold text-[14px] truncate`; profit `font-mono font-bold text-[14px]` (up `text-win` / down `text-loss`); chevron `text-faint transition-transform`. Body `border-t border-border p-3 px-3 bg-card` (**tömör**, NEM áttetsző a `me`-nél sem — ezért `bg-card` a body-n, akkor is ha a kártya `me`).

- [ ] **Step 3: Ranglista body** — játékos meccsenkénti tippbontása (MatchRow). Eredmények body — **inline** bet-row lista (UGYANAZ a kártya, mint Ranglistánál).

- [ ] **Step 4: Build, lint, test, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): group leaderboard + results accordion (Phase 7)"
```

### Task 7.2: Beállítások tab + szabályok-dialog

**Files:**
- Modify: a beállítások-form komponens (a `group-detail-tabs.tsx` settings része v. külön fájl), `src/components/group-rules-dialog.tsx`
- Referencia: `.field/.settings-grid/.switch-row/.member-row/.danger-zone/.card-section` `styles.css:518-557`; KV-modal `230`; README 8.

- [ ] **Step 1: card-section** — `bg-card border border-border rounded-lg shadow-card p-[15px]`, cím `cs-title` `text-[14px] font-bold mb-3`.

- [ ] **Step 2: Pontozás** — `settings-grid` `grid grid-cols-2 gap-x-4 gap-y-3.5 max-[560px]:grid-cols-1`; mező `field` (`flex flex-col gap-1.5`, label `text-[12.5px] font-semibold text-muted-foreground`, hint `text-[11.5px] text-faint`) NumericInput-tal (odds-szorzó, veszteség%, bónuszok).

- [ ] **Step 3: Láthatóság** — `switch-row` `flex items-center justify-between gap-3 p-3 px-3.5 border border-border rounded-sm bg-secondary` (label + sub) + Switch; leírás textarea.

- [ ] **Step 4: Tagok** — `member-row` `flex items-center gap-2.5 py-2 border-b border-border` (avatar + név + „te" jelölés + eltávolítás-`icon-btn`: `grid size-[30px] place-items-center rounded-[8px] text-faint hover:bg-loss-soft hover:text-loss`).

- [ ] **Step 5: Veszélyzóna** — `danger-zone` `border border-loss-soft rounded-sm p-3.5`, cím `text-[12px] font-bold uppercase tracking-[0.08em] text-loss`, „Csoport törlése" `Button variant="destructive"`.

- [ ] **Step 6: Szabályok-dialog** — KV-sorok (kezdő egyenleg / kifizetés / dobogó-tipp) a `.kv` mintával.

- [ ] **Step 7: Build, lint, test, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): group settings + rules dialog (Phase 7)"
```

---

## Fázis 8 — Csoportok (lista + podium)

### Task 8.1: Groups lista + group-card + archivált + publikus szekció

**Files:**
- Modify: `src/components/group-card.tsx`, `src/components/public-groups-section.tsx`, `src/components/archived-groups-section.tsx`, a groups-lista oldal
- Referencia: `.gc-grid/.gcard/.gc-head/.gc-badge/.status-badge/.archived-toggle` `styles.css:670-700`; README 9.

- [ ] **Step 1: group-card** — `overflow-hidden rounded-lg border border-border bg-card shadow-card text-left w-full transition hover:-translate-y-[3px] hover:border-gold-line`; publikus `border-dashed`. Gradiens fejléc `gc-head` `relative p-[15px] bg-linear-to-br from-[#1e3a5f] to-[#2d1b69]` + sarok-glow `after:absolute after:inset-0 after:bg-[radial-gradient(120%_90%_at_88%_-10%,color-mix(in_oklab,var(--gold)_22%,transparent),transparent_55%)]`; név `font-bold text-[15px] text-white truncate`, torna `font-mono text-[11px] text-white/60`, profit-badge `gc-badge` `inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-black/[0.28] font-mono font-bold text-[12.5px]` (up `text-[#4ade80]`/down `text-[#f87171]`/flat `text-white/70`). Body `gc-body` `p-3.5 px-[15px] bg-card`: leírás `text-[12.5px] text-muted-foreground line-clamp-2`, lábléc taglétszám (`text-[11.5px] text-faint`) + status-badge.

- [ ] **Step 2: Publikus szekció** — szaggatott keret + glóbusz (lucide `Globe`); kattintásra a publikus-csatlakozás dialog.

- [ ] **Step 3: Archivált szekció** — `archived-toggle` `inline-flex items-center gap-2 text-[13.5px] text-muted-foreground hover:text-foreground` + chevron `data-[state=open]:rotate-180`.

- [ ] **Step 4: section-head** — „Csoportjaim"/„Publikus csoportok": `flex items-center gap-2`, cím `text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground` + `flex-1 h-px bg-border` vonal.

- [ ] **Step 5: Build, lint, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): groups list + group cards (Phase 8)"
```

### Task 8.2: Új-csoport form + publikus csatlakozás dialog

**Files:**
- Modify: `src/components/create-group-form.tsx`, `src/components/public-group-dialog.tsx`
- Referencia: NewGroupModal/JoinPublicModal `src/group-list.jsx`; README 9.

- [ ] **Step 1: Új-csoport** — név-input, torna-választó (Segmented), pontozási sablon (Laza/Standard/Hardcore — Segmented v. választó), publikus Switch, Mégse/Létrehozás gombok. Létrehozás csak érvényes névnél aktív.

- [ ] **Step 2: Publikus csatlakozás** — gradiens fejléc (mint group-card), leírás, info-jegyzet (`help-note` minta: `flex gap-2 p-2.5 px-3 rounded-sm bg-secondary border border-border text-[12.5px] text-muted-foreground`), Csatlakozás gomb.

- [ ] **Step 3: Build, lint, test, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): create-group form + public join dialog (Phase 8)"
```

### Task 8.3: Podium-tab + team-picker + own-groups summary

**Files:**
- Modify: `src/components/podium-form.tsx`, `src/components/podium-team-picker.tsx`, `src/components/podium-team-list.tsx`, `src/components/group-token-summary.tsx`
- Referencia: `.podium*/.tp-*/.og-*` `styles.css:589-663`; README 4 „Dobogós tab" + „Saját csoportok összegző".

- [ ] **Step 1: Emelvény** — `podium` `flex items-end justify-center gap-2.5 max-w-[380px] mx-auto`; oszlopok CSS `order`-rel (2. bal/ezüst, 1. közép/arany legmagasabb 124px, 3. jobb/bronz 70px); `pod-stand` `w-full rounded-t-xl grid place-items-center cursor-pointer transition hover:-translate-y-[3px]`; magasságok/gradiensek a `styles.css:599-604` szerint (gold `from-[color-mix(in_oklab,var(--gold)_55%,var(--card))]` …); üres `bg-secondary border-dashed` + „Válassz"; `pod-bar` az aljon (`py-[5px] text-center font-mono font-extrabold text-[13px]`, gold `bg-gold-2 text-gold-ink`, silver `bg-[#9aa6b8]`, bronze `bg-[#c47a3e]`).

- [ ] **Step 2: Team-picker dialog** — kereshető lista (`tp-search` `flex items-center gap-2.5 p-2.5 px-3 border border-border rounded-sm bg-secondary` + input; `tp-item` `flex items-center gap-2.5 w-full p-2.5 px-3 rounded-[10px] hover:bg-secondary`, kiválasztott `bg-gold-soft border border-gold-line`, már választott `opacity-40 cursor-not-allowed`).

- [ ] **Step 3: „Dobogó-tipp leadása" gomb** — csak mindhárom kitöltve aktív.

- [ ] **Step 4: Own-groups summary** — `og-grid` `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3`; `og-card` (`flex flex-col gap-2.5 p-[15px] rounded-lg border border-border bg-card shadow-card hover:-translate-y-0.5 hover:border-gold-line`): ikon (hivatalosnál `bg-linear-to-br from-gold to-gold-2 text-gold-ink`, lucide `Crown`) + név + taglétszám + helyezés (`og-rank` `font-mono font-extrabold text-[17px]`); mini top-3 (`og-mini` `bg-secondary rounded-[10px] p-2.5`) érmekkel; profit + „hiányzó tipp"/„köv. 3 nap kész".

- [ ] **Step 5: Build, lint, test, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): podium tab + team picker + own-groups summary (Phase 8)"
```

---

## Fázis 9 — Polish

### Task 9.1: Help-dialog + maradék komponensek

**Files:**
- Modify: `src/components/help-dialog.tsx`, `src/components/token-icon.tsx`, `src/components/tournament-status-badge.tsx`, `src/components/invite-code-badge.tsx`, `src/components/admin-panel.tsx` (alap dark-konzisztencia), `src/components/team-logo.tsx`, `src/components/tournament-logo.tsx`, `src/components/match-datetime.tsx`
- Referencia: `.help-*` `styles.css:396-433,783`; README 7.

- [ ] **Step 1: Help-dialog** — hero (`flex items-center gap-3.5 p-5 bg-linear-to-br from-gold-soft to-transparent border-b border-border` + korona-korong + `font-heading text-[19px]`), 3 számozott lépés (`help-num` `grid size-7 place-items-center rounded-[9px] bg-secondary border border-border font-mono font-bold text-gold`), „Pontozás" + zseton-modell KV-sorok, „Értem" gomb.

- [ ] **Step 2: token-icon** — a logó kicsinyítve (`Image` a `tippcasino-logo.png`-ből), egységesen ott ahol „zseton" jelenik meg.

- [ ] **Step 3: Maradék badge-ek/kis komponensek** — status-badge, invite-code-badge a Badge-variánsokra; admin-panel csak annyira, hogy dark-konzisztens legyen (nem hifi képernyő).

- [ ] **Step 4: Build, lint, test, vizuális → Commit**

```bash
git add -A
git commit -m "feat(design): help dialog + remaining components (Phase 9)"
```

### Task 9.2: Reszponzivitás, reduced-motion, takarítás, teljes verifikáció

**Files:**
- Modify: `src/app/globals.css` (reduced-motion gate), bármely komponens ahol hiányzik a mobil-breakpoint.
- Referencia: README „Reszponzivitás" + „Interakciók".

- [ ] **Step 1: reduced-motion** — a globals.css base-be:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Globális `overflow-x` védelem** — biztosítsd `html, body { overflow-x: hidden; }` a globals.css-ben (`styles.css:753`).

- [ ] **Step 3: Hit-target audit** — mobil minimum ≥44px ahol kritikus (gombok, tab-elemek, sor-kattintások). Ellenőrzés `npm run dev` mobil nézetben.

- [ ] **Step 4: Maradék `--brand-*` / `.nav-header` referenciák kiirtása** — `git grep "brand-blue\|brand-gold\|nav-header" src` → 0 találat. Ami maradt, írd át a redesign tokenekre.

- [ ] **Step 5: Dead-CSS / dead-token audit** — `git grep "geist" src` → 0; nincs felesleges custom prop.

- [ ] **Step 6: Teljes verifikáció**

Run: `npm run build && npm run check && npm run test`
Expected: mind PASS. Majd `npm run dev` → végigkattintás a prototípus szerinti összes képernyőn (landing → torna → modálok → csoportok), összevetve `docs/assets/design_handoff_tippcasino_redesign/TippCasino.html`-lel.

- [ ] **Step 7: Code review**

Használd a **typescript-reviewer** és **code-reviewer** agenteket a teljes diffre (`git diff main...HEAD`). Javítsd a CRITICAL/HIGH találatokat.

- [ ] **Step 8: Commit + dokumentáció**

```bash
git add -A
git commit -m "feat(design): responsive polish + reduced-motion + cleanup (Phase 9)"
```

### Task 9.3: Dokumentáció frissítése

**Files:**
- Modify: `CLAUDE.md` (UI/design system szekció), `ARCHITECTURE.md` (token-rendszer), `TODO.md`
- Referencia: a user CLAUDE.md „Dokumentáció" szabálya — nézd át az ÖSSZES érintett .md-t.

- [ ] **Step 1:** `ARCHITECTURE.md`-ben dokumentáld az új token-rendszert (a fenti Token-megfeleltetés táblát) és a „dark default" döntést.
- [ ] **Step 2:** `CLAUDE.md` Konvenciók: „egyetlen Segmented (`ui/tabs.tsx`) + egyetlen Button (`ui/button.tsx`)"; arany brand = `text-primary`/`bg-primary` / `*-gold`, shadcn `accent` = halvány hover.
- [ ] **Step 3:** `TODO.md`-ben jelöld kész a redesignt + rövid végső leírás.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: design system token mapping + redesign notes (Phase 9)"
```

---

## Önellenőrzés (spec-lefedettség)

- **Onboarding** (landing, név, torna-választó) → Fázis 3. ✓
- **Torna-oldal** (nav, page-head, szalag, szűrő, nap-akkordeon, match-card 3 állapot, own-groups summary, podium-tab) → Fázis 2,4,8. ✓
- **Modálok** (tipp, élő/befejezett meccs, súgó, csoport-szabályok, publikus csatlakozás) → Fázis 5,6,7,8,9. ✓
- **Csoportok** (lista, új-csoport form, csoport-oldal 3 tab) → Fázis 7,8. ✓
- **Design system mag** (Segmented, Button, Card, Pill, Avatar, Switch, NumInput, textarea) → Fázis 1. ✓
- **Tokenek/témák/háttér/fontok** → Fázis 0. ✓
- **Reszponzivitás / reduced-motion** → Fázis 9. ✓

**Nyitott, szándékos kihagyások:** (1) accent-szín- és density-tweak (prototípus-only, README szerint nem kell); (2) téma-váltó UI (dark fix; light tokenek készen a jövőre); (3) admin-panel csak dark-konzisztencia, nem hifi.

---

## Commit-konvenció
`feat(design): …` / `fix(design): …` / `docs: …` — conventional commits. Attribúció globálisan kikapcsolva.
