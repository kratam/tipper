"use client";

import { useLocale } from "next-intl";
import { formatDate } from "@/lib/utils";

export function FormattedDate({ date, timeZone }: { date: string; timeZone?: string }) {
  const locale = useLocale();
  return <>{formatDate(date, locale, timeZone)}</>;
}
