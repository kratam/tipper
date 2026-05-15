import Image from "next/image";
import { cn } from "@/lib/utils";

interface TokenIconProps {
  size?: number;
  className?: string;
}

export function TokenIcon({ size = 12, className }: TokenIconProps) {
  return (
    <Image
      src="/tippcasino-logo.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("inline-block shrink-0 align-[-0.125em]", className)}
    />
  );
}
