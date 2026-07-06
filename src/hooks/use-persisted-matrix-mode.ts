"use client";

import { useCallback, useEffect, useState } from "react";
import type { MatrixMode } from "@/lib/tip-matrix";

const STORAGE_KEY = "tipmatrix:mode";

/**
 * A Tipp-tábla token/klasszikus módja localStorage-ban perzisztálva. SSR-en és
 * az első kliens-renderen `"token"` (hydration-mismatch elkerülése), majd mount
 * után beolvassa a tárolt értéket. A kulcs közös a csoport- és kör-mátrix közt.
 */
export function usePersistedMatrixMode(): readonly [MatrixMode, () => void] {
  const [mode, setMode] = useState<MatrixMode>("token");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "classic" || stored === "token") setMode(stored);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: MatrixMode = m === "token" ? "classic" : "token";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }, []);

  return [mode, toggle] as const;
}
