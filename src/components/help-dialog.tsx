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
      <DialogContent className="max-h-[85dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4">
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-1.5">
              <h3 className="font-heading font-medium text-sm">{section.heading}</h3>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground text-sm">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
