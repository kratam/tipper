import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Card, CardContent } from "@/components/ui/card";

interface JoinSignInProps {
  /** A kör/csoport neve, amibe a meghívott belép. */
  targetName: string;
  /** A meghívás típusa — a megfelelő szöveghez. */
  kind: "circle" | "group";
  /** OAuth visszatérési útvonal (locale-helyes `/join/[code]`). */
  callbackURL: string;
}

/**
 * Kijelentkezett meghívottnak mutatott bejelentkező képernyő. A `callbackURL`
 * visszahozza a `/join/[code]` oldalra a login után, így a belépés egyetlen
 * kattintással, automatikusan megtörténik — a meghívó kód nem vész el.
 */
export async function JoinSignIn({ targetName, kind, callbackURL }: JoinSignInProps) {
  const t = await getTranslations("join");

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16">
      <Card className="w-full max-w-[420px]">
        <CardContent className="flex flex-col items-center gap-5 p-7 text-center">
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-sm">
              {kind === "circle" ? t("signInCircleLabel") : t("signInGroupLabel")}
            </p>
            <h1 className="font-bold text-xl">{targetName}</h1>
          </div>
          <p className="text-[13.5px] text-muted-foreground leading-relaxed">{t("signInPrompt")}</p>
          <GoogleSignInButton callbackURL={callbackURL} label={t("signInCta")} />
        </CardContent>
      </Card>
    </div>
  );
}
