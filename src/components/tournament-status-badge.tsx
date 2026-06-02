"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type StatusVariant = "active" | "upcoming" | "finished" | "outline";

const variantMap: Record<string, StatusVariant> = {
  active: "active",
  upcoming: "upcoming",
  finished: "finished",
};

interface TournamentStatusBadgeProps {
  status: string;
}

export function TournamentStatusBadge({ status }: TournamentStatusBadgeProps) {
  const t = useTranslations("status");

  return <Badge variant={variantMap[status] ?? "outline"}>{t(status)}</Badge>;
}
