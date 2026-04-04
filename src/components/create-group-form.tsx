"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createGroup } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  tournaments: { id: string; name: string; logoUrl: string | null }[];
}

export function CreateGroupForm({ tournaments }: CreateGroupFormProps) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState({
    tokenPerMatch: 100,
    initialTokens: 200,
    distributionDaysBefore: 3,
    bonusGoalDiff: 5,
    bonusExactScore: 10,
    bonusPodiumMention: 20,
    bonusPodiumExact: 20,
    oddsBoost: 1.0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !tournamentId) return;

    startTransition(async () => {
      try {
        const group = await createGroup({ name: name.trim(), tournamentId, ...settings });
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
                    <span className="flex items-center gap-2">
                      {tournament.logoUrl && (
                        <Image
                          src={tournament.logoUrl}
                          alt={tournament.name}
                          width={20}
                          height={20}
                          className="size-5 object-contain"
                        />
                      )}
                      {tournament.name}
                    </span>
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
              <CardContent className="grid grid-cols-2 gap-4 pt-6">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("tokenPerMatch")}</Label>
                  <Input
                    type="number"
                    value={settings.tokenPerMatch}
                    onChange={(e) =>
                      setSettings({ ...settings, tokenPerMatch: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("initialTokens")}</Label>
                  <Input
                    type="number"
                    value={settings.initialTokens}
                    onChange={(e) =>
                      setSettings({ ...settings, initialTokens: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("distributionDaysBefore")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={settings.distributionDaysBefore}
                    onChange={(e) =>
                      setSettings({ ...settings, distributionDaysBefore: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusGoalDiff")}</Label>
                  <Input
                    type="number"
                    value={settings.bonusGoalDiff}
                    onChange={(e) =>
                      setSettings({ ...settings, bonusGoalDiff: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusExactScore")}</Label>
                  <Input
                    type="number"
                    value={settings.bonusExactScore}
                    onChange={(e) =>
                      setSettings({ ...settings, bonusExactScore: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusPodiumMention")}</Label>
                  <Input
                    type="number"
                    value={settings.bonusPodiumMention}
                    onChange={(e) =>
                      setSettings({ ...settings, bonusPodiumMention: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusPodiumExact")}</Label>
                  <Input
                    type="number"
                    value={settings.bonusPodiumExact}
                    onChange={(e) =>
                      setSettings({ ...settings, bonusPodiumExact: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("oddsBoost")}</Label>
                  <Input
                    type="number"
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    value={settings.oddsBoost}
                    onChange={(e) =>
                      setSettings({ ...settings, oddsBoost: Number(e.target.value) })
                    }
                    className="font-mono"
                  />
                </div>
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
