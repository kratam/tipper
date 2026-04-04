"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const colorMap: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  upcoming: "bg-amber-500/10 text-amber-500",
  finished: "bg-muted text-muted-foreground",
};

interface TournamentStatusBadgeProps {
  status: string;
}

export function TournamentStatusBadge({ status }: TournamentStatusBadgeProps) {
  const t = useTranslations("status");

  return (
    <Badge variant="outline" className={colorMap[status] ?? ""}>
      {t(status)}
    </Badge>
  );
}
