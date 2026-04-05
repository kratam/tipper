Szeretnék egy olyan tippjátékot csinálni, ahol különböző versenysorozatokra, például a Jégkorong VB vagy a Foci VB mérkőzéseire lehet fogadni. A játékosok csoportokba csatlakozhatnak. A játékos eldöntheti, hogy egy tippet használ minden csoportban, vagy csoportonként különböző tippet ad.

Különbség a hasonló játékokhoz képest:
- mindenki kap adott mennyiségű tokent, amit feltehet a különböző meccsekre (1 meccsre csak 1 fogadást lehet tenni)
- ha a tippje (vagy annak egy része - lásd majd a szabályokat) helyes, visszanyer valamennyi tokent
- a tokeneket nem a játék legelején kapja mindenki, hanem fokozatosan, így nem lehet "kiesni" a játékból

## Szabályok

Nézd meg a docs/assets/tippverseny.xlsx -et, de nagyjából:

- Lehet tippelni végső arany/ezüst/bronzra. Minden említett dobogósért jár token, a pontos helyezés eltalálásáért extra. Ezek a tippek nem kerülnek tokenbe
- Meccsenként a rendes játékidő eredményére lehet tippelni, pl 2:3 vagy 4:4. Ha hosszabbítás van, akkor is 4:4 a "végső" eredmény amivel számolunk
- A feltett token szerint kapsz vissza tokent, ha eltaláltad, hogy 1-2-X, de számít az odds, azaz ha megtippelted hogy az esélyes legyőzi az esélytelent, az kevesebb nyeremény, mint fordítva.
- Jár extra token ha eltaláltad a gólkülönbséget
- Jár extra token, ha eltaláltad a pontos eredményt
- Az oddsokat naponta (esetleg 3-4 óránként) kérdezzük le. A tipped az akkor aktuális odds alapján kerül elszámolásra akkor is, ha utána változik az odds.
- Tippeket a játék kezdetéig lehet leadni és változtatni

Azt még nem tudom, mi lesz azokkal a tokenekkel, amiket nem tettél fel semmire.

## Tech stack:
nextjs, neon db, biome, typscript, shadcn ui, radix. Neon auth google loginnel. Mindenből a @latest-et használd.
Neon db-t hozz létre a neon mcp-vel.

---

## Kérdések (Claude)

### 1. Token gazdaság
Az xlsx-ben úgy tűnik, mindenki 1 tokent tesz meccsenként (nincs változó tét). Az OTLET.md viszont azt mondja, hogy "mindenki kap adott mennyiségű tokent, amit feltehet a különböző meccsekre". Ez azt jelenti, hogy:
- a) Változó tétet lehet tenni meccsenként (pl. 1-5 token)?
- b) Ha igen, mennyi a kezdő token szám, és milyen ütemben kap újakat a játékos?
- **Javaslatom:** a) opció izgalmasabbá teszi a játékot — stratégiai elem, hogy mire mennyi tokent raksz. Pl. minden "kör" (3-4 meccs) elején kap mindenki X tokent, és ezeket osztja szét az adott kör meccseire.

Igen, ez a tokenelés új elem és én is azt gondoltam, hogy adott időszakonként (meccsnapok vagy ha ez értelmezhető akkor fordulónként) lenne token osztás.

### 2. Pontozás bónuszok
Az xlsx-ben a gólkülönbség és pontos eredmény bónusz fix +1, függetlenül a téttől. Az új rendszerben is így maradna, vagy a téttel arányos legyen?
- a) Fix +1 és +1 (egyszerűbb, a tét csak az 1X2-re vonatkozik)
- b) Tét × szorzó (pl. tét × 0.5 gólkülönbségre, tét × 1 pontos eredményre)
- **Javaslatom:** a) — a fix bónusz jutalmazza a tippelési tudást függetlenül a kockázatvállalástól, és egyszerűbb is.

Ok, de majd a fix tokenszámot lehet igazítani kell a kiosztott tokenek számához (pl ha 100 tokent osztunk ki naponta akkor 1 token a pontos eredmény eltalálásáért nem sok)

