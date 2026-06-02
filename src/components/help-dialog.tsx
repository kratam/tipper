"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HelpSection {
  heading: string;
  items: string[];
}

export function HelpDialog() {
  const t = useTranslations("help");
  const sections = t.raw("sections") as HelpSection[];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={t("title")}>
          <HelpCircle className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Hero header — gold gradient wash + crown disc */}
        <DialogHeader className="flex flex-row items-center gap-3.5 border-border border-b bg-linear-to-br from-gold-soft to-transparent p-5 pr-12 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-linear-to-br from-gold to-gold-2 text-gold-ink">
            <HelpCircle className="size-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-heading text-[19px]">{t("title")}</DialogTitle>
            <DialogDescription className="text-[13px]">{t("intro")}</DialogDescription>
          </div>
        </DialogHeader>

        {/* Numbered steps */}
        <div className="max-h-[min(62vh,540px)] overflow-y-auto px-5 py-4">
          {sections.map((section, index) => (
            <section
              key={section.heading}
              className="flex gap-3.5 border-border border-b py-3 last:border-b-0"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border border-border bg-secondary font-bold font-mono text-gold text-sm">
                {index + 1}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-medium text-[14.5px] text-foreground">{section.heading}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-muted-foreground leading-relaxed">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
