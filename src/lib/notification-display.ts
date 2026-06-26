type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface DisplayNotification {
  type: "system" | "badge";
  title: string | null;
  body: string | null;
  data: unknown;
}

/** Egy értesítés megjelenített címe/szövege. system: tárolt szöveg; badge: i18n a data alapján. */
export function notificationContent(
  n: DisplayNotification,
  t: Translate,
): { title: string; body: string } {
  if (n.type === "badge") {
    const data = (n.data ?? {}) as { badgeKey?: string; [k: string]: unknown };
    const badgeKey = data.badgeKey ?? "unknown";
    return {
      title: t(`badge.${badgeKey}.title`),
      body: t(`badge.${badgeKey}.body`),
    };
  }
  // system (és bármi ismeretlen): a tárolt literál szöveg
  return { title: n.title ?? "", body: n.body ?? "" };
}

/** Relatív idő-címke (most / perce / órája / napja). A formázás a fordítóé. */
export function formatRelativeTime(date: Date, now: Date, t: Translate): string {
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return t("time.now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("time.minutes", { count: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t("time.hours", { count: hour });
  return t("time.days", { count: Math.floor(hour / 24) });
}
