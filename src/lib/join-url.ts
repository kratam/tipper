import { routing } from "@/i18n/routing";

/**
 * Locale-helyes útvonal: a default locale (hu) prefix nélküli, a többi prefixelt —
 * megegyezik a next-intl `as-needed` viselkedésével.
 */
export function localizePath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

/**
 * A `/join/[code]` oldal locale-helyes útvonala, amit OAuth `callbackURL`-ként
 * adunk át: így a Google login után a böngésző visszatér ide.
 */
export function buildJoinCallbackUrl(locale: string, code: string): string {
  return localizePath(locale, `/join/${code}`);
}
