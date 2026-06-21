# Vercel Preview environment rendberakása — spec

**Dátum:** 2026-06-21
**Állapot:** ✅ **VÉGREHAJTVA, MŰKÖDIK (2026-06-21)** — Neon–Vercel integrációval; smoke-teszt zöld (lásd 8. szakasz)
**Cél:** A Vercel **Preview** deployok legyenek teljes értékűek — build **és** futásidő (DB, Neon Auth login, API-szinkron) —, hogy a feature-branchek **valódi Vercel-previewn** review-zhatók legyenek (ne csak a lokál `beam` dev szerveren).

> **Olvasónak (új session):** ez a spec önálló. A projekt: GuestGuru / `tipper`
> (`projectId=prj_YVIBC9M8tJlxXuUWEF0VheSBCRQp`, `teamId=team_e97QxnY3lfBjcXk65qUnVahm`).
> A repo: `~/dev/tipper`, Neon projekt `patient-leaf-69938778` (branchek: `production`, `dev`).
> A Vercel CLI `kratam`-ként be van jelentkezve; a projekt linkelve (`.vercel/`, gitignore-olt).

## 1. Háttér — miért nem működött eddig a preview

A `main`→production deployok mennek, mert ott minden env-változó megvan. A **Preview**
environmentben viszont eddig **csak `QSTASH_TOKEN`** volt beállítva, így minden
branch/preview build elhasalt:

```
Collecting page data ...
Error: DATABASE_URL is not set
  at .next/server/app/api/cron/match-finish/route.js
```

