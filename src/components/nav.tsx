"use client";

import { Ellipsis, Globe, LogOut, Menu, Pencil, Shield, Trophy, Users, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DisplayNameDialog } from "@/components/display-name-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    name: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
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

  function switchLocale(newLocale: "hu" | "en") {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  function handleSignIn() {
    authClient.signIn.social({ provider: "google", callbackURL: "/tournaments" });
  }

  function handleSignOut() {
    authClient.signOut().then(() => {
      router.refresh();
    });
  }

  const displayedName = user?.displayName ?? user?.name;
  const initials = displayedName
    ? displayedName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/tippcasino-logo.png"
              alt="TippCasino"
              width={32}
              height={32}
              className="size-8"
            />
            <span className="font-brand text-xl tracking-tight bg-linear-to-r from-(--brand-blue-dark) via-(--brand-blue) to-(--brand-gold) bg-clip-text text-transparent">
              TippCasino
            </span>
          </Link>

          {/* Desktop nav links — active tournament names */}
          <div className="hidden items-center gap-1 md:flex">
            {user &&
              activeTournaments.slice(0, MAX_HEADER_TOURNAMENTS).map((tournament) => (
                <Button key={tournament.id} variant="ghost" size="sm" asChild>
                  <Link href={`/tournaments/${tournament.slug}`}>{tournament.name}</Link>
                </Button>
              ))}
            {user && activeTournaments.length > MAX_HEADER_TOURNAMENTS && (
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link href="/tournaments">
                  <Ellipsis className="size-4" />
                </Link>
              </Button>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Locale switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5" disabled={isPending}>
                  <Globe className="size-4" />
                  <span className="text-xs uppercase">{locale}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => switchLocale("hu")}>Magyar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLocale("en")}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu or login */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden gap-2 md:flex">
                    <Avatar className="size-6">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-30 truncate text-sm">{displayedName}</span>
                    <Menu className="size-4 text-muted-foreground" />
                  </Button>
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
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
            {user ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-2 py-2">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{displayedName}</span>
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
                  className="justify-start text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" />
                  {tc("logout")}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full" onClick={handleSignIn}>
                {tc("login")}
              </Button>
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
    </>
  );
}
