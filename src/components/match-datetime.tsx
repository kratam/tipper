"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface MatchDateTimeProps {
  scheduledAt: string;
  /** Tournament (venue) timezone. */
  timeZone: string;
  className?: string;
}

/**
 * Compact, single-line match date. The viewer's local date/time is primary;
 * when the browser timezone differs from the venue timezone, the venue time is
 * appended inline ("… · helyszín HH:MM"). The local value is resolved in a
 * mount-time effect (null on SSR), so the venue-tz formatting is the
 * deterministic server fallback and there is no hydration mismatch.
 */
export function MatchDateTime({ scheduledAt, timeZone, className }: MatchDateTimeProps) {
  const tMatches = useTranslations("matches");
  const locale = useLocale();
  const [localHint, setLocalHint] = useState<string | null>(null);

  useEffect(() => {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTz === timeZone) {
      setLocalHint(null);
      return;
    }
    const inEventTz = formatDate(scheduledAt, locale, timeZone, { omitYear: true });
    const inUserTz = formatDate(scheduledAt, locale, userTz, { omitYear: true });
    setLocalHint(inUserTz === inEventTz ? null : inUserTz);
  }, [scheduledAt, timeZone, locale]);

  const venueFull = formatDate(scheduledAt, locale, timeZone, { omitYear: true });
  const venueTimeOnly = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(scheduledAt));

  return (
    <span className={className}>
      {localHint ? `${localHint} · ${tMatches("venueTime", { time: venueTimeOnly })}` : venueFull}
    </span>
  );
}
