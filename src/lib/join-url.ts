import { routing } from "@/i18n/routing";

/**
 * A `/join/[code]` oldal locale-helyes útvonala, amit OAuth `callbackURL`-ként
 * adunk át: így a Google login után a böngésző visszatér ide, és a meghívó kód
 * nem vész el. A default locale (hu) prefix nélküli, a többi prefixelt — ez
 * megegyezik a next-intl `as-needed` viselkedésével.
 */
export function buildJoinCallbackUrl(locale: string, code: string): string {
  const path = `/join/${code}`;
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}
