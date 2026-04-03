import { getLocale, getTranslations } from "next-intl/server";
import { CreateGroupForm } from "@/components/create-group-form";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTournaments } from "@/queries/tournaments";

export default async function CreateGroupPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("groups");
  const tournaments = await getTournaments();
  const availableTournaments = tournaments.filter((t) => t.status !== "finished");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="font-mono text-2xl font-bold tracking-tight">{t("create")}</h1>
      <CreateGroupForm
        tournaments={availableTournaments.map((t) => ({
          id: t.id,
          name: t.name,
        }))}
      />
    </div>
  );
}
