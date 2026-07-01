"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list grid w-full auto-cols-[minmax(max-content,1fr)] grid-flow-col gap-1 rounded-[calc(var(--radius)*0.9)] border border-border bg-secondary p-1 text-muted-foreground max-[560px]:overflow-x-auto max-[560px]:[scrollbar-width:none] max-[560px]:[&::-webkit-scrollbar]:hidden",
  {
    variants: {
      variant: {
        default: "",
        line: "border-0 bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-10 items-center justify-center gap-[7px] whitespace-nowrap rounded-[calc(var(--radius)*0.62)] border-0 px-3.5 font-semibold text-[14px] text-muted-foreground outline-none transition-[color,box-shadow] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 max-[560px]:scroll-ml-1 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-active:text-foreground",
        // Raised gold-bordered pill only in the segmented (default) variant; the line
        // variant keeps just the gold underline below (no box).
        "group-data-[variant=default]/tabs-list:data-active:bg-linear-to-b group-data-[variant=default]/tabs-list:data-active:from-surface-3 group-data-[variant=default]/tabs-list:data-active:to-surface group-data-[variant=default]/tabs-list:data-active:shadow-[0_1px_0_var(--border-strong)_inset,0_6px_14px_-10px_rgba(0,0,0,0.7),0_0_0_1px_var(--gold-line)_inset]",
        "after:pointer-events-none after:absolute after:inset-x-[22%] after:bottom-[5px] after:h-[2.5px] after:rounded-full after:bg-gold after:opacity-0 after:shadow-[0_0_8px_var(--gold)] after:transition-opacity data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