### 3. Fel nem használt tokenek
Te is írtad, hogy még nem tudod. Opciók:
- a) Elvesznek (use it or lose it) → ösztönöz arra, hogy mindent feltegyél
- b) Átviheted a következő körre → halmozási stratégia
- c) A végén hozzáadódnak a pontszámhoz → a konzervatív stratégia is opció
- **Javaslatom:** a) — egyszerű, és arra ösztönöz, hogy mindenki aktívan játsszon.

Esetleg a fel nem használt tokenek fele vihető tovább => ha nem játszottál nem kerülsz hatalmas hátrányba.

### 4. Admin / versenysorozat kezelés
Ki hozza létre a versenysorozatokat és meccseket?
- a) Egy dedikált admin felület, ahol manuálisan viszed fel
- b) Félig automatikus: API-ból jönnek a meccsek, admin csak jóváhagyja
- c) Teljesen automatikus: API-ból a menetrend és az eredmények is
- **Javaslatom:** MVP-re a) — admin viszi fel a meccseket, eredményeket. Később lehet API integrációval bővíteni. Az oddsokat viszont érdemes API-ból húzni (lásd 5. kérdés).

Első körben 1 versenysorozat lesz csak: Jégkorong VB. Csak admin adhat hozzá új sorozatokat, a második sorozat a foci vb lesz. A meccseket API-ból szedjük: https://api-sports.io/documentation/hockey/v1
Az api kulcs a .env.local -ba be van írva.

### 5. Odds forrás
Az xlsx sportingbet.com-os oddsokat mutat. Az oddsokat:
- a) Kézzel viszi be valaki
- b) API-ból húzzuk automatikusan (pl. The Odds API - ingyenes tier 500 request/hó)
- c) Scraping sportingbet-ről
- **Javaslatom:** b) — The Odds API-nak van ingyenes tier-je, és tiszta, legális megoldás. Ha nem elég az ingyenes kvóta, napi 1 lekérdezés meccsenként bőven belefér. Az MVP-ben esetleg a)-val indulunk, de az API integráció nem nagy munka.

Lásd az előző pontot - ha jól tudom ez oddsokat is visszaad, de majd le kell ellenőrizni.

### 6. Csoportok és tippek
"A játékos eldöntheti, hogy egy tippet használ minden csoportban, vagy csoportonként különböző tippet ad." Ez pontosan mit jelent?
- a) Ugyanaz a predikció (pl. 3:2), de külön tét összeg csoportonként
- b) Teljesen különböző predikció ÉS tét csoportonként
- c) A predikció ugyanaz, de a tét automatikusan 1 minden csoportban
- **Javaslatom:** b) — teljes szabadság, de az alapértelmezett legyen az, hogy "ugyanazt használom mindenhol", és manuálisan lehessen felülírni egy adott csoportban.

Elfogadom.

### 7. Dobogós tippek időzítése
A dobogós tippeket (arany/ezüst/bronz):
- a) A versenysorozat elején kell leadni és utána nem változtatható
- b) Bármikor változtatható a versenysorozat befejezéséig
- c) A versenysorozat elején + a playoff/kieséses szakasz előtt módosítható
- **Javaslatom:** a) — ez adja a kihívást, és egyszerűbb is implementálni.

Elfogadom.

### 8. Csoportok kezelése
Hogyan jönnek létre a csoportok és hogyan csatlakoznak a játékosok?
- a) Bárki létrehozhat csoportot, és meghívó link/kóddal lehet csatlakozni
- b) Csak admin hozhat létre csoportot, játékosokat manuálisan adja hozzá
- c) Nyílt csoportok (bárki csatlakozhat) + privát csoportok (meghívóval)
- **Javaslatom:** a) — egyszerű, közösségi, és nem igényel admin beavatkozást. A csoport létrehozója legyen a csoport adminja (kickelhet, törölhet).

Ok.

### 9. Meccsenkénti tét limit
Van-e felső korlát arra, hogy egy meccsre mennyi tokent tehetsz?
- a) Nincs limit — az összes tokenodet felteheted egy meccsre
- b) Max X% az adott kör tokenjeiből (pl. max 50%)
- c) Fix maximum (pl. max 5 token meccsenként)
- **Javaslatom:** a) — a teljes szabadság a legizgalmasabb, és a kockázatkezelés a játékos felelőssége. Az "all-in" legyen opció.

Ok.