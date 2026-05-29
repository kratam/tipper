import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import hu from "i18n-iso-countries/langs/hu.json";
import type { Locale } from "@/lib/providers/types";

countries.registerLocale(en);
countries.registerLocale(hu);

// odds-api name variants the lib does not recognize directly.
const ALIASES: Record<string, string> = {
  "korea republic": "KR",
  "korea dpr": "KP",
  usa: "US",
  "bosnia and herzegovina": "BA",
  "ivory coast": "CI",
  "cape verde": "CV",
  turkiye: "TR",
  iran: "IR",
  "ir iran": "IR",
  "congo dr": "CD",
  curacao: "CW",
};

// Non-ISO territories that flagcdn serves via subdivision codes (UK home nations).
// i18n-iso-countries has no alpha-2 for these, so name + flag are mapped manually.
const REGIONS: Record<string, { flagCode: string; names: Record<Locale, string> }> = {
  scotland: { flagCode: "gb-sct", names: { hu: "Skócia", en: "Scotland" } },
  england: { flagCode: "gb-eng", names: { hu: "Anglia", en: "England" } },
  wales: { flagCode: "gb-wls", names: { hu: "Wales", en: "Wales" } },
  "northern ireland": {
    flagCode: "gb-nir",
    names: { hu: "Észak-Írország", en: "Northern Ireland" },
  },
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
  if (!name) return null;
  const region = REGIONS[name.trim().toLowerCase()];
  if (region) {
    return {
      name: region.names[locale] ?? name,
      flagUrl: `https://flagcdn.com/w80/${region.flagCode}.png`,
    };
  }
  const code = countryCodeFromName(name);
  if (!code) return null;
  const localized = countries.getName(code, locale) ?? name ?? code;
  return { name: localized, flagUrl: `https://flagcdn.com/w80/${code.toLowerCase()}.png` };
}
