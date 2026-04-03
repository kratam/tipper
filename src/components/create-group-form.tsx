"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createGroup } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

interface CreateGroupFormProps {
  tournaments: { id: string; name: string }[];
}

export function CreateGroupForm({ tournaments }: CreateGroupFormProps) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !tournamentId) return;

    startTransition(async () => {
      try {
        const group = await createGroup({ name: name.trim(), tournamentId });
        toast.success(t("createSuccess"));
        router.push(`/groups/${group.slug}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name")}
              required
              minLength={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("tournament")}</Label>
            <Select value={tournamentId} onValueChange={setTournamentId}>
              <SelectTrigger>
                <SelectValue placeholder={t("tournament")} />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((tournament) => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Collapsible advanced settings */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {t("advanced")}
          </button>

          {showAdvanced && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("advanced")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {t("tokenPerRound")}: 100, {t("bonusGoalDiff")}: 5, {t("bonusExactScore")}: 10,{" "}
                  {t("bonusPodiumMention")}: 20, {t("bonusPodiumExact")}: 20,{" "}
                  {t("carryoverPercent")}: 50%
                </p>
                <p className="text-xs text-muted-foreground">
                  (Defaults are applied. Edit after creation in group settings.)
                </p>
              </CardContent>
            </Card>
          )}

          <Button type="submit" disabled={isPending || !name.trim() || !tournamentId}>
            {t("create")}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
