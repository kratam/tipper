# Tipper - Tippjatek Design Spec

## Osszefoglalo

Tippjatek alkalmazas, ahol jatekosok versenysorozatok (Jegkorong VB, Foci VB) merkozeseire fogadhatnak tokenekkel. A jatekosok csoportokba szervezodnek sajat szabalyrendszerrel. Az odds-alapu pontozas es a fokozatos token kiosztas teszi strategiaiva a jatekot.

## Fo jellemzok

- **Token-alapu fogadas:** Valtozo tetek meccsenkent, tokenek koronkent kiosztva
- **Odds-alapu pontozas:** 1X2 eredmeny × odds + fix bonuszok golkulonbsegre es pontos eredmenyre
- **Csoportok:** Barki letrehozhat csoportot sajat szabalyokkal, meghivo linkkel csatlakozas
- **Globalis tipp + csoportonkenti feluliras:** Az eredmenytipp alapertelmezetten mindenhol ugyanaz, a tet csoportonkent kulon
- **Dobogos tippek:** Arany/ezust/bronz tipp a versenysorozat elejen, ingyenes
- **API integracio:** Meccsek, eredmenyek es oddsok az api-sports.io-bol

## Tech Stack

| Komponens | Technologia |
|-----------|-------------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Nyelv | TypeScript (strict) |
| DB | Neon Postgres (projekt: `patient-leaf-69938778`, eu-central-1) |
| ORM | Drizzle ORM |
| Auth | Neon Auth (Google login) |
| UI | Shadcn UI + Radix |
| Linter/Formatter | Biome |
| Cron | Vercel Cron |
| API forras | api-sports.io Hockey v1 |
| Hosting | Vercel (szemelyes account, NEM GuestGuru team) |
| Repo | github.com/kratam/tipper (deploy on push) |
| i18n | next-intl (magyar + angol, bovitheto) |

---

## Adatmodell

### users
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| google_id | text UNIQUE | Google OAuth ID |
| email | text UNIQUE | |
| name | text | |
| avatar_url | text | |
| is_admin | boolean | Rendszer admin (versenysorozat kezeles) |
| created_at | timestamptz | |

### tournaments
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| name | text | pl. "Jegkorong VB 2025" |
| slug | text UNIQUE | URL-ben hasznalt |
| api_league_id | integer | api-sports.io liga ID |
| api_season | integer | api-sports.io szezon (pl. 2025) |
| status | enum | upcoming / active / finished |
| podium_lock_date | timestamptz | Eddig lehet dobogos tippet adni |
| created_at | timestamptz | |

### teams
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| api_team_id | integer UNIQUE | api-sports.io team ID |
| name | text | Csapat nev (API-bol) |
| logo_url | text NULL | Csapat logo URL |
| created_at | timestamptz | |

### matches
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| tournament_id | uuid FK | |
| api_game_id | integer UNIQUE | api-sports.io game ID |
| home_team_id | uuid FK → teams | |
| away_team_id | uuid FK → teams | |
| home_score | integer NULL | Rendes jatekido (1-3. harmad osszege) |
| away_score | integer NULL | |
| status | enum | scheduled / live / finished / cancelled |
| scheduled_at | timestamptz | Meccs kezdes ideje |
| round | text | Meccsnaphoz rendeles, automatikusan a scheduled_at datuma (YYYY-MM-DD). Token kiosztas alapja. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### match_odds
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| match_id | uuid FK | |
| home_odds | decimal | 1-es odds |
| draw_odds | decimal | X odds |
| away_odds | decimal | 2-es odds |
| fetched_at | timestamptz | Mikor kerdeztuek le |

### groups
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| name | text | |
| slug | text UNIQUE | |
| invite_code | text UNIQUE | 6 karakteres kod (pl. XK4M2P) |
| owner_id | uuid FK → users | Csoport admin |
| tournament_id | uuid FK | |
| token_per_round | integer | Koronkent kiosztott tokenek (default: 100) |
| bonus_goal_diff | integer | Fix bonusz golkulonbseg eltalalasaert (default: 5) |
| bonus_exact_score | integer | Fix bonusz pontos eredmenyert (default: 10) |
| bonus_podium_mention | integer | Emlitett dobogos bonusz (default: 20) |
| bonus_podium_exact | integer | Pontos helyezes bonusz (default: 20) |
| carryover_percent | integer | Fel nem hasznalt tokenek atviteli %-a (default: 50) |
| created_at | timestamptz | |

