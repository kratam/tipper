export const SYSTEM_USER_EMAIL = "system@tippcasino.local";

export const OFFICIAL_GROUP_NAME = "Hivatalos";
export const OFFICIAL_GROUP_SLUG = "hivatalos";

export const RESERVED_OFFICIAL_SLUGS = ["hivatalos", "official"] as const;

export function isReservedOfficialSlug(slug: string): boolean {
  return (RESERVED_OFFICIAL_SLUGS as readonly string[]).includes(slug);
}
