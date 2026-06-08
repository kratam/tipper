# Meghívó-link megbízhatóság — Pending invite cookie + idempotens claim

**Dátum:** 2026-06-08
**Státusz:** Jóváhagyásra vár
**Érintett terület:** `/join/[code]` flow, `middleware.ts`, auth, kör/csoport tagság

## Probléma

Meghívó linket (`/join/[code]`) küldve a meghívottak **regisztrálnak** (bekerülnek a
`users` táblába, megjelennek a ranglistán), **de a tagság nem jön létre** — sem a
körben (`circleMembers`), sem a csoportban (`groupMembers`). A user bejelentkezve,
de a körön/csoporton kívül landol, és nem tudja, hogy újra kéne kattintania a linkre.

Élesben megfigyelt, valós tünet (nem hipotézis): több meghívott regisztrált, de
egyik sem került be a körbe.

## Gyökérok

A meghívó-szándék **kizárólag az OAuth `callbackURL`-ben utazik**, és a belépés egy
**GET-render mellékhatásaként** fut le:

1. `/join/[code]` → kijelentkezett usernek `JoinSignIn`, `callbackURL=/join/[code]`.
2. Google → Neon Auth (külön origin) → vissza az app origin `/join/[code]?neon_auth_session_verifier=…`-ra.
3. `middleware.ts` token-cserét csinál, session cookie-t állít, újrarendereli a join oldalt.
4. Most már van `user` → `joinGroup`/`joinCircle` a Server Component renderben fut.

Két törékenység:

- **A kód egyetlen, nem tartós helyen él (URL).** A háromugrásos OAuth round-trip
  (App → Neon Auth → Google → vissza) első belépésnél nem mindig hozza vissza a
  kódot/callbackURL-t (friss usernél consent-képernyővel hosszabb út; a
  `middleware.ts`-ben ott a `→ /__noop__` bukó ág is). Ha a callbackURL elveszik, a
  user bejelentkezve, de tagság nélkül, **néma hibával** landol.
- **A join render-mellékhatás.** Mutáció GET-renderben anti-pattern (prefetch, bot,
  speculative load újrafuttathatja), és nem garantált, hogy lefut.

A megoldásnak **mindkettőt** orvosolnia kell: a szándékot OAuth-független, tartós
helyen (cookie) őrizni, és a belépést idempotensen, nem render-mellékhatásként
elvégezni.

## Verifikált infra-tények (2026-06-08)

HTTP-próbával ellenőrizve (nem feltételezés):

- **Kanonikus domain: `www.tippcasino.hu`.** Minden más domain
  (`tippcasino.vercel.app`, apex `tippcasino.hu`) **308 path-preserving** redirecttel
  ide mutat, **edge-szinten, a middleware előtt**.
- `www.tippcasino.hu/join/X` → 307 → `/hu/join/X`, és már most is rak
  `NEXT_LOCALE=hu; Path=/; SameSite=lax` cookie-t → a middleware ezen a hoszton fut,
  a cookie-k ide tapadnak.
- A `callbackURL` relatív; a login a user aktuális origin-jén (a redirectek után =
  `www.tippcasino.hu`) indul → a session cookie és a meghívó cookie **ugyanazon a
  hoszton** köt ki. A regisztráció ténylegesen működik → az OAuth a kanonikus
  domainen zárul.

**Következmény a tervre:** a meghívó cookie-t **host-only**-ként (nincs `Domain=`
attribútum) a `www.tippcasino.hu`-ra tesszük; az edge-redirectek (amik a middleware
előtt, path-preserving módon futnak) ezt nem érintik.

## Megoldás — Pending invite cookie + idempotens claim

### 1) Cookie-kontraktus

- **Név:** `tc_pending_invite`
- **Érték:** a meghívó kód (pl. `4V8M35`) — uppercase alfanumerikus, cookie-safe.
- **Flagek:** `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`,
  `Max-Age=2592000` (30 nap). Host-only — **nincs** `Domain=` attribútum.
- Ez az **egyetlen, tartós hordozója** a meghívó-szándéknak. A `callbackURL` csak
  happy-path gyorsítás marad; a helyes működés nem függ tőle.

Az `Max-Age` egy elnevezett konstansból jön (pl.
`PENDING_INVITE_MAX_AGE_SECONDS`), hogy később hangolható legyen.

### 2) Capture — `middleware.ts`

- Minden `(/{locale})?/join/[code]` találatkor a middleware lerakja a
  `tc_pending_invite` cookie-t a kódból — **az OAuth indulása előtt**, login
  állapottól függetlenül.
- **Fontos:** a next-intl middleware a `/join/X`-et `/hu/join/X`-re irányítja (307).
  A capture-nek a **redirect-válaszra is rá kell tennie a Set-Cookie-t** (a kódot a
  request path-ból parse-oljuk, és a Set-Cookie-t a középre érkező `intlResponse`-ra
  appendeljük). A locale-prefixes és prefix nélküli útvonalat is kezelni kell.
- DB-érintés nincs (edge-barát marad).

### 3) Claim-funnel — `middleware.ts`

A belépést a claim route veszi át; a middleware csak odairányít:

- **Login után azonnal:** a verifier-ág sikeres token-csere után, ha van pending
  cookie → `/api/join/claim`-re redirect (a frissen beállított session cookie-kal
  együtt a válaszban).
