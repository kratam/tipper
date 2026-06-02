"use client";

import { Globe, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tournament: {
      name: string;
      slug: string;
      status: string;
    };
  };
  memberCount: number;
  profit?: number;
  variant?: "own" | "public";
  onClick?: () => void;
}

function ProfitBadge({ profit }: { profit: number }) {
  const formatted = profit > 0 ? `+${profit}` : `${profit}`;
  const colorClass =
    profit > 0 ? "text-[#4ade80]" : profit < 0 ? "text-[#f87171]" : "text-white/70";

  return (
    <span
      className={cn(
        "z-[1] inline-flex shrink-0 items-center gap-1 rounded-full bg-black/[0.28] px-2 py-[3px] font-bold font-mono text-[12.5px]",
        colorClass,
      )}
    >
      {formatted}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("groups");
  return (
    <Badge variant={status as "active" | "upcoming" | "finished"} className="text-[10.5px]">
      {t(status as "active" | "upcoming" | "finished")}
    </Badge>
  );
}

function CardInner({ group, memberCount, profit, variant = "own" }: GroupCardProps) {
  const t = useTranslations("groups");
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-card text-left shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_28px_-22px_rgba(0,0,0,0.9)] transition-all hover:-translate-y-[3px] hover:border-gold-line",
        variant === "public" && "border-dashed",
      )}
    >
      {/* Gradient header */}
      <div className="relative flex items-start justify-between gap-2.5 bg-linear-to-br from-[#1e3a5f] to-[#2d1b69] p-[15px] pb-3.5 after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(120%_90%_at_88%_-10%,color-mix(in_oklab,var(--gold)_22%,transparent),transparent_55%)]">
        <div className="z-[1] min-w-0 flex-1">
          <div className="truncate font-bold text-[15px] text-white leading-tight">
            {group.name}
          </div>
          <div className="mt-[3px] truncate font-mono text-[11px] text-white/60">
            {group.tournament.name}
          </div>
        </div>
        {variant === "own" && profit != null ? (
          <ProfitBadge profit={profit} />
        ) : (
          <Globe className="z-[1] size-4 shrink-0 text-white/40" />
        )}
      </div>

      {/* Body */}
      <div className="bg-card p-[15px] pt-3.5">
        {group.description && (
          <div className="mb-[11px] line-clamp-2 text-[12.5px] text-muted-foreground leading-relaxed [&_p]:m-0">
            <ReactMarkdown allowedElements={["p", "strong", "em"]}>
              {group.description}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-[5px] text-[11.5px] text-faint">
            <Users className="size-3" />
            {t("memberCount", { count: memberCount })}
          </span>
          <StatusBadge status={group.tournament.status} />
        </div>
      </div>
    </div>
  );
}

export function GroupCard(props: GroupCardProps) {
  if (props.variant === "public" && props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className="w-full text-left">
        <CardInner {...props} />
      </button>
    );
  }

  return (
    <Link href={`/tournaments/${props.group.tournament.slug}/groups/${props.group.slug}`}>
      <CardInner {...props} />
    </Link>
  );
}
