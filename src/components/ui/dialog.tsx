"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-[rgba(5,8,15,0.66)] duration-150 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-[3px]",
        className,
      )}
      {...props}
    />
  );
}

// On phones a large dialog fills the whole screen so its own footer/links stay
// reachable (a viewport-fraction max-h leaves the bottom below the fold on short
// screens). Overrides the top-anchored geometry via max-sm: only — desktop is
// untouched. Switches to flex-col so a `p-0` dialog can pin a header and let its
// body flex-1 scroll; content-scrolls dialogs work too (their own overflow-y-auto
// still applies). Hosts opt in with the `mobileFullscreen` prop.
const mobileFullscreenClasses =
  "max-sm:top-0 max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:w-auto max-sm:max-w-none max-sm:max-h-none max-sm:translate-x-0 max-sm:flex max-sm:flex-col max-sm:rounded-none max-sm:border-0";

function DialogContent({
  className,
  children,
  showCloseButton = true,
  mobileFullscreen = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** Fill the viewport on phones (max-sm); desktop layout is unchanged. Use for tall/scrolling dialogs. */
  mobileFullscreen?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Top-anchored (not vertically centered) so the box grows/shrinks downward
          // only — content-height changes (e.g. switching tabs) never shift the header
          // or tab row. Keeps every dialog consistent; per-dialog max-h/overflow still
          // decide scrolling for tall content.
          "data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-2 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-[8dvh] left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 gap-4 rounded-xl border border-border-strong bg-popover p-4 text-popover-foreground text-sm shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)] outline-none duration-200 data-closed:animate-out data-open:animate-in sm:max-w-[430px]",
          mobileFullscreen && mobileFullscreenClasses,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-8", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading font-medium text-base leading-none", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
