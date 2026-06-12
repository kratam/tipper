"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Open/close state that persists to localStorage.
 *
 * Starts from `defaultOpen` on the server and first client render (to avoid
 * hydration mismatch), then syncs the stored value in after mount.
 */
export function usePersistedDisclosure(
  storageKey: string,
  defaultOpen = false,
): readonly [boolean, (next: boolean) => void, () => void] {
  const [open, setOpenState] = useState(defaultOpen);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "true") setOpenState(true);
    else if (stored === "false") setOpenState(false);
  }, [storageKey]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore quota / disabled storage
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);

  return [open, setOpen, toggle] as const;
}