### group_members
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| group_id | uuid FK | |
| user_id | uuid FK | |
| joined_at | timestamptz | |

### bets
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| user_id | uuid FK | |
| match_id | uuid FK | |
| group_id | uuid FK | Mindig kitoltve — nincs "globalis" bet a DB-ben |
| predicted_home | integer | Tippelt hazai gol |
| predicted_away | integer | Tippelt vendeg gol |
| stake | integer | Feltett tokenek |
| odds_at_bet | decimal NULL | A relevans odds (1/X/2) a tipp leadasakor, a tippelt kimenetel alapjan. NULL ha meg nem volt odds — az elso sync kitolti. |
| result_1x2_correct | boolean NULL | |
| goal_diff_correct | boolean NULL | |
| exact_score_correct | boolean NULL | |
| payout | integer NULL | Kiszamolt nyeremeny |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### podium_bets
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| user_id | uuid FK | |
| tournament_id | uuid FK | |
| group_id | uuid FK | Csoportonkent kulon dobogos tipp |
| gold_team_id | uuid FK → teams | |
| silver_team_id | uuid FK → teams | |
| bronze_team_id | uuid FK → teams | |
| created_at | timestamptz | |

### token_ledger
| Mezo | Tipus | Leiras |
|------|-------|--------|
| id | uuid PK | |
| user_id | uuid FK | |
| group_id | uuid FK | |
| tournament_id | uuid FK | |
| amount | integer | Pozitiv (jovairas) vagy negativ (levonas) |
| type | enum | distribution / bet / win / carryover / refund |
| reference_id | uuid NULL | Kapcsolodo bet/match ID |
| created_at | timestamptz | |

Egy jatekos egyenlege egy adott csoportban: `SUM(token_ledger.amount) WHERE user_id AND group_id`.

---

## Pontozasi Rendszer

### Meccstipp pontozas

Feltetel: a tipp 1X2 kategoriajaanak egyeznie kell az eredmennyel. Ha nem egyezik: 0 nyeremeny, a tet elveszett.

| Elem | Feltetel | Nyeremeny |
|------|----------|-----------|
| 1X2 eltalálva | Tippelt 1/X/2 = tenyleges 1/X/2 | `stake × odds_at_bet` |
| Golkulonbseg | Tippelt golkulonbseg = tenyleges golkulonbseg | `+ bonus_goal_diff` (csoport beallitas) |
| Pontos eredmeny | Tipp = eredmeny pontosan | `+ bonus_exact_score` (csoport beallitas) |

**Fontos:** Golkulonbseg es pontos eredmeny bonusz CSAK helyes 1X2 eseten jar.

**Rendes jatekido:** Ha a meccs hosszabbitasba megy, az eredmeny az 1-3. harmad osszege (dontetlennel szamolunk). Pl. ha 2:2 utan OT-ban 3:2, nalunk 2:2.

### Dobogos tipp pontozas

A versenysorozat vegeztevel szamolodik:

| Elem | Nyeremeny |
|------|-----------|
| Emlitett csapat a dobogon (barmely helyen) | `+ bonus_podium_mention` |
| Pontos helyezes (pl. aranyra tippelt aranyat nyer) | `+ bonus_podium_exact` (a mention-on felul) |

Pelda: Svedorszagot aranyra tippeled, bronzot nyer → `bonus_podium_mention` (pl. 20). Ha aranyat nyer → `bonus_podium_mention + bonus_podium_exact` (pl. 20+20 = 40).

### Odds nelkuli tipp

Ha a tipp leadasakor meg nincs odds (az API meg nem toltotte be):
- A jatekos tippelhet, de elfogadja hogy az elso betoltott odds alapjan szamolunk
- `bets.odds_at_bet` NULL marad, az elso odds sync automatikusan kitolti
- A UI jelzi: "Az odds meg nem elerheto, az elso betoltott odds alapjan szamolunk."

