"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { broadcastSystemNotification } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AdminBroadcastForm() {
  const t = useTranslations("admin");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [isPending, startTransition] = useTransition();

  const disabled = isPending || !title.trim() || !body.trim();

  function handleSend() {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(t("broadcastConfirm"))) return;
    startTransition(async () => {
      const res = await broadcastSystemNotification({
        title,
        body,
        href: href.trim() || undefined,
      });
      if (res.success) {
        toast.success(t("broadcastSent", { count: res.recipientCount ?? 0 }));
        setTitle("");
        setBody("");
        setHref("");
      } else {
        toast.error(t("broadcastError"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("broadcastTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-title">{t("broadcastFieldTitle")}</Label>
          <Input
            id="bc-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-body">{t("broadcastFieldBody")}</Label>
          <Textarea
            id="bc-body"
            value={body}
            maxLength={500}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-href">{t("broadcastFieldHref")}</Label>
          <Input
            id="bc-href"
            value={href}
            placeholder="/tournaments/..."
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
        <Button onClick={handleSend} disabled={disabled}>
          {t("broadcastSend")}
        </Button>
      </CardContent>
    </Card>
  );
}
