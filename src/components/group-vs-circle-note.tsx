import { Info } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Közérthető magyarázat a csoport és a kör különbségéről.
 * Egy helyen definiált szöveg (`groupVsCircle` namespace), több oldalon használva:
 * új csoport/kör oldalak és a csoport/kör lista oldalak.
 */
export async function GroupVsCircleNote() {
  const t = await getTranslations("groupVsCircle");

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-gold-soft/40 p-4">
      <div className="flex items-center gap-2">
        <Info className="size-4 shrink-0 text-gold" />
        <h2 className="font-medium text-foreground text-sm">{t("title")}</h2>
      </div>
      <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground leading-relaxed">
        <li>
          <span className="font-semibold text-foreground">{t("circleLabel")}</span> —{" "}
          {t("circleText")}
        </li>
        <li>
          <span className="font-semibold text-foreground">{t("groupLabel")}</span> —{" "}
          {t("groupText")}
        </li>
      </ul>
      <p className="text-[13px] text-foreground/80">{t("summary")}</p>
    </div>
  );
}
