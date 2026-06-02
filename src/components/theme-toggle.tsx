"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex size-[34px] items-center justify-center rounded-[10px] text-white/78 transition hover:bg-white/[0.08] hover:text-white"
    >
      {/* Avoid hydration mismatch: render a stable icon until mounted */}
      {mounted && !isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
