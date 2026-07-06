import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Nav } from "@/components/nav";
import { QueryProvider } from "@/components/query-provider";
import { SWRProvider } from "@/components/swr-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { gravatarHash } from "@/lib/gravatar-hash";
import { getActiveTournaments } from "@/queries/tournaments";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "hu" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const [user, activeTournaments] = await Promise.all([getCurrentUser(), getActiveTournaments()]);

  const navUser = user
    ? {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        gravatarHash: gravatarHash(user.email),
        isAdmin: user.isAdmin,
      }
    : null;

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <SWRProvider>
          <Nav user={navUser} activeTournaments={activeTournaments} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <Toaster />
        </SWRProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
