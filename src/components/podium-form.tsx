"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { placePodiumBet } from "@/actions/podium-bets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface ExistingPodiumBet {
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

interface PodiumFormProps {
  tournamentId: string;
  groupId: string;
  groupName: string;
  teams: TeamOption[];
  existingBet: ExistingPodiumBet | null;
  isLocked: boolean;
}

export function PodiumForm({
  tournamentId,
  groupId,
  groupName,
  teams,
  existingBet,
  isLocked,
}: PodiumFormProps) {
  const t = useTranslations("podium");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [gold, setGold] = useState(existingBet?.goldTeamId ?? "");
  const [silver, setSilver] = useState(existingBet?.silverTeamId ?? "");
  const [bronze, setBronze] = useState(existingBet?.bronzeTeamId ?? "");

  const selected = new Set([gold, silver, bronze].filter(Boolean));

  function handleSubmit() {
    if (!gold || !silver || !bronze) return;

    startTransition(async () => {
      try {
        await placePodiumBet({
          tournamentId,
          groupId,
          goldTeamId: gold,
          silverTeamId: silver,
          bronzeTeamId: bronze,
        });
        toast.success(t("submit"));
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  if (isLocked) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">{t("locked")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{groupName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {[
          { label: t("gold"), value: gold, onChange: setGold, emoji: "\u{1F947}" },
          { label: t("silver"), value: silver, onChange: setSilver, emoji: "\u{1F948}" },
          { label: t("bronze"), value: bronze, onChange: setBronze, emoji: "\u{1F949}" },
        ].map((slot) => (
          <div key={slot.label} className="flex flex-col gap-1">
            <Label className="text-xs">
              {slot.emoji} {slot.label}
            </Label>
            <Select value={slot.value} onValueChange={slot.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectTeam")} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => {
                  const isUsedElsewhere = selected.has(team.id) && team.id !== slot.value;
                  return (
                    <SelectItem key={team.id} value={team.id} disabled={isUsedElsewhere}>
                      <div className="flex items-center gap-2">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="size-5 rounded-sm object-contain"
                          />
                        ) : (
                          <span className="flex size-5 items-center justify-center rounded-sm bg-muted text-[8px] font-bold">
                            {team.name.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                        {team.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ))}

        <Button onClick={handleSubmit} disabled={isPending || !gold || !silver || !bronze}>
          {existingBet ? t("submit") : t("submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
