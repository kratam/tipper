/**
 * Gravatar avatar-URL építése egy előre kiszámolt email-hash-ből — TISZTA, KLIENS-SAFE.
 *
 * Nem importál `node:crypto`-t (a hash-t a szerver oldali `gravatar-hash.ts` számolja),
 * így a `UserAvatar` kliens-komponens gond nélkül behúzhatja. A `d=404` a kulcs: ha az
 * emailhez nincs Gravatar-kép, a szolgáltatás 404-et ad (nem generikus szürke sziluettet),
 * amit a komponens `onError`-je elkap, és a lánc a névből generált monogramra esik.
 */
export function gravatarUrl(hash: string, { size }: { size: number }): string {
  const params = new URLSearchParams({ d: "404", s: String(size) });
  return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
}
