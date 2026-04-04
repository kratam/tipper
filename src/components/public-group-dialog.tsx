"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { joinPublicGroup } from "@/actions/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
  const styles: Record<string, string> = {
    active: "bg-green-500/20 text-green-300",
    upcoming: "bg-yellow-500/20 text-yellow-300",
  };
  return (
    <Badge variant="secondary" className={cn("text-[11px]", styles[status])}>
      {t(status as "active" | "upcoming")}
    </Badge>
  );
}

function RuleBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
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
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d1b69] p-6">
          <DialogTitle className="text-lg font-bold text-white">{group.name}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/60">
            {group.tournament.name}
          </DialogDescription>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-white/50">
              {t("memberCount", { count: memberCount })}
            </span>
            <StatusBadge status={group.tournament.status} />
          </div>
        </div>

        {/* Body */}
        <div className="-mt-0 p-6 pt-0">
          <div className="pt-4">
            {/* Description */}
            {group.description && (
              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("descriptionLabel")}
                </div>
                <div className="prose prose-sm max-w-none text-sm text-foreground/80 prose-strong:text-foreground prose-ul:my-1 prose-li:my-0">
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
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("rules")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RuleBox label={t("tokenPerMatch")} value={String(group.tokenPerMatch)} />
                <RuleBox label={t("initialTokens")} value={String(group.initialTokens)} />
                <RuleBox label={t("bonusGoalDiff")} value={`+${group.bonusGoalDiff}`} />
                <RuleBox label={t("bonusExactScore")} value={`+${group.bonusExactScore}`} />
                <RuleBox label={t("oddsBoostLabel")} value={`${group.oddsBoost}x`} />
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
