/**
 * Google-avatar valódiság-detektálás.
 *
 * A Google MINDIG ad `picture` URL-t: ha a usernek nincs feltöltött képe, egy generált
 * betű-monogramot ad (egyszínű háttér + egy betű), amit URL-ből nem lehet megkülönböztetni
 * a feltöltött képtől.
 *
 * A megbízható jel a DOMINÁNS-SZÍN ARÁNY: a generált monogramnak egyetlen telített
 * háttérszíne a kép túlnyomó részét (>85%) kitölti; a feltöltött képeknek — legyen az
 * fénykép, fekete-fehér portré vagy rajz — nincs ilyen domináns egyszínű háttere.
 * (A korábbi egyedi-szín-SZÁM heurisztika elbukott: a fekete-fehér fotók és a vektoros
 * rajzok is kevés színűek, mint a monogramok.)
 *
 * A tiszta rész unit-tesztelt; a képletöltő + dekódoló `detectAvatarIsReal` a `sharp`-ot
 * DINAMIKUSAN importálja, hogy a natív modul ne kerüljön a tesztekbe / kliens bundle-be.
 */

/**
 * E fölött a kép egyszínű-hátterű generált monogram. Prod-mérés: a monogramok domináns
 * aránya 89–97%, a feltöltött képeké ≤77% — a 0.86 a köztes rés biztonságos közepe,
 * kissé a feltöltött képek felé húzva (a téves „monogram" rosszabb, mint egy megmaradt
 * generált avatar).
 */
export const MONOGRAM_DOMINANT_THRESHOLD = 0.86;

/**
 * A leggyakoribb (4 bit/csatornára kvantált) szín aránya a képen. A kvantálás az
 * anti-alias árnyalatokat egy vödörbe vonja, így a monogram egyszínű háttere egyetlen
 * domináns vödörként jelenik meg.
 */
export function dominantColorRatio(buffer: Buffer, channels: number): number {
  const hist = new Map<number, number>();
  let total = 0;
  for (let i = 0; i + 2 < buffer.length; i += channels) {
    const q = ((buffer[i] >> 4) << 8) | ((buffer[i + 1] >> 4) << 4) | (buffer[i + 2] >> 4);
    hist.set(q, (hist.get(q) ?? 0) + 1);
    total++;
  }
  if (total === 0) return 0;
  let max = 0;
  for (const count of hist.values()) if (count > max) max = count;
  return max / total;
}

/** Generált (egyszínű-hátterű) monogram-e a kép a domináns-szín arány alapján. */
export function isGeneratedMonogram(dominantRatio: number): boolean {
  return dominantRatio > MONOGRAM_DOMINANT_THRESHOLD;
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

/** A Google-avatar URL-t fix 64px-es négyzetre normalizálja (konzisztens méréshez). */
function normalizeToS64(url: string): string {
  return `${url.replace(/=s\d+(-c)?$/, "")}=s64-c`;
}

/**
 * Letölti a Google-avatart és eldönti, valódi feltöltött kép-e (vagy generált monogram).
 * Hiba esetén `null` (ismeretlen) — a hívó dönt, hogyan kezeli.
 */
export async function detectAvatarIsReal(avatarUrl: string): Promise<boolean | null> {
  try {
    const res = await fetch(normalizeToS64(avatarUrl), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
    return !isGeneratedMonogram(dominantColorRatio(data, info.channels));
  } catch {
    return null;
  }
}
