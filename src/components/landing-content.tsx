"use client";

import { Target, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

function GoogleG({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Google">
      <title>Google</title>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.5 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.9 37.9 46.5 31.8 46.5 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.5-5.8c-2 1.4-4.7 2.3-7.8 2.3-6.4 0-11.8-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export function LandingContent() {
  const t = useTranslations("landing");

  function handleSignIn() {
    authClient.signIn.social({
      provider: "google",
      callbackURL: "/tournaments",
    });
  }

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
        <Button variant="google" size="lg" className="mt-1.5" onClick={handleSignIn}>
          <GoogleG size={19} />
          {t("cta")}
        </Button>
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
