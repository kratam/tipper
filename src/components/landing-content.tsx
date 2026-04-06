"use client";

import { Target, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

export function LandingContent() {
  const t = useTranslations("landing");

  function handleSignIn() {
    authClient.signIn.social({
      provider: "google",
      callbackURL: "/tournaments",
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 py-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 text-center">
        <Image
          src="/tippcasino-logo.png"
          alt="TippCasino"
          width={120}
          height={120}
          className="size-28 sm:size-32"
          priority
        />
        <h1 className="bg-linear-to-r from-(--brand-blue-dark) via-(--brand-blue) to-(--brand-gold) bg-clip-text font-brand text-6xl text-transparent tracking-tight sm:text-7xl">
          {t("title")}
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">{t("subtitle")}</p>
        <Button size="lg" className="mt-2 text-base" onClick={handleSignIn}>
          {t("cta")}
        </Button>
      </div>

      {/* Feature cards */}
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-(--brand-gold)/10">
              <Target className="size-5 text-(--brand-gold)" />
            </div>
            <CardTitle className="text-base">{t("featureBet")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("featureBetDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-(--brand-blue)/10">
              <Users className="size-5 text-(--brand-blue)" />
            </div>
            <CardTitle className="text-base">{t("featureCompete")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("featureCompeteDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-(--brand-blue)/10">
              <Trophy className="size-5 text-(--brand-blue)" />
            </div>
            <CardTitle className="text-base">{t("featureWin")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("featureWinDesc")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="flex gap-3 text-muted-foreground text-xs">
        <Link href="/privacy" className="hover:underline">
          {t("privacy")}
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">
          {t("terms")}
        </Link>
      </footer>
    </div>
  );
}