- **Általános biztosíték:** bármely kérés, ahol *van session cookie ÉS van pending
  cookie* (és a path nem `/api/...` és nem maga a claim) → `/api/join/claim`-re
  redirect. Így aki „mellélandolt" (pl. `/tournaments`), azt a következő navigáció
  behúzza.
- **Loop-védelem:** az `/api/...` ki van zárva a matcherből; a claim a sikeres join
  után törli a cookie-t, így nincs visszacsatolás.

### 4) Claim végrehajtás — új `src/app/api/join/claim/route.ts`

GET route handler (a `callbackURL`/middleware redirect ide mutat):

1. `getCurrentUser()`. Ha nincs user → vissza a `/{locale}/join/[code]`-ra (a
   cookie-ból olvasott kóddal), hogy a sign-in képernyő jöjjön. (A cookie marad.)
2. A kódot feloldja: `getGroupByInviteCode` / `getCircleByInviteCode`.
3. **Idempotens belépés:**
   - sikeres `joinGroup`/`joinCircle` **vagy** „Already a member" → siker.
   - ismeretlen kód → cookie törlése + home + „nem található" üzenet (query param
     vagy flash).
   - egyéb hiba → cookie törlése + home + hibaüzenet.
4. **Törli** a `tc_pending_invite` cookie-t (`Max-Age=0`) — route handlerben ez
   megengedett.
5. Redirect a cél oldalra, locale-helyesen:
   - group → `/{locale}/tournaments/{slug}/groups/{gSlug}`
   - circle → `/{locale}/circles`
   - locale a `NEXT_LOCALE` cookie-ból; ha hiányzik, default `hu`.

A join így POST-szerű, idempotens, cookie-író kontextusban fut — **kikerül a Server
Component render-mellékhatásából.**

### 5) `/join/[code]/page.tsx` egyszerűsödik

- Bejelentkezett usert már a claim-funnel elkapja a middleware-ben → a page
  gyakorlatilag csak **kijelentkezett** esetben renderel (`JoinSignIn` preview +
  sign-in), illetve ismeretlen kódnál a „nem található" üzenetet.
- A render-beli `joinGroup`/`joinCircle` hívások **kikerülnek** (a claim route veszi
  át). A `callbackURL` maradhat happy-path gyorsításként (ettől függetlenül a cookie
  + funnel a garancia).

## Edge case-ek

- **Több join link login előtt** → utolsó nyer (cookie felülíródik). Elfogadható.
- **Login nélkül elhagyja** → cookie 30 nap múlva lejár; ha közben máskor belép,
  bekerül a körbe (ez a kívánt viselkedés: meg volt hívva). Idempotens, így ártalmatlan.
- **Bejelentkezett user kattint join linkre** → capture + azonnali funnel → claim.
- **Stale/lejárt kód a cookie-ban** → ismeretlen kód ág: cookie törlés + home.
- **Domain-redirect (vercel.app / apex → www)** → edge-szinten, path-preserving,
  middleware előtt; a cookie a kanonikus `www.tippcasino.hu`-ra kerül. Nem zavar.

## Előfeltétel (infra)

- A teljes flow a kanonikus `www.tippcasino.hu`-n záruljon (app kiszolgálás + OAuth
  visszatérés). **Verifikálva:** a regisztráció ténylegesen működik ezen a domainen,
  az edge-redirectek path-preserving 308-ak a middleware előtt. Új teendő nincs;
  ha a kanonikus domain változik, a cookie automatikusan az új hoszthoz tapad
  (host-only).

## Tesztelés

**Unit (Vitest):**
- Kód-parszolás a path-ból: `/join/X`, `/hu/join/X`, `/en/join/X`, nem-join path → null.
- Claim-funnel feltétel-mátrix: (session × pending × path) kombinációk → redirect / nincs.
- Cél-URL építés: group vs circle, locale-prefix helyesség.
- Idempotencia: „Already a member" → siker (nem hiba).
- Ismeretlen kód → home + üzenet, cookie törölve.

**Kézi / E2E (Playwright, ha van):**
- Friss Google-fiók → join link → login → cél oldalon, **tagként**.
- „Mellélandolás" szimuláció: login után `/tournaments`-re érkezés → egy navigáció
  behúzza a claim-be → tag lesz.
- Bejelentkezett user join linkre kattint → azonnal tag.

## Scope-on kívül

- A `→ /__noop__` OAuth bukás külön kivizsgálása (a cookie-megoldás ettől
  függetlenül megbízhatóvá teszi a meghívót).
- `pending_invites` DB tábla (túllövés; a cookie elég).
- A `nav.tsx` / `landing-content.tsx` általános login flow-ja (nem meghívó-specifikus).

## Érintett fájlok

- `src/middleware.ts` — capture + claim-funnel ágak.
- `src/app/api/join/claim/route.ts` — **új** claim route handler.
- `src/app/[locale]/join/[code]/page.tsx` — render-beli join eltávolítása,
  egyszerűsítés.
- `src/lib/` — új helper(ek): cookie név/TTL konstans, kód-parszolás path-ból,
  cél-URL építés (tesztelhető pure függvények).
- Tesztek a fenti helperekhez.
