// A `country-flag-icons` csomag 3x2 SVG-zászlóit bemásolja a `public/flags/3x2`
// mappába, kisbetűs fájlnévvel (a Vercel/Linux fájlrendszer case-sensitive).
//
// A zászlókat SAME-ORIGIN statikus assetként szolgáljuk ki, nem harmadik-fél
// CDN-ről (flagcdn) — így nincs rate-limit / negatív cache, a zászló nem tud
// „üres dobozként" beragadni. A kimenet be van commitolva, ezért ez a szkript
// csak akkor kell, ha a csomag frissül vagy új zászló jön be:
//
//   npm run flags:copy
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "node_modules/country-flag-icons/3x2";
const DEST = "public/flags/3x2";

mkdirSync(DEST, { recursive: true });

let count = 0;
for (const file of readdirSync(SRC)) {
  if (!file.endsWith(".svg")) continue;
  cpSync(join(SRC, file), join(DEST, file.toLowerCase()));
  count++;
}

console.log(`Copied ${count} flag SVGs → ${DEST}`);
