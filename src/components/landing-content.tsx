"use client";

import { Target, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export function LandingContent() {
  const t = useTranslations("landing");

  const features = [
    { icon: Target, title: t("featureBet"), desc: t("featureBetDesc") },
    { icon: Users, title: t("featureCompete"), desc: t("featureCompeteDesc") },
    { icon: Trophy, title: t("featureWin"), desc: t("featureWinDesc") },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-14 px-5 py-16 text-center max-[680px]:gap-10">
      {/* Hero */}
      <div className="flex flex-col items-center gap-[22px]">
        <Image
          src="/tippcasino-logo.png"
          alt="TippCasino"
          width={104}
          height={104}
          className="size-[104px] [filter:drop-shadow(0_10px_28px_color-mix(in_oklab,var(--gold)_26%,transparent))]"
          priority
        />
        <h1 className="m-0 bg-linear-to-r from-white via-gold to-gold-2 bg-clip-text font-brand text-[clamp(48px,9vw,80px)] text-transparent leading-[0.98] tracking-[-0.01em]">
          {t("title")}
        </h1>
        <p className="m-0 max-w-[440px] text-lg text-muted-foreground leading-relaxed">
          {t("subtitle")}
        </p>
        <GoogleSignInButton callbackURL="/tournaments" label={t("cta")} />
      </div>

      {/* Feature cards */}
      <div className="grid w-full max-w-[860px] grid-cols-3 gap-3 max-[680px]:grid-cols-1">
        {features.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="gap-0 p-5 text-left">
            <div className="mb-3.5 grid size-[42px] place-items-center rounded-[11px] bg-gold-soft text-gold">
              <Icon className="size-5" />
            </div>
            <h3 className="mb-1.5 font-bold text-[15.5px]">{title}</h3>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed">{desc}</p>
          </Card>
        ))}
      </div>

      {/* Csoport vs kör — közérthető magyarázat */}
      <p className="-mt-4 max-w-[560px] text-[13.5px] text-muted-foreground leading-relaxed max-[680px]:-mt-2">
        {t("groupVsCircleNote")}
      </p>

      {/* Footer */}
      <footer className="flex items-center gap-3 text-[12.5px] text-faint">
        <Link href="/privacy" className="hover:text-muted-foreground hover:underline">
          {t("privacy")}
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:text-muted-foreground hover:underline">
          {t("terms")}
        </Link>
      </footer>
    </div>
  );
}
