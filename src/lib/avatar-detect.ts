/**
 * Google-avatar valódiság-detektálás.
 *
 * A Google MINDIG ad `picture` URL-t: ha a usernek nincs feltöltött fotója, egy
 * generált monogramot (egyszínű háttér + egy betű) ad, amit URL-ből nem lehet
 * megkülönböztetni a valódi fotótól. Empirikus mérés a userbázison: a generált
 * monogramok pár tucat egyedi színt tartalmaznak (~60–110), a valódi fotók több
 * ezret (4000+). Ez a szín-szám tehát megbízható diszkriminátor.
 *
 * A tiszta rész (countUniqueColors, isLikelyRealPhoto) unit-tesztelt; a képletöltő +
 * dekódoló detectAvatarIsReal a `sharp`-ot DINAMIKUSAN importálja, hogy a natív modul
 * ne húzódjon be a tesztekbe / kliens bundle-be.
 */

/** A generált monogramok (~110) és a valódi fotók (~4600) közti tiszta szakadék közepe. */
export const REAL_PHOTO_COLOR_THRESHOLD = 1000;

/** Egyedi RGB-színek száma egy nyers pixel-bufferben (az alfa-csatornát figyelmen kívül hagyva). */
export function countUniqueColors(buffer: Buffer, channels: number): number {
  const seen = new Set<number>();
  for (let i = 0; i + 2 < buffer.length; i += channels) {
    // RGB egyetlen 24-bites egészbe pakolva (alfa kihagyva)
    seen.add((buffer[i] << 16) | (buffer[i + 1] << 8) | buffer[i + 2]);
  }
  return seen.size;
}

/** Valódi fotó-e a kép a benne lévő egyedi színek száma alapján. */
export function isLikelyRealPhoto(uniqueColors: number): boolean {
  return uniqueColors >= REAL_PHOTO_COLOR_THRESHOLD;
}

/**
 * A megjelenítendő Google-avatar URL a valódiság-flag alapján. Csak a BIZONYÍTOTTAN
 * generált (`false`) képet rejtjük el (→ Gravatar/monogram lép a helyére); a valódi
 * (`true`) és a még nem detektált (`null`) esetben konzervatívan megtartjuk a képet.
 */
export function pickGoogleAvatarUrl(
  avatarUrl: string | null,
  avatarIsReal: boolean | null,
): string | null {
  return avatarIsReal === false ? null : avatarUrl;
}

/** A Google-avatar URL-t fix 96px-es négyzetre normalizálja (konzisztens színszámhoz). */
function normalizeToS96(url: string): string {
  return `${url.replace(/=s\d+(-c)?$/, "")}=s96-c`;
}

/**
 * Letölti a Google-avatart és eldönti, valódi feltöltött fotó-e (vagy generált
 * monogram). Hiba esetén `null` (ismeretlen) — a hívó dönt, hogyan kezeli.
 */
export async function detectAvatarIsReal(avatarUrl: string): Promise<boolean | null> {
  try {
    const res = await fetch(normalizeToS96(avatarUrl), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
    return isLikelyRealPhoto(countUniqueColors(data, info.channels));
  } catch {
    return null;
  }
}
