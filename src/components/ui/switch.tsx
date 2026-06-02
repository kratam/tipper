"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-border outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-6 data-[size=sm]:h-[18px] data-[size=default]:w-[42px] data-[size=sm]:w-[30px] data-disabled:cursor-not-allowed data-checked:border-transparent data-checked:bg-linear-to-b data-unchecked:bg-surface-3 data-checked:from-gold data-checked:to-gold-2 data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] ring-0 transition-transform group-data-[size=default]/switch:size-[18px] group-data-[size=sm]/switch:size-3.5 group-data-[size=default]/switch:data-checked:translate-x-[18px] group-data-[size=default]/switch:data-unchecked:translate-x-0.5 group-data-[size=sm]/switch:data-checked:translate-x-[14px] group-data-[size=sm]/switch:data-unchecked:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
