import Image from "next/image";

const OPTIMIZED_HOSTNAMES = ["media.api-sports.io"];

function isOptimized(url: string): boolean {
  try {
    return OPTIMIZED_HOSTNAMES.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

interface TournamentLogoProps {
  src: string;
  alt: string;
  size: number;
}

export function TournamentLogo({ src, alt, size }: TournamentLogoProps) {
  if (isOptimized(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}
