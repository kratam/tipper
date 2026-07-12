"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  name: string;
  logoUrl: string | null;
  /** A jelvény mérete pixelben (szélesség = magasság). */
  size?: number;
  /** Vizuális alak: négyzetes (lekerekített sarok) vagy kör. */
  shape?: "square" | "round";
  /** Extra osztályok (pl. fehér háttér, árnyék) — felülírja az alapokat. */
  className?: string;
}

/**
 * Igaz a flagcdn keret nélküli zászlóira. Az api-sports media képeibe már be van
 * égetve egy border, azoknál a ring dupla keretet okozna.
 */
export function isPlainFlag(url: string): boolean {
  return url.includes("flagcdn.com");
}

/**
 * Csapat-zászló / logó egységes megjelenítése.
 *
 * A flagcdn zászlók keret nélküliek, ezért egy vékony `ring`-et kapnak, hogy a
 * fehér mezős zászlók (pl. Dél-Korea, Csehország, Japán) ne olvadjanak bele a
 * fehér kártyaháttérbe. Az api-sports media logókban már van border → nincs ring.
 * Logó híján 3 betűs monogram fallback, a szövegméret a mérettel skálázódik.
 */
export function TeamLogo({ name, logoUrl, size = 28, shape = "square", className }: TeamLogoProps) {
  const rounding = shape === "round" ? "rounded-full" : "rounded-[3px]";
  // A zászló/logó egy külső CDN-ről (flagcdn / api-sports) töltődik; ha a kérés
  // elhasal (hálózati hiba, rate-limit, negatív cache), `onError`-rel a monogram
  // fallbackre esünk vissza az iOS Safarin megmaradó üres doboz helyett.
  const [failed, setFailed] = useState(false);
  // Új URL (pl. újrarenderelt sor) esetén adjunk friss esélyt a betöltésnek.
  // biome-ignore lint/correctness/useExhaustiveDependencies: szándékosan a logoUrl váltásra resetelünk
  useEffect(() => setFailed(false), [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn(
          rounding,
          "object-contain",
          isPlainFlag(logoUrl) && "ring-1 ring-border",
          className,
        )}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
      className={cn(
        rounding,
        "flex items-center justify-center bg-muted font-bold font-mono leading-none",
        className,
      )}
    >
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}