---

## Token Gazdasag

### Kiosztas
- Minden kor (meccsnap) elejen a jatekos kap `token_per_round` tokent (csoport beallitas)
- Elozo korbol fel nem hasznalt tokenek `carryover_percent`%-a atvitelre kerul (kerekites lefele)
- Elso kor: mindenki ugyanonnan indul

### Fogadas
- Egy meccsre egy tipp csoportonkent, valtozo tettel
- Nincs felso korlat — all-in lehetseges
- A tet a tipp leadasakor levonodik az egyenlegbol (`token_ledger`: type=bet, negativ)
- Meccs kezdeteig szabadon modosithato/visszavonhato (token visszaterites)

### Kesoi csatlakozas
- Az aktualis kortol kapja a tokeneket (nem visszamenoleg)
- Korabbi meccsekre nem tippelhet
- Dobogos tippet meg megadhat, ha `podium_lock_date` nem jart le

---

## API Szinkronizacio (Cron)

**Forras:** api-sports.io Hockey v1
**Auth:** `x-apisports-key` header (env: `API_SPORTS_KEY`)
**Limit:** 7,500 request/ho

### Cron utemezese
- Meccsnap: **15 percenkent**
- Nem meccsnap: **6 orankent**
- Megkulonboztetes: van-e `scheduled` vagy `live` meccs az adott napon

### Cron lepesek minden futaskor

1. **Fixtures sync** — `GET /games?league={id}&season={year}`
   - Uj meccsek → INSERT `matches`
   - Meglevo meccsek → UPDATE status, score
   - `scheduled → live`: tippek lezarasa (nem modosithatok tobbe)
   - `FT/AOT/AP` es meg nem volt pontozva → pontozas trigger

2. **Odds sync** — `GET /odds?league={id}&season={year}`
   - Csak `scheduled` statuszu meccsekhez mentunk oddst
   - `match_odds` tablaba uj rekord
   - `bets` ahol `odds_at_bet IS NULL` → kitoltes a friss odds-szal

3. **Pontozas** (ha van ujonnan befejezett meccs)
   - Minden bet-re kiszamolja az eredmenyt
   - Payout szamitas a pontozasi formula szerint
   - `token_ledger`-be jovairas (type=win)

4. **Token kiosztas** (ha uj kor kezdodik)
   - Ellenorzi hogy az aktualis kor meccseihez volt-e mar kiosztas
   - Ha nem: `token_per_round` jovairas + elozo kor atvitel
   - `token_ledger`-be bejegyzes (type=distribution / type=carryover)

### Score szamitas (rendes jatekido)
Az API valasz `periods` mezoje: `{ first: "2-1", second: "0-1", third: "1-0", overtime: "1-0" }`
Rendes jatekido: `first + second + third` → `home_score = 3, away_score = 2`

### Request budget (Jegkorong VB ~17 meccsnap)
- Meccsnap: ~96 req/nap (fixtures + odds, 15 percenkent) × 17 = ~1,632
- Nem meccsnap: ~8 req/nap × 13 = ~104
- **Osszesen: ~1,736 / 7,500** — boven belfer

### Edge case-ek
- **Meccs torles/halasztas:** `CANC`/`POST` → status=cancelled, tetek visszateritese (type=refund)
- **Meccs vege elhuzodas:** A cron nem pontoz amig a status nem `FT`/`AOT`/`AP`. Legkesobb a kovetkezo 15 perces ciklusban elkapja.
- **API kiesese:** A cron hiba eseten retry a kovetkezo ciklusban. Nem kritikus — a tippeles a meccs elott tortenik.

---

## Csoport Rendszer

### Letrehozas
- Barki letrehozhat csoportot egy aktiv/upcoming versenysorozathoz
- Megadja: nev + szabalyok (default ertekekkel elore kitoltve)
- Generalodik egy `invite_code` (6 karakter, pl. `XK4M2P`)
- Megosztható link: `/join/XK4M2P`

