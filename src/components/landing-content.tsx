"use client";

import { Target, Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";

export function LandingContent() {
  const t = useTranslations("landing");

  function handleSignIn() {
    authClient.signIn.social({ provider: "google" });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 py-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-mono text-6xl font-bold tracking-tighter sm:text-7xl">{t("title")}</h1>
        <p className="max-w-md text-lg text-muted-foreground">{t("subtitle")}</p>
        <Button size="lg" className="mt-4 text-base" onClick={handleSignIn}>
          {t("cta")}
        </Button>
      </div>

      {/* Feature cards */}
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Target className="size-5 text-amber-500" />
            </div>
            <CardTitle className="text-base">{t("featureBet")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("featureBetDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="size-5 text-emerald-500" />
            </div>
            <CardTitle className="text-base">{t("featureCompete")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("featureCompeteDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Trophy className="size-5 text-emerald-500" />
            </div>
            <CardTitle className="text-base">{t("featureWin")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("featureWinDesc")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