(A `db/index.ts` modul-szinten olvassa a `DATABASE_URL`-t; a cron-route modul-kiértékelése
a „collecting page data" fázisban fut → ha nincs env, a build bukik.)

## 2. Mi készült el már (2026-06-21 session)

A **Preview** environmentbe (minden preview branchre, `gitBranch: null`, titkosítva)
felkerült — a Vercel REST API-val, a CLI auth-tokenjével (a `vercel env add` agent-módban
beragad a git-branch disambiguationbe, ezért REST API):

| Env | Érték forrása | Megjegyzés |
|---|---|---|
| `DATABASE_URL` | `.env.local` (Neon **`dev`** branch) | **lásd 3.a — eldöntendő, jó-e a dev branch** |
| `API_SPORTS_KEY`, `ODDS_API_KEY` | `.env.local` | API kulcsok (prod-dal azonos) |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | `.env.local` | auth init |
| `CRON_SECRET` | `.env.local` | cron endpoint védelem |
| `QSTASH_TOKEN` | (már korábban) | |

**Szándékosan NEM került fel:**
- `NEXT_PUBLIC_APP_URL` — a `getCallbackBaseUrl` (`src/lib/qstash.ts`) ezt használja először a **QStash** self-reschedule callback bázisaként; preview-n a kódnak a per-deploy `VERCEL_URL`-re kell esnie, statikus érték a QStash-callbacket rossz helyre vinné. (Az OAuth-redirectre nincs hatása — az origin-relatív, lásd 3.b.)
- `PROD_DATABASE_URL` — lokál script-segéd (prod DB), futásidőbe soha.

→ Ennyitől a **build már átmegy** previewn. A login/auth és a stabil callback viszont
még rendezésre vár (lásd lent).

## 3. Hátralévő munka / döntések

### 3.a — DB branch stratégia a previewhez  *(döntés kell)*

Most a preview a Neon **`dev`** branchre mutat. A `dev` viszont **megosztott** (lokál dev +
minden preview ugyanazt írja), így egy preview írásai (tippek, token-ledger, cron-scoring)
**elronthatják a `dev` adatait**.

Opciók:
1. **Marad a `dev` branch** — legegyszerűbb, de megosztott; preview-írások szennyezik a devet.
2. **Dedikált statikus `preview` Neon branch** — `dev`-ből (vagy prodból) leágaztatva, csak previewnek. Egyszeri setup, izolált. A `DATABASE_URL` **és** a `NEON_AUTH_BASE_URL` Preview-értékét is erre a branchre kell állítani (utóbbi a branch saját `…neonauth…` base_url-je — lásd a lenti branch-függőség dobozt).
3. **Neon–Vercel natív integráció (per-deploy ephemeral branch)** — a Neon Vercel-integrációja minden preview deployhoz **automatikusan** branchet készít (és törli). Teljes izoláció, prod-másolat adattal. Ez a „rendes" megoldás. Cserébe: az integrációt be kell kötni (Neon → Vercel integration), és az átveszi a `DATABASE_URL` injektálását preview-ra (a most kézzel beállított `DATABASE_URL`-t Preview-ról törölni kell, hogy ne ütközzön). **Figyelem:** mivel a `NEON_AUTH_BASE_URL` is branch-függő (lásd lenti doboz), ellenőrizni kell, hogy az integráció az **auth base_url-t is** branchenként injektálja-e; ha nem, az ephemeral-branch auth nem fog működni (a fix prod/dev auth-endpointra esne vissza), és a `users_sync` is a rossz branchbe menne.

**Ajánlás:** 3. (Neon–Vercel integráció), ha elérhető a csomagban; különben 2. (dedikált
`preview` branch).

> **`NEON_AUTH_BASE_URL` — branch-függő (verifikálva, 2026-06-21, `get_neon_auth_config`):**
> minden Neon branchnek **saját** Neon Auth base_url-je van, külön `…neonauth…` endpointon:
> - production: `https://ep-ancient-term-ag189o58.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth`
> - dev: `https://ep-solitary-scene-agyxyh3j.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth`
>
> A dev auth-endpoint ID-ja (`ep-solitary-scene-agyxyh3j`) **megegyezik a dev DB compute-endpoint
> ID-jával** → az auth a branch compute-endpointjához kötött. Tehát az **eredeti terv helyes**:
> dedikált `preview` branchnél a `NEON_AUTH_BASE_URL`-t **is** a preview branch saját `…neonauth…`
> base_url-jére kell állítani (a `get_neon_auth_config` adja branchenként). Marad-`dev` esetén a
> jelenlegi (dev) érték jó. Per-deploy ephemeral branchnél lásd a 3. opciót — az integrációnak az
> auth base_url-t is injektálnia kell.

### 3.b — OAuth redirect / Neon Auth a previewn  *(a kérés magja)*

A Neon Auth (**Better Auth** alapú — `auth_provider: better_auth`, verifikálva) Google-loginja a
böngésző **originjét** köti a **trusted origins** listához (a sikeres OAuth utáni
visszairányításnál). A preview URL-ek:
- **deployment-specifikus:** `tipper-<hash>-guestguru.vercel.app` — deployonként változik (ezt adja a `VERCEL_URL`);
- **branch-alias (stabil):** `tipper-git-<branch>-guestguru.vercel.app` — branchenként fix.

Probléma: a preview-originek deployonként (hash) és branchenként változnak, és **egyik sincs a
trusted origins listán** → egyesével nem fenntartható whitelistelni. (Ez **origin**-kérdés, nem a
callback-bázisé — a `callbackURL` amúgy is relatív, lásd lent.)

**Megoldás (a user által említett új Neon-feature):** a Neon Auth **trusted origins** listájához
**wildcard** preview-origin felvétele. A jelenlegi lista (verifikálva, `get_neon_auth_config`,
2026-06-21 — mindkét fő branchen azonos):
```
http://localhost:3000
https://tippcasino.vercel.app
https://www.tippcasino.hu
```
— nincs benne preview-origin, **ezért akad el most a preview-login**.

**Wildcard formátum — TESZTELVE (2026-06-21, `configure_neon_auth` a dev branchen):**
A partial-segment wildcard **NEM járható** a Neon Auth-on át. A
`https://tipper-git-*-guestguru.vercel.app` beírása **elbukik** a Neon validációján:
```
[body.domain] Wildcard (*) must be the leftmost subdomain label  — VALIDATION_ERROR / 400
```
A `*` tehát **csak a teljes legbaloldalibb subdomain-label** lehet (`*.domain.com`); labelen belül
(`tipper-git-*-…` vagy `*-guestguru.…`) nem. (A **Better Auth core** maga tudná a partial-
segmentet — a hivatalos demo `better-auth-demo-*-better-auth.vercel.app`-ot használ —, de a **Neon
beviteli validációja szigorúbb** és nem engedi át.) A teszt a dev configot nem szennyezte (a 400 a
validációs fázisban állt meg; visszaolvasva a 3 eredeti origin maradt).

**Következmény — a default Vercel-preview URL-re (`tipper-…-guestguru.vercel.app`) szűk wildcard
nem rakható.** A három járható út, preferencia szerint:
1. **Neon–Vercel integráció (3.a/3., elsődleges)** — per-deploy izolált auth-endpoint, és a Neon
   **automatikusan beállítja a trusted origineket** minden previewhez. A wildcard kérdés így
   **eltűnik**, nincs kézi domain-karbantartás. A teszteredmény után ez a fő ajánlás.
2. **Stabil preview alias subdomain** — ha a Vercelen beállítunk egy preview-domaint, ahol a
   preview-k **subdomain-szinten** kapnak nevet (`<branch>.preview.tippcasino.hu`-szerű), arra a
   `https://*.preview.tippcasino.hu` **tiszta leftmost-label wildcard átmegy** a Neon validáción.
   (A pontos Vercel-alias formátumot a preview-domain konfignál verifikálni kell.)
3. **Per-branch pontos origin (manuális, ad-hoc review-hoz)** — wildcard helyett a konkrét
   `https://tipper-git-<branch>-guestguru.vercel.app`-ot felvenni `add_trusted_origin`-nal minden
   review-zott branchhez. Nincs wildcard → biztosan átmegy; cserébe branchenkénti kézi lépés.

**Tilos:** `https://*.vercel.app` (ez átmenne a validáción, mert leftmost-label wildcard, de
**bármely idegen Vercel-deployt** trusted originná tenne — biztonsági kockázat).

**Az OAuth-redirecthez NEM kell kódmódosítás** (verifikálva, 2026-06-21):
- A login `callbackURL`-je már **origin-relatív**: `buildJoinCallbackUrl` (`src/lib/join-url.ts`)
  relatív path-t ad (`/join/<code>`), a `GoogleSignInButton` ezt adja át az
  `authClient.signIn.social({ callbackURL })`-nek, az `authClient = createAuthClient()`
  (`src/lib/auth/client.ts`) pedig baseURL nélkül fut → minden az aktuális origin-hez kötődik.
  Nincs hardcode-olt bázis, amit „konzisztenssé" kéne tenni.
- A `getCallbackBaseUrl` (`src/lib/qstash.ts`) **kizárólag a QStash** self-reschedule
  callback-bázisa (egyetlen hívója maga a `qstash.ts`); **semmilyen auth/OAuth kód nem
  használja**. A `VERCEL_BRANCH_URL`-re állítgatása az OAuth-redirecten **nem változtat**.
- Az OAuth-redirect engedélyezése tehát **tisztán a Neon Auth (Better Auth) oldali wildcard
  trusted origin** kérdése (lásd fent) — kódhoz nem kell nyúlni.

*(Az OAuth-tól független, külön megfontolás: a QStash-callback `VERCEL_BRANCH_URL`-re
stabilizálása `VERCEL_URL` helyett önmagában hasznos lehet, de preview-n a cron amúgy sem fut
[3.d], úgyhogy ez nem ennek a feladatnak a tárgya.)*

### 3.c — Vercel Deployment Protection  *(ellenőrizni)*

Ha a projekten **Vercel Authentication** (deployment protection) be van kapcsolva a
preview-kra, a reviewer csak Vercel-loginnal (vagy protection-bypass linkkel) éri el a
previewt. Ellenőrizni: Vercel → Project Settings → **Deployment Protection**. Ha zavaró,
vagy kikapcsolni previewre, vagy **Protection Bypass for Automation** tokent használni
(a Claude `get_access_to_vercel_url` MCP-eszköze is ad ideiglenes share-linket).

### 3.d — Cron previewn  *(nincs teendő, csak tudni)*

A Vercel **cron**ok csak production-ön futnak; preview nem ütemez cront. A QStash-alapú
match-finish self-reschedule preview-n nem indul magától (kézzel triggerelhető). Ez rendben
van review-hoz; nem kell javítani.

## 4. Lépések (a végrehajtó sessionnek)

1. **DB branch eldöntése (3.a)** és beállítása:
   - Ha Neon–Vercel integráció: bekötni a Neon dashboardon (Integrations → Vercel), majd a Preview `DATABASE_URL`-t **törölni** (az integráció injektálja). Ellenőrizni, hogy az integráció a **`NEON_AUTH_BASE_URL`-t is** branchenként adja-e (branch-függő, 3.a); ha nem, kézzel megoldani.
   - Ha dedikált `preview` branch: `mcp__plugin_neon_neon__create_branch` (`dev`-ből), majd a Preview `DATABASE_URL` **és** `NEON_AUTH_BASE_URL` átállítása az új branch endpointjaira (az auth base_url-t a `get_neon_auth_config` adja az új branchre; REST API, lásd 2. pont mintája).
2. **Preview trusted-origin beállítása (3.b)** — a választott út szerint: integrációnál automatikus; alias-subdomainnél `*.preview.<domain>`; per-branchnél a konkrét origin `add_trusted_origin`-nal. (Partial-segment wildcard NEM megy — tesztelve 2026-06-21.)
3. **Kód az OAuth-hoz nem szükséges (3.b):** az OAuth-redirect csak a trusted origintől függ; a `getCallbackBaseUrl` / `buildJoinCallbackUrl` érintetlen marad. (Ha a QStash-callback `VERCEL_BRANCH_URL`-re állítását külön akarjuk, az önálló feature-branch + PR + teszt — de nem ennek a feladatnak a része.)
4. **Deployment Protection ellenőrzése (3.c)** és igazítása.
5. **Verifikáció (5. szakasz).**

## 5. Verifikáció (kész állapot kritériuma)

- Nyiss egy eldobható branchet (pl. `chore/preview-smoke`), push → a Vercel preview build **READY** (nem ERROR).
- A preview URL-en (`tipper-git-chore-preview-smoke-guestguru.vercel.app`) **betölt** egy DB-alapú oldal (pl. `/hu/tournaments/fifa-wc-2026`), nem 500.
- **Google-login végigmegy** a previewn (a választott trusted-origin megoldás miatt — integráció / alias-wildcard / per-branch origin, 3.b — nem dob „origin not allowed" / redirect-hibát).
- Egy csoport-oldal renderel adattal (a preview DB-branch él).
- A branchet/preview-t utána eldobni.

## 6. Nyitott kérdések (session elején tisztázni)

1. **DB branch:** Neon–Vercel integráció (per-deploy), dedikált `preview` branch, vagy marad a `dev`? (Ajánlás: integráció, ha a csomag engedi.)
2. **Neon wildcard — LEZÁRVA (tesztelve 2026-06-21):** a Neon elutasítja a partial-segment wildcardot (`*` csak leftmost subdomain-label lehet, 3.b). A default Vercel-preview URL-re szűk wildcard nem rakható → a választás: **Neon–Vercel integráció** (auto, ajánlott), preview alias subdomain (`*.preview.<domain>`), vagy per-branch pontos origin. A `*.vercel.app` tiltott (túl tág).
3. **Wildcard szélessége:** elég-e a szűkebb `tipper-git-*-guestguru.vercel.app` (branch-aliasokra), vagy kell a tágabb `*-guestguru.vercel.app` (deployment-hash URL-ekre is)? Kódoldali callback-átállítás nincs (3.b) — ez tisztán trusted-origin döntés.
4. **Deployment Protection:** maradjon-e (és bypass-linkkel review-zunk), vagy kikapcsoljuk previewre?

## 7. Hivatkozott kód / hely

- Env-set minta (REST API a CLI-tokennel): a 2026-06-21 session — `POST https://api.vercel.com/v10/projects/{projectId}/env?teamId={teamId}` body `{key,value,type:"encrypted",target:["preview"]}`. Auth token: `~/Library/Application Support/com.vercel.cli/auth.json` → `.token`.
- QStash callback-bázis (**NEM** OAuth): `src/lib/qstash.ts` → `getCallbackBaseUrl` (prioritás: `NEXT_PUBLIC_APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` ha prod → `VERCEL_URL` → localhost). Egyetlen hívója a `qstash.ts` maga.
- Auth init: `src/lib/auth/server.ts` (`createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL })`). OAuth-login: `authClient = createAuthClient()` baseURL nélkül (`src/lib/auth/client.ts`) → origin-relatív; a `callbackURL` relatív path (`src/lib/join-url.ts` → `buildJoinCallbackUrl`, `src/components/google-sign-in-button.tsx`). Ezért az OAuth-redirectet a trusted origin dönti el, nem kód-bázis.
- Env-ek dokumentáció: `ARCHITECTURE.md` → Env változók.

## 8. Végrehajtás eredménye — VÉGREHAJTVA, MŰKÖDIK (2026-06-21)

A **Neon–Vercel integrációval** valósult meg (3.a/3. opció). Smoke-teszt egy eldobható
`chore/preview-smoke` branchen: **build READY, DB-oldal betölt adattal, Google-login végigmegy.**

**Kulcs-tanulságok (a tervhez képest):**
- **A wildcard-dráma tárgytalan.** Az integráció **per preview deploy** automatikusan beírja a
  konkrét preview URL-eket (branch-alias + deployment-hash URL-ek) az **ephemeral branch
  Neon-Auth `trusted_origins`-ába**. Nincs szükség wildcardra (amit a Neon validáció amúgy is
  elutasított, 3.b) — sem kódmódosításra.
- **Az auth is izolált, automatikusan.** Az ephemeral branch saját Neon-Auth `base_url`-t kap
  (`…neonauth…`), és az app a **működő login** tanúsága szerint erre megy — a `NEON_AUTH_BASE_URL`
  per-branch kézi állítgatása (a 3.a régi aggálya) **nem kellett**.
- **Ephemeral branch a `production`-ből forkol** (nem a dev-ből): minden preview a **valódi
  prod-adat izolált másolatát** kapja, deployonként. `creation_source: vercel`, a git branch
  törlésére lebomlik.
- **Env-injektálás:** az integráció a Vercel `DATABASE_URL` + `DATABASE_URL_UNPOOLED`-ot kezeli
  (preview deployonként az ephemeral branchre). A korábban kézzel feltett **preview `DATABASE_URL`-t
  törölni kellett**, mert elfedte az integrációét (4.1). A többi kézi preview env
  (`NEON_AUTH_COOKIE_SECRET`, API-kulcsok, `CRON_SECRET`, `QSTASH_TOKEN`) marad — ezeket az
  integráció nem adja.
- **Prod végig sértetlen:** a production `DATABASE_URL` érintetlen maradt (production endpoint),
  a prod az integráció óta nem deployolt újra.
- **Integráció scope:** „All Projects" (team-szintű) — szándékosan így hagyva. Nincs
  kereszt-szennyezés (verifikálva: az `ainita` és a többi projekt env-je érintetlen).
- **Deployment Protection:** preview-re **kikapcsolva** — a reviewer Vercel-login nélkül eléri;
  az érzékeny adat amúgy is az app saját Google-loginja mögött van (mint a publikus prod app-ban).

**Hivatkozott objektumok (smoke):** Vercel projekt `prj_YVIBC9M8tJlxXuUWEF0VheSBCRQp`, Neon
integráció `icfg_d9nuSX9WdirWff60Ouvj4l92`, ephemeral branch `preview/chore/preview-smoke`
(eldobva a teszt után).
