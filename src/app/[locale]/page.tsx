import { useTranslations } from "next-intl";

export default function LandingPage() {
  const t = useTranslations("landing");
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
