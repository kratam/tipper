"use client";

import {
  Ellipsis,
  Globe,
  HelpCircle,
  LogOut,
  Menu,
  Pencil,
  Shield,
  Trophy,
  User,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DisplayNameDialog } from "@/components/display-name-dialog";
import { HelpDialog } from "@/components/help-dialog";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

interface ActiveTournament {
  id: string;
  name: string;
  slug: string;
  status: "upcoming" | "active" | "finished";
}

interface NavProps {
  user: {
    id: string;
    name: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    gravatarHash: string | null;
    isAdmin: boolean;
  } | null;
  activeTournaments: ActiveTournament[];
}

const MAX_HEADER_TOURNAMENTS = 3;

export function Nav({ user, activeTournaments }: NavProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function switchLocale(newLocale: "hu" | "en") {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  function handleSignIn() {
    authClient.signIn.social({ provider: "google", callbackURL: "/tournaments" });
  }

  function handleSignOut() {
    // A SDK saját UI-ja is .finally-vel zár: a signOut() elutasítása esetén is
    // reagáljon a UI (a .then csak sikerre futott volna). Hard navigáció a
    // kezdőlapra: a soft router.refresh() bennhagyhat elavult kliens-állapotot,
    // a teljes újratöltés garantáltan újraolvastatja a (törölt) cookie-t.
    authClient.signOut().finally(() => {
      window.location.href = `/${locale}`;
    });
  }

  const displayedName = user?.displayName ?? user?.name;

  return (
    <>
      <nav className="sticky top-0 z-40 border-white/[0.07] border-b bg-[color-mix(in_oklab,var(--nav-bg)_92%,transparent)] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur-[14px] backdrop-saturate-150">
        <div className="mx-auto flex h-[60px] max-w-[1024px] items-center justify-between gap-3 px-4 text-[#f2f5fb]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/tippcasino-logo.png"
              alt="TippCasino"
              width={30}
              height={30}
              className="size-[30px]"
            />
            <span className="bg-linear-to-r from-white via-gold to-gold-2 bg-clip-text font-brand text-[21px] text-transparent tracking-tight max-[360px]:hidden">
              TippCasino
            </span>
          </Link>

          {/* Desktop nav links — active tournament names */}
          <div className="hidden items-center gap-1 md:flex">
            {user &&
              activeTournaments.slice(0, MAX_HEADER_TOURNAMENTS).map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.slug}`}
                  className="inline-flex h-[34px] items-center rounded-[9px] px-3 font-semibold text-[13px] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                >
                  {tournament.name}
                </Link>
              ))}
            {user && activeTournaments.length > MAX_HEADER_TOURNAMENTS && (
              <Link
                href="/tournaments"
                className="inline-flex size-[34px] items-center justify-center rounded-[9px] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
              >
                <Ellipsis className="size-4" />
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            {/* Help — desktop only; on mobile it lives in the hamburger menu */}
            <span className="hidden md:inline-flex">
              <HelpDialog />
            </span>

            {/* Notifications */}
            {user && <NotificationBell />}

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Locale switcher */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-white/[0.13] bg-white/[0.07] px-[11px] font-semibold text-[12px] text-white/90 transition hover:bg-white/[0.14] disabled:opacity-50"
                >
                  <Globe className="size-4" />
                  <span className="uppercase max-[700px]:hidden">{locale}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => switchLocale("hu")}>Magyar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLocale("en")}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu or login */}
            {user ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden h-[38px] items-center gap-2 rounded-sm border border-white/[0.09] bg-white/[0.06] py-1 pr-2 pl-1 text-[#f2f5fb] transition hover:bg-white/[0.11] md:flex"
                  >
                    <UserAvatar
                      name={displayedName ?? "?"}
                      googleAvatarUrl={user.avatarUrl}
                      gravatarHash={user.gravatarHash}
                      className="size-7"
                      fallbackClassName="text-xs"
                    />
                    <span className="max-w-30 truncate font-semibold text-[13.5px] max-[700px]:hidden">
                      {displayedName}
                    </span>
                    <Menu className="size-4 text-white/55" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  <DropdownMenuItem asChild>
                    <Link href="/tournaments">
                      <Trophy className="mr-2 size-4" />
                      {t("tournaments")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/groups">
                      <Users className="mr-2 size-4" />
                      {t("groups")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/circles">
                      <UsersRound className="mr-2 size-4" />
                      {t("circles")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/u/${user.id}`}>
                      <User className="mr-2 size-4" />
                      {t("myProfile")}
                    </Link>
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 size-4" />
                        {t("admin")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setDisplayNameOpen(true)}>
                    <Pencil className="mr-2 size-4" />
                    {t("displayName")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" />
                    {tc("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={handleSignIn} className="hidden md:flex">
                {tc("login")}
              </Button>
            )}

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white/78 hover:bg-white/[0.08] hover:text-white md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-white/[0.07] border-t bg-nav-bg px-4 pt-2 pb-4 md:hidden">
            {user ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-2 py-2">
                  <UserAvatar
                    name={displayedName ?? "?"}
                    googleAvatarUrl={user.avatarUrl}
                    gravatarHash={user.gravatarHash}
                    className="size-8"
                    fallbackClassName="text-xs"
                  />
                  <span className="font-medium text-sm">{displayedName}</span>
                </div>
                {activeTournaments.slice(0, MAX_HEADER_TOURNAMENTS).map((tournament) => (
                  <Button
                    key={tournament.id}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    asChild
                    onClick={() => setMobileOpen(false)}
                  >
                    <Link href={`/tournaments/${tournament.slug}`}>
                      <Trophy className="mr-2 size-4" />
                      {tournament.name}
                    </Link>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href="/tournaments">{t("tournaments")}</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href="/groups">{t("groups")}</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href="/circles">
                    <UsersRound className="mr-2 size-4" />
                    {t("circles")}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href={`/u/${user.id}`}>
                    <User className="mr-2 size-4" />
                    {t("myProfile")}
                  </Link>
                </Button>
                {user.isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    asChild
                    onClick={() => setMobileOpen(false)}
                  >
                    <Link href="/admin">{t("admin")}</Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setDisplayNameOpen(true);
                    setMobileOpen(false);
                  }}
                >
                  <Pencil className="mr-2 size-4" />
                  {t("displayName")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setHelpOpen(true);
                    setMobileOpen(false);
                  }}
                >
                  <HelpCircle className="mr-2 size-4" />
                  {t("help")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" />
                  {tc("logout")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setHelpOpen(true);
                    setMobileOpen(false);
                  }}
                >
                  <HelpCircle className="mr-2 size-4" />
                  {t("help")}
                </Button>
                <Button size="sm" className="w-full" onClick={handleSignIn}>
                  {tc("login")}
                </Button>
              </div>
            )}
          </div>
        )}
      </nav>
      {user && (
        <DisplayNameDialog
          open={displayNameOpen}
          onOpenChange={setDisplayNameOpen}
          currentDisplayName={user.displayName}
        />
      )}
      {/* Controlled help dialog opened from the mobile hamburger menu */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} showTrigger={false} />
    </>
  );
}
