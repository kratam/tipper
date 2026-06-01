"use client";

import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildRuleSections, type GroupRules } from "@/lib/group-rules";

export type { GroupRules };

interface GroupRulesDialogProps {
  groupName: string;
  rules: GroupRules;
  /** Szűk fejlécben (mobil) csak ikon, felirat nélkül. */
  iconOnly?: boolean;
}

export function GroupRulesDialog({ groupName, rules, iconOnly = false }: GroupRulesDialogProps) {
  const t = useTranslations("groups");
  const [open, setOpen] = useState(false);
  const sections = buildRuleSections(rules);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? t("rules") : undefined}
        className="gap-1.5 text-muted-foreground"
      >
        <ScrollText className="size-4" />
        {!iconOnly && <span>{t("rules")}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {groupName} · {t("rules")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("rulesDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.titleKey} className="flex flex-col gap-1.5">
                <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t(section.titleKey as Parameters<typeof t>[0])}
                </h3>
                {section.rows.map((row) => (
                  <div key={row.labelKey} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm">{t(row.labelKey as Parameters<typeof t>[0])}</span>
                      <span className="font-mono text-amber-500 text-sm">{row.value}</span>
                    </div>
                    {row.explainKey && (
                      <p className="text-muted-foreground text-xs">
                        {t(row.explainKey as Parameters<typeof t>[0], row.explainParams)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
