/**
 * Névből determinisztikusan választott avatar-szín index.
 *
 * Ugyanaz a (megjelenített) név mindig ugyanazt a színt kapja, így a monogram-
 * fallback stabil és felismerhető. A visszaadott index a `globals.css @theme`-ben
 * definiált avatar-paletta (`--color-avatar-1 .. --color-avatar-N`) egy elemére
 * mutat; a komponens ezt a statikus `bg-avatar-*` utility-listával köti be.
 */
export const AVATAR_COLOR_COUNT = 8;

export function avatarColorIndex(name: string): number {
  // djb2 string hash — egyszerű, jó eloszlású, ékezet-stabil (kódpontokból számol).
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  // >>> 0: unsigned 32-bit, hogy a modulo mindig nemnegatív legyen (üres névnél is).
  return (hash >>> 0) % AVATAR_COLOR_COUNT;
}
