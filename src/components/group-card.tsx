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
    profit > 0
      ? "text-emerald-400"
      : profit < 0
        ? "text-red-400"
        : "text-white/70";

  return (
    <div className="flex items-center gap-1 rounded-md bg-black/25 px-2 py-1">
      <span className={`font-mono text-sm font-bold ${colorClass}`}>
        {formatted}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("groups");
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    upcoming: "bg-yellow-500/10 text-yellow-600",
    finished: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={cn("text-[10px]", styles[status])}>
      {t(status as "active" | "upcoming" | "finished")}
    </Badge>
  );
}

function CardInner({
  group,
  memberCount,
  profit,
  variant = "own",
}: GroupCardProps) {
  const t = useTranslations("groups");
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        variant === "public"
          ? "border-dashed border-border"
          : "border-border shadow-sm hover:ring-1 hover:ring-foreground/20",
      )}
    >
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d1b69] p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {group.name}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-white/55">
              {group.tournament.name}
            </div>
          </div>
          {variant === "own" && profit != null ? (
            <ProfitBadge profit={profit} />
          ) : (
            <Globe className="size-4 shrink-0 text-white/35" />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-card p-3">
        {group.description && (
          <div className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground [&_p]:m-0">
            <ReactMarkdown
              allowedElements={["p", "strong", "em"]}
            >
              {group.description}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
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
      <button type="button" onClick={props.onClick} className="text-left">
        <CardInner {...props} />
      </button>
    );
  }

  return (
    <Link href={`/groups/${props.group.slug}`}>
      <CardInner {...props} />
    </Link>
  );
}
