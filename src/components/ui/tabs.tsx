"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Tracks the active value + a per-Tabs id so the sliding indicator stays scoped to one row. */
const TabsActiveContext = React.createContext<{ active?: string; groupId: string }>({
  groupId: "tabs",
});

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const groupId = React.useId();
  const [active, setActive] = React.useState<string | undefined>(value ?? defaultValue);

  // Mirror controlled value so the indicator follows external changes too.
  React.useEffect(() => {
    if (value !== undefined) setActive(value);
  }, [value]);

  const handleValueChange = React.useCallback(
    (next: string) => {
      setActive(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  return (
    <TabsActiveContext.Provider value={{ active, groupId }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
        {...props}
      />
    </TabsActiveContext.Provider>
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

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { active, groupId } = React.useContext(TabsActiveContext);
  const reduceMotion = useReducedMotion();
  const isActive = active !== undefined && active === value;

  const indicatorTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 450, damping: 38 } as const);

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)*0.62)] border-0 px-3.5 font-semibold text-[14px] text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-active:text-foreground max-[560px]:scroll-ml-1",
        className,
      )}
      {...props}
    >
      {isActive && (
        <>
          {/* Raised gold-bordered pill — only in the segmented (default) variant. */}
          <motion.span
            aria-hidden
            layoutId={`${groupId}-tab-pill`}
            transition={indicatorTransition}
            className="absolute inset-0 rounded-[calc(var(--radius)*0.62)] group-data-[variant=default]/tabs-list:bg-linear-to-b group-data-[variant=default]/tabs-list:from-surface-3 group-data-[variant=default]/tabs-list:to-surface group-data-[variant=default]/tabs-list:shadow-[0_1px_0_var(--border-strong)_inset,0_6px_14px_-10px_rgba(0,0,0,0.7),0_0_0_1px_var(--gold-line)_inset]"
          />
          {/* Gold underline glow. */}
          <motion.span
            aria-hidden
            layoutId={`${groupId}-tab-underline`}
            transition={indicatorTransition}
            className="absolute inset-x-[22%] bottom-[5px] h-[2.5px] rounded-full bg-gold shadow-[0_0_8px_var(--gold)]"
          />
        </>
      )}
      {/* translateZ(0) promotes the label to its own compositing layer so iOS Safari
          keeps it above the sliding indicator's transform layer mid-animation (the
          z-index is already correct; this fixes the WebKit-only paint-order glitch). */}
      <span className="relative z-10 inline-flex items-center justify-center gap-[7px] [transform:translateZ(0)] [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
        {children}
      </span>
    </TabsPrimitive.Trigger>
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
