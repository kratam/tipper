import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import hu from "i18n-iso-countries/langs/hu.json";
import type { Locale } from "@/lib/providers/types";

countries.registerLocale(en);
countries.registerLocale(hu);

// odds-api World Cup name variants the lib does not recognize directly.
const ALIASES: Record<string, string> = {
  "korea republic": "KR",
  "korea dpr": "KP",
  usa: "US",
  "bosnia and herzegovina": "BA",
  "ivory coast": "CI",
  "cape verde": "CV",
};

export function countryCodeFromName(name: string | null): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return countries.getAlpha2Code(name, "en") ?? countries.getAlpha2Code(name, "hu") ?? null;
}

export function resolveCountryDisplay(
  name: string | null,
  locale: Locale,
): { name: string; flagUrl: string } | null {
  const code = countryCodeFromName(name);
  if (!code) return null;
  const localized = countries.getName(code, locale) ?? name ?? code;
  return { name: localized, flagUrl: `https://flagcdn.com/w80/${code.toLowerCase()}.png` };
}
