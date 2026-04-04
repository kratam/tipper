import { useTranslations } from "next-intl";

export default function TermsPage() {
  const t = useTranslations("terms");

  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl">
      <h1>{t("title")}</h1>
      <p className="text-muted-foreground">{t("lastUpdated")}</p>

      <h2>{t("service.title")}</h2>
      <p>{t("service.text")}</p>

      <h2>{t("accounts.title")}</h2>
      <p>{t("accounts.text")}</p>

      <h2>{t("usage.title")}</h2>
      <p>{t("usage.text")}</p>

      <h2>{t("tokens.title")}</h2>
      <p>{t("tokens.text")}</p>

      <h2>{t("liability.title")}</h2>
      <p>{t("liability.text")}</p>

      <h2>{t("changes.title")}</h2>
      <p>{t("changes.text")}</p>

      <h2>{t("contact.title")}</h2>
      <p>{t("contact.text")}</p>
    </div>
  );
}
