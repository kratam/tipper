"use client";

import type * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColorIndex } from "@/lib/avatar-color";
import { gravatarUrl } from "@/lib/gravatar";
import { getInitials } from "@/lib/initials";
import { cn } from "@/lib/utils";

/**
 * Statikus lista, hogy a Tailwind purge lássa az osztályokat (nincs dinamikus
 * `bg-avatar-${n}`). Az index a globals.css `--color-avatar-1..8` palettájára mutat.
 */
const AVATAR_BG = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
  "bg-avatar-8",
] as const;

type UserAvatarProps = {
  /** Megjelenített név (COALESCE(displayName, name)) — ebből jön a monogram és a szín. */
  name: string;
  /** Google-profilkép URL-je, ha van (a lánc első szintje). */
  googleAvatarUrl?: string | null;
  /** Szerver oldalon számolt Gravatar SHA-256 hash (a lánc második szintje). */
  gravatarHash?: string | null;
  /** A letöltendő Gravatar-kép mérete px-ben (retinához bőven elég 64). */
  sizePx?: number;
  /** Az Avatar méret-osztálya (pl. "size-7"). */
  className?: string;
  /** A monogram-fallback extra osztályai (pl. "text-xs", "font-mono"). */
  fallbackClassName?: string;
  alt?: string;
  loading?: "eager" | "lazy";
  size?: React.ComponentProps<typeof Avatar>["size"];
};

/**
 * Egységes avatar háromszintű fallback-lánccal:
 * Google-kép → Gravatar (d=404) → névből generált színes monogram.
 *
 * A `src`-be a Google-URL, annak hiányában a Gravatar-URL kerül; ha a választott kép
 * 404-et ad vagy nem tölt be, a Radix `AvatarFallback` lép be a determinisztikus színű
 * monogrammal. Kép nélküli usernél (se Google, se Gravatar-hash) rögtön a monogram jön.
 */
export function UserAvatar({
  name,
  googleAvatarUrl,
  gravatarHash,
  sizePx = 64,
  className,
  fallbackClassName,
  alt,
  loading,
  size,
}: UserAvatarProps) {
  const src =
    googleAvatarUrl ?? (gravatarHash ? gravatarUrl(gravatarHash, { size: sizePx }) : undefined);
  const bgClass = AVATAR_BG[avatarColorIndex(name)];

  return (
    <Avatar className={className} size={size}>
      {src ? <AvatarImage src={src} alt={alt ?? name} loading={loading} /> : null}
      {/* Ha van kép, a monogram renderelését késleltetjük, hogy a (jellemzően gyors /
          cache-elt) kép betöltése előtt NE villanjon fel a színes fallback. Kép nélkül
          a monogram az elsődleges tartalom → azonnal (delay nélkül) jelenjen meg. */}
      <AvatarFallback
        delayMs={src ? 600 : undefined}
        className={cn(bgClass, "text-white", fallbackClassName)}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
