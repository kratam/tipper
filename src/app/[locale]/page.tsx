import { getLocale } from "next-intl/server";
import { LandingContent } from "@/components/landing-content";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";

export default async function LandingPage() {
  const user = await getCurrentUser();

  if (user) {
    const locale = await getLocale();
    return redirect({ href: "/tournaments", locale });
  }

  return <LandingContent />;
}
