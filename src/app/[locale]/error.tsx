"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-lg font-medium">{t("error")}</p>
          <Button onClick={reset} variant="outline">
            {t("back")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
