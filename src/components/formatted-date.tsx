"use client";

import { useLocale } from "next-intl";
import { formatDate } from "@/lib/utils";

export function FormattedDate({
  date,
  timeZone,
  omitYear,
}: {
  date: string;
  timeZone?: string;
  omitYear?: boolean;
}) {
  const locale = useLocale();
  return <>{formatDate(date, locale, timeZone, { omitYear })}</>;
}
