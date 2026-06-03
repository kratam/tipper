import { getLocale, getTranslations } from "next-intl/server";
import { CreateCircleForm } from "@/components/create-circle-form";
import { GroupVsCircleNote } from "@/components/group-vs-circle-note";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";

export default async function NewCirclePage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return redirect({ href: "/", locale });

  const t = await getTranslations("circles");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="font-bold font-heading text-2xl tracking-tight">{t("createTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      <GroupVsCircleNote />
      <CreateCircleForm />
    </div>
  );
}
