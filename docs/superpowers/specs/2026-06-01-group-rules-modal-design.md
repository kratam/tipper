# Csoportszabályok modal — Design

**Dátum:** 2026-06-01
**Státusz:** Jóváhagyásra vár

## Motiváció

Jelenleg a csoportbeállítások („szabályok") megjelenítése hiányos és szétszórt:

- A hivatalos „Ranglista" ribbon ([official-group-ribbon.tsx:132-144](../../../src/components/official-group-ribbon.tsx#L132))
  egy lenyitható panelben **csak 3 beállítást** mutat a 8-ból (odds szorzó, gólkülönbség
  bónusz, pontos eredmény bónusz). Hiányzik az indulótőke, token/meccs, dobogó bónuszok és
  a vesztési visszatérítés.
- A teljes lista **csak a tulajdonosnak** látszik, szerkeszthető input mezőkként a Beállítások
  fülön ([group-detail-tabs.tsx:244+](../../../src/components/group-detail-tabs.tsx#L244)).
- Egy sima tag egy normál csoportban **sehol nem látja** a csoport szabályait, pedig fogadás
  közben pont ez a legrelevánsabb (hogyan pontoz a csoport, mennyit kap vissza bukáskor).

A cél: egy **egységes, csak-olvasható szabály-nézet**, ami minden beállítást elmagyaráz,
és minden releváns helyen ugyanúgy elérhető.

## Döntések (brainstormból)

| Kérdés | Döntés |
|--------|--------|
| Hatókör | Egységes, újrahasznosítható csak-olvasható komponens, 3 helyen használva |
| Tartalmi elrendezés | Csoportosított szekciók + magyarázat a nem triviális értékekhez |
| Konténer | Shadcn `Dialog` (modal) — az app már mindenhol ezt használja, mobilon is jó |
| Trigger | „Szabályok" szöveg + ikon; szűk fejlécben (mobil) csak ikon |

## Komponens

Új fájl: `src/components/group-rules-dialog.tsx`

```ts
// Megosztott típus — a group-detail-tabs.tsx meglévő GroupSettings típusát emeljük ide.
export interface GroupRules {
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
  lossPercentage: number;
}

interface GroupRulesDialogProps {
  groupName: string;
  rules: GroupRules;
  /** Mobilon / szűk helyen csak ikon, label nélkül. Default: false (szöveg + ikon). */
  iconOnly?: boolean;
}

export function GroupRulesDialog(props: GroupRulesDialogProps): JSX.Element;
```

- A komponens magába zárja a trigger gombot **és** a Dialog open-state-jét (önálló,
  bárhova bedobható).
- Trigger: `Button` `variant="ghost" size="sm"` egy `ScrollText` (vagy `Info`) lucide
  ikonnal + „Szabályok" felirat. `iconOnly` esetén csak az ikon (aria-label a felirattal).
- A megosztott `GroupRules` típust a `group-detail-tabs.tsx` is innen importálja (a mostani
  lokális `GroupSettings` helyett), hogy egy forrása legyen az igazságnak.

## Tartalmi elrendezés

Modal cím: `{groupName} · {t("rules")}` (a `rules` kulcs már létezik = „Szabályok").

Szekciók (label–érték sorok, a magyarázatos sorok alatt egy halvány segédszöveg):

**TOKENEK**
- Indulótőke — `initialTokens`
- Token / meccs — `tokenPerMatch`

**PONTOZÁS**
- Odds szorzó — `×{oddsBoost}` + magyarázat (pl. „A nyeremény {pct}%-kal több az eredeti
  oddsnál.", ahol `pct = round((oddsBoost - 1) * 100)`; ha `oddsBoost === 1`, a magyarázat
  elmarad)
- Gólkülönbség bónusz — `+{bonusGoalDiff}`
- Pontos eredmény bónusz — `+{bonusExactScore}`

**DOBOGÓ TIPP** (csak ha bármelyik > 0)
- Dobogós említés bónusz — `+{bonusPodiumMention}`
- Pontos helyezés bónusz — `+{bonusPodiumExact}`

**VESZTÉS**
- Visszatérítés — `{100 - lossPercentage}%` + magyarázat („Vesztett meccs után a tét
  {100 - lossPercentage}%-át visszakapod." ; ha `lossPercentage === 100`, akkor „Bukáskor
  a teljes tétet elveszíted.")

### Megjelenítési részletek
- A 0 értékű **bónusz** sorok kimaradnak (kikapcsolt funkció → ne zavarjon). A token-sorok
  (indulótőke, token/meccs) és a vesztési visszatérítés mindig látszanak.
- Értékek `font-mono`, amber kiemeléssel (`text-amber-500`), a kódbázis meglévő mintája
  szerint (vö. ribbon).
- Szekciócímek: apró, `text-muted-foreground`, `uppercase tracking-wide text-xs`.

## i18n

Új kulcsok a `groups` névtérbe (`messages/hu.json` **és** `messages/en.json`):

| Kulcs | HU |
|-------|-----|
| `rulesTokens` | „Tokenek" |
| `rulesScoring` | „Pontozás" |
| `rulesPodium` | „Dobogó tipp" |
| `rulesLoss` | „Vesztés" |
| `oddsBoostExplain` | „A nyeremény {pct}%-kal több az eredeti oddsnál." |
| `refund` | „Visszatérítés" |
| `refundExplain` | „Vesztett meccs után a tét {pct}%-át visszakapod." |
| `refundExplainFull` | „Bukáskor a teljes tétet elveszíted." |

Újrahasznosított, már létező kulcsok: `rules`, `initialTokens`, `tokenPerMatch`, `oddsBoost`,
`bonusGoalDiff`, `bonusExactScore`, `bonusPodiumMention`, `bonusPodiumExact`.

> Megjegyzés: a megjelenítés a **visszatérítés** (`100 - lossPercentage`) felől fogalmaz, nem a
> meglévő „Vesztési %" felől — ez érthetőbb a játékosnak. A szerkesztő (settings) fül változatlan.

## Integrációs helyek (3) + adat-átvezetés

### 1. Hivatalos ribbon — `official-group-ribbon.tsx`
- A jelenlegi 3-elemű inline beállítás-sort ([132-144](../../../src/components/official-group-ribbon.tsx#L132))
  **lecseréljük** a `GroupRulesDialog` triggerre (a mini-leaderboard marad).
- A ribbon prop-jait bővítjük a teljes `GroupRules` mezőkészletre.
- Adat: [tournaments/[slug]/page.tsx:178-190](../../../src/app/[locale]/tournaments/[slug]/page.tsx#L178)
  `officialCard` objektum — az `og` (official group) **már tartalmaz minden mezőt**, csak
  hozzá kell adni: `initialTokens`, `bonusPodiumMention`, `bonusPodiumExact`, `lossPercentage`.

### 2. Normál csoport oldal — `group-detail-tabs.tsx`
- A `settings` objektum **már a teljes 8 mezőt** tartalmazza ([37-46](../../../src/components/group-detail-tabs.tsx#L37)) — nincs új query.
- A trigger a csoport fejlécébe / a leaderboard fül tetejére kerül (a csoportnév mellé).
  Mobilon `iconOnly`.

### 3. Fogadási flow — `bet-form.tsx` (a `bet-dialog.tsx`-en keresztül)
- A `GroupBetInfo` ([bet-dialog.tsx:28-50](../../../src/components/bet-dialog.tsx#L28)) jelenleg
  van: `tokenPerMatch`, `initialTokens`, `oddsBoost`, `lossPercentage`. **Hiányzik:**
  `bonusGoalDiff`, `bonusExactScore`, `bonusPodiumMention`, `bonusPodiumExact`.
- Át kell vezetni ezt a 4 mezőt a `GroupBetInfo`-t építő query-be (a fogadási összegzés
  forrása — `getUpcomingBetSummary` környéke a `src/queries`-ben) és a típusba.
- A trigger a BetForm-ban a csoportnév sora mellé kerül.

## Hibakezelés / edge case-ek
- `oddsBoost === 1` → nincs odds-magyarázat (nincs boost).
- `lossPercentage === 100` → „teljes tét elveszik" szöveg.
- Minden bónusz 0 → a DOBOGÓ TIPP szekció nem renderelődik.
- A modal csak-olvasható: nincs server action, nincs mutáció.

## Tesztelés
- **Unit (Vitest):** egy pure segédfüggvény a megjelenítendő sorok származtatására
  (`buildRulesRows(rules)`), ami lefedi: 0-bónusz kiszűrés, refund = 100 − lossPercentage,
  oddsBoost = 1 él. TDD.
- **Komponens:** a `GroupRulesDialog` renderel-e a megfelelő sorokkal; `iconOnly` aria-label.
- Manuális ellenőrzés mindhárom integrációs helyen (hivatalos ribbon, normál csoport, fogadás).

## Hatókörön kívül (YAGNI)
- A settings (szerkesztő) fül átalakítása — marad ahogy van.
- Szabályok szerkesztése a modalból — nem, csak-olvasható.
- A `lossPercentage` adatmodell átnevezése refund-ra — csak a megjelenítés fordít.
