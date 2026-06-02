"use client";

import { UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { joinPublicGroup } from "@/actions/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";

interface PublicGroupDialogProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    tokenPerMatch: number;
    initialTokens: number;
    bonusGoalDiff: number;
    bonusExactScore: number;
    bonusPodiumMention: number;
    oddsBoost: number;
    lossPercentage: number;
    tournament: {
      name: string;
      status: string;
    };
  };
  memberCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("groups");
  return (
    <Badge variant={status as "active" | "upcoming"} className="text-[11px]">
      {t(status as "active" | "upcoming")}
    </Badge>
  );
}

function RuleBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface-2 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-bold font-mono text-base">{value}</div>
    </div>
  );
}

export function PublicGroupDialog({
  group,
  memberCount,
  open,
  onOpenChange,
}: PublicGroupDialogProps) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      try {
        await joinPublicGroup(group.id);
        toast.success(t("joinSuccess"));
        onOpenChange(false);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md overflow-hidden p-0 sm:max-w-md">
        {/* Gradient header */}
        <div className="relative bg-linear-to-br from-[#1e3a5f] to-[#2d1b69] p-6 after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(120%_90%_at_88%_-10%,color-mix(in_oklab,var(--gold)_22%,transparent),transparent_55%)]">
          <DialogClose className="absolute top-3 right-3 z-[1] flex size-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogTitle className="relative z-[1] pr-8 font-bold text-lg text-white">
            {group.name}
          </DialogTitle>
          <DialogDescription className="relative z-[1] mt-1 font-mono text-sm text-white/60">
            {group.tournament.name}
          </DialogDescription>
          <div className="relative z-[1] mt-3 flex items-center gap-3">
            <span className="text-white/50 text-xs">
              {t("memberCount", { count: memberCount })}
            </span>
            <StatusBadge status={group.tournament.status} />
          </div>
        </div>

        {/* Body */}
        <div className="mt-0 p-6 pt-0">
          <div className="pt-4">
            {/* Description */}
            {group.description && (
              <div className="mb-4">
                <div className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  {t("descriptionLabel")}
                </div>
                <div className="prose prose-sm prose-li:my-0 prose-ul:my-1 max-w-none prose-strong:text-foreground text-foreground/80 text-sm">
                  <ReactMarkdown
                    allowedElements={["p", "strong", "em", "ul", "ol", "li", "a", "br"]}
                  >
                    {group.description}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Rules grid */}
            <div className="mb-5">
              <div className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                {t("rules")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RuleBox label={t("tokenPerMatch")} value={String(group.tokenPerMatch)} />
                <RuleBox label={t("initialTokens")} value={String(group.initialTokens)} />
                <RuleBox label={t("bonusGoalDiff")} value={`+${group.bonusGoalDiff}`} />
                <RuleBox label={t("bonusExactScore")} value={`+${group.bonusExactScore}`} />
                <RuleBox label={t("oddsBoostLabel")} value={`${group.oddsBoost}x`} />
                <RuleBox label={t("lossPercentage")} value={`${group.lossPercentage}%`} />
                <RuleBox label={t("podiumBonus")} value={`+${group.bonusPodiumMention}`} />
              </div>
            </div>

            {/* Join button */}
            <Button onClick={handleJoin} disabled={isPending} className="w-full gap-2">
              <UserPlus className="size-4" />
              {t("joinGroup")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
