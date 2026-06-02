"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function InviteCodeBadge({ inviteCode }: { inviteCode: string }) {
  const t = useTranslations("groups");
  const [copied, setCopied] = useState(false);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteCode}`
      : `/join/${inviteCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{t("inviteCode")}:</span>
      <span className="font-medium font-mono text-xs">{inviteCode}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6" onClick={handleCopy}>
              {copied ? (
                <Check className="size-3 text-win" />
              ) : (
                <ClipboardCopy className="size-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? t("copied") : t("copyLink")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
