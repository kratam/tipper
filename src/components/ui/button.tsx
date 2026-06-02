import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent bg-clip-padding font-[650] text-sm outline-none transition-[transform,border-color,box-shadow,filter,background-color] duration-150 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-gold to-gold-2 font-bold text-gold-ink shadow-[0_10px_22px_-12px_var(--gold-2),0_1px_0_rgba(255,255,255,0.3)_inset] hover:brightness-105",
        outline:
          "border-border-strong bg-transparent text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "border-border bg-secondary text-foreground hover:border-border-strong hover:bg-surface-3 aria-expanded:bg-surface-3",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground",
        destructive:
          "bg-loss-soft text-loss hover:bg-[color-mix(in_oklab,var(--loss)_22%,transparent)]",
        google:
          "border-black/[0.08] bg-white font-[650] text-[#1f2937] shadow-[0_8px_22px_-12px_rgba(0,0,0,0.5)] hover:bg-[#f6f7f9]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 rounded-[calc(var(--radius-sm)*0.9)] px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-[50px] px-7 text-base",
        icon: "size-[38px] px-0",
        "icon-sm": "size-8 px-0 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
