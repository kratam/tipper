"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DisplayNameDialog } from "@/components/display-name-dialog";

/** Ceruza-ikon a saját profil neve mellett; megnyitja a becenév-szerkesztő dialógot. */
export function EditDisplayNameButton({
  currentDisplayName,
}: {
  currentDisplayName: string | null;
}) {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("editDisplayName")}
        title={t("editDisplayName")}
        className="grid size-8 flex-none place-items-center rounded-lg text-faint transition-colors hover:bg-accent hover:text-gold"
      >
        <Pencil className="size-4" />
      </button>
      <DisplayNameDialog
        open={open}
        onOpenChange={setOpen}
        currentDisplayName={currentDisplayName}
      />
    </>
  );
}
