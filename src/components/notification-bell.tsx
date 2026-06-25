"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";
import { getNotifications, getUnreadCount, markAllRead, markRead } from "@/actions/notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { formatRelativeTime, notificationContent } from "@/lib/notification-display";

const BELL_CLASS =
  "relative inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/[0.13] bg-white/[0.07] text-white/90 transition hover:bg-white/[0.14]";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: unread = 0, mutate: mutateUnread } = useSWR(
    "notif-unread",
    () => getUnreadCount(),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  // A listát csak nyitott állapotban töltjük.
  const { data: items = [], mutate: mutateItems } = useSWR(
    open ? "notif-list" : null,
    () => getNotifications(),
    { revalidateOnFocus: false },
  );

  async function handleMarkAll() {
    await markAllRead();
    mutateUnread(0, { revalidate: false });
    mutateItems();
  }

  // Kattintásra helyben ki-/becsukjuk az értesítést (a panel nyitva marad);
  // első kinyitáskor olvasottá tesszük.
  async function handleToggle(recipientId: string, readAt: Date | null) {
    setExpandedId((cur) => (cur === recipientId ? null : recipientId));
    if (readAt) return;
    await markRead(recipientId);
    mutateUnread();
    mutateItems();
  }

  const now = new Date();

  const bellInner = (
    <>
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-gold px-1 font-bold text-[10px] text-gold-ink">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </>
  );

  const list = (
    <>
      <div className="flex items-center justify-between border-border border-b px-3 py-2">
        <span className="font-semibold text-sm">{t("title")}</span>
        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="text-gold-text text-xs hover:underline"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          items.map((n) => {
            const { title, body } = notificationContent(n, t);
            const expanded = expandedId === n.recipientId;
            return (
              <div key={n.recipientId} className="border-border/60 border-b last:border-b-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => handleToggle(n.recipientId, n.readAt)}
                  className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-surface-3"
                >
                  {n.readAt ? (
                    <span className="w-2 shrink-0" />
                  ) : (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{title}</p>
                    {body && (
                      <p
                        className={`text-muted-foreground text-xs ${expanded ? "" : "line-clamp-2"}`}
                      >
                        {body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-faint">
                      {formatRelativeTime(new Date(n.createdAt), now, t)}
                    </p>
                  </div>
                </button>
                {expanded && n.href && (
                  <div className="px-3 pb-2.5 pl-7">
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="inline-block font-medium text-gold-text text-xs hover:underline"
                    >
                      {t("openLink")}
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  // Desktop: a haranghoz horgonyzott popover.
  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t("title")} className={BELL_CLASS}>
            {bellInner}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
          {list}
        </PopoverContent>
      </Popover>
    );
  }

  // Mobil: fix, majdnem teljes szélességű panel a fejléc alatt (a Radix popper
  // wrapper-pozícionálását nem lehet className-nel áthelyezni, ezért saját panel).
  return (
    <>
      <button
        type="button"
        aria-label={t("title")}
        className={BELL_CLASS}
        onClick={() => setOpen((o) => !o)}
      >
        {bellInner}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label={t("close")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-[64px] z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {list}
          </div>
        </>
      )}
    </>
  );
}
