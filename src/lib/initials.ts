/**
 * Avatar-fallback kezdőbetűk a MEGJELENÍTETT névből (display name).
 * Szó-kezdőbetűkből áll, legfeljebb kettő, nagybetűsen — így az avatar mindig
 * összhangban van a mellette megjelenő névvel (nem karakter-prefix, nem az
 * eredeti Google-név).
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
