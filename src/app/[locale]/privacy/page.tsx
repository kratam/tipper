import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl">
      <h1>{t("title")}</h1>
      <p className="text-muted-foreground">{t("lastUpdated")}</p>

      <h2>{t("intro.title")}</h2>
      <p>{t("intro.text")}</p>

      <h2>{t("dataCollected.title")}</h2>
      <p>{t("dataCollected.text")}</p>
      <ul>
        <li>{t("dataCollected.name")}</li>
        <li>{t("dataCollected.email")}</li>
        <li>{t("dataCollected.avatar")}</li>
      </ul>

      <h2>{t("usage.title")}</h2>
      <p>{t("usage.text")}</p>

      <h2>{t("thirdParty.title")}</h2>
      <p>{t("thirdParty.text")}</p>

      <h2>{t("retention.title")}</h2>
      <p>{t("retention.text")}</p>

      <h2>{t("rights.title")}</h2>
      <p>{t("rights.text")}</p>

      <h2>{t("contact.title")}</h2>
      <p>{t("contact.text")}</p>
    </div>
  );
}
