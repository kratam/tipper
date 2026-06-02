"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDisplayName } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

const MAX_LENGTH = 30;

interface DisplayNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDisplayName: string | null;
}

export function DisplayNameDialog({
  open,
  onOpenChange,
  currentDisplayName,
}: DisplayNameDialogProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(currentDisplayName ?? "");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateDisplayName(formData);
      if (result.success) {
        toast.success(t("saved"));
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        {/* Hero header */}
        <div className="flex items-center gap-3.5 border-border border-b bg-linear-to-r from-gold-soft to-transparent px-5 pt-5 pb-[18px]">
          <span className="grid size-10 flex-none place-items-center rounded-[11px] bg-linear-to-br from-gold to-gold-2 text-gold-ink shadow-[0_8px_20px_-8px_var(--gold-2)]">
            <Users className="size-5" />
          </span>
          <div className="flex-1">
            <DialogTitle className="font-bold font-heading text-[19px]">
              {t("displayNameLabel")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-muted-foreground">
              {t("displayNameDescription")}
            </DialogDescription>
          </div>
        </div>

        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 p-5 pt-1">
          <div>
            <Input
              id="displayName"
              name="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("displayNamePlaceholder")}
              maxLength={MAX_LENGTH}
              autoFocus
              className="h-[46px] rounded-sm border-border bg-secondary text-center text-base focus-visible:border-gold-line focus-visible:ring-0"
            />
            <div className="mt-1.5 text-right text-[11px] text-faint">
              {name.length}/{MAX_LENGTH}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending || name.trim().length === 0}>
            {tc("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
