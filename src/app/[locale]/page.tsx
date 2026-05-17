import { getLocale } from "next-intl/server";
import { LandingContent } from "@/components/landing-content";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getActiveTournaments } from "@/queries/tournaments";

export default async function LandingPage() {
  const user = await getCurrentUser();

  if (user) {
    const locale = await getLocale();
    const activeTournaments = await getActiveTournaments();
    const onlyActive = activeTournaments.filter((t) => t.status === "active");

    if (onlyActive.length === 1) {
      return redirect({ href: `/tournaments/${onlyActive[0].slug}`, locale });
    }

    return redirect({ href: "/tournaments", locale });
  }

  return <LandingContent />;
}
