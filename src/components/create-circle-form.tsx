"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCircle } from "@/actions/circles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

export function CreateCircleForm() {
  const t = useTranslations("circles");
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error(t("nameTooShort"));
      return;
    }
    startTransition(async () => {
      try {
        await createCircle(name.trim());
        toast.success(t("createSuccess"));
        router.push("/circles");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="circle-name">{t("name")}</Label>
            <Input
              id="circle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={60}
            />
          </div>
          <Button type="submit" disabled={isPending || name.trim().length < 2}>
            {t("createButton")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
