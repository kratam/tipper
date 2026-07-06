"use client";

import { LogOut, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCircle, leaveCircle } from "@/actions/circles";
import { InviteCodeBadge } from "@/components/invite-code-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useRouter } from "@/i18n/navigation";

interface CircleMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  gravatarHash: string | null;
}

interface CircleItem {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  members: CircleMember[];
}

export function CirclesList({ circles }: { circles: CircleItem[] }) {
  const t = useTranslations("circles");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLeave(id: string) {
    if (!confirm(t("leaveConfirm"))) return;
    startTransition(async () => {
      try {
        await leaveCircle(id);
        toast.success(t("leaveSuccess"));
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await deleteCircle(id);
        toast.success(t("deleteSuccess"));
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {circles.map((circle) => (
        <Card key={circle.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" />
              {circle.name}
            </CardTitle>
            <InviteCodeBadge inviteCode={circle.inviteCode} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-faint text-xs">
              {t("memberCount", { count: circle.members.length })}
            </span>
            <div className="flex flex-wrap gap-2">
              {circle.members.map((m) => (
                <span
                  key={m.userId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2.5 pl-0.5 text-[12.5px]"
                >
                  <UserAvatar
                    name={m.name}
                    googleAvatarUrl={m.avatarUrl}
                    gravatarHash={m.gravatarHash}
                    className="size-5"
                    fallbackClassName="text-[9px]"
                  />
                  {m.name}
                </span>
              ))}
            </div>
            <div className="flex">
              {circle.isOwner ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleDelete(circle.id)}
                  disabled={isPending}
                >
                  <Trash2 className="size-4" />
                  {t("delete")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive"
                  onClick={() => handleLeave(circle.id)}
                  disabled={isPending}
                >
                  <LogOut className="size-4" />
                  {t("leave")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