### Csatlakozas
- Link megnyitasa → Google login (ha meg nincs) → automatikusan csatlakozik
- A versenysorozat kozbeni csatlakozas engedelyezett (lasd Token Gazdasag / Kesoi csatlakozas)

### Csoport admin jogok
- Szabalyok modositasa (csak amig a versenysorozat nem kezdodott el)
- Tagok eltavolitasa
- Csoport torlese

### Tippelesi UX (globalis tipp + csoportonkenti tet)
1. Meccsre kattintasz → beirod a tipped (pl. 3:1) + tet az "elsodleges" csoportodban
2. Ha tobb csoportban vagy → megjelenik: "Ugyanez a tipp a tobbi csoportodban is?"
   - Csoportonkent kulon tet megadasa
   - Lehetoseg mas eredmenyt tippelni egy adott csoportban
3. Egyetlen submit — a DB-ben csoportonkent kulon `bets` sorok keletkeznek

---

## Oldalak / Route-ok

```
/                                   Landing + login
/tournaments                        Aktiv versenysorozatok
/tournaments/[slug]                 Meccsek listaja + dobogos tipp
/tournaments/[slug]/matches/[id]    Meccs reszletek + tippelesek
/groups                             Sajat csoportjaim
/groups/new                         Csoport letrehozas
/groups/[slug]                      Ranglista + csoport beallitasok
/join/[code]                        Meghivo link handler
/admin                              Admin: versenysorozat kezeles
```

---

## Projekt struktúra

```
src/
  app/
    (auth)/login/
    (main)/
      page.tsx                      Landing
      tournaments/
        page.tsx                    Versenysorozatok listaja
        [slug]/
          page.tsx                  Meccsek + dobogos tipp
          matches/[id]/page.tsx     Tippelesek
      groups/
        page.tsx                    Sajat csoportjaim
        new/page.tsx                Csoport letrehozas
        [slug]/page.tsx             Ranglista + beallitasok
      join/[code]/page.tsx          Meghivo
    admin/
      page.tsx                      Versenysorozat kezeles
    api/
      cron/sync/route.ts            Cron endpoint
  db/
    schema.ts                       Drizzle sema
    migrations/
  lib/
    api-sports.ts                   API-sports.io client
    scoring.ts                      Pontozasi logika
    tokens.ts                       Token kiosztas/egyenleg
  components/
    match-card.tsx
    bet-form.tsx
    leaderboard.tsx
    podium-picker.tsx
    ...
```

---

## Infrastruktura setup

1. **GitHub repo:** `github.com/kratam/tipper` — letrehozas `gh repo create`-tel
2. **Vercel projekt:** Szemelyes account-on (NEM GuestGuru team), deploy on push (main branch)
3. **Neon DB:** Mar letezik (`patient-leaf-69938778`), Neon Auth konfiguralt
4. **Env vars (Vercel):**
   - `DATABASE_URL` — Neon connection string
   - `API_SPORTS_KEY` — api-sports.io kulcs
   - Neon Auth config

---

## i18n (Nemzetkoziesites)

- **Konyvtar:** next-intl (Next.js 16 App Router-rel kompatibilis)
- **Nyelvek:** Magyar (hu) — alapertelmezett, Angol (en)
- **Strategia:**
  - Minden UI szoveg forditas fajlokbol jon (`messages/hu.json`, `messages/en.json`)
  - Nincs hardcoded szoveg a komponensekben
  - Nyelv valtas: URL prefix (`/hu/...`, `/en/...`) — jobb SEO-hoz es megoszthatosaghoz
  - Csapat nevek, versenysorozat nevek nem forditandok (API-bol jonnek)
  - Admin feluleten is forditas (nem csak user-facing)

---

## Ami NINCS benne az MVP-ben (kesobbi fejlesztes)

- Real-time eredmenyfrissites (WebSocket/SSE)
- Push notification tipp hatarido elott
- Foci VB (masodik versenysorozat)
- UI helper: "oszd el a tokeneimet egyenloen"
- Tobb bookmaker odds osszehasonlitas
- Jatekos statisztikak / tortenet
- Mobil app
