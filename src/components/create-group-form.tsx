"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createGroup } from "@/actions/groups";
import { TournamentLogo } from "@/components/tournament-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { isReservedOfficialSlug } from "@/lib/official-group";
import { slugify } from "@/lib/utils";

interface CreateGroupFormProps {
  tournaments: { id: string; name: string; slug: string; logoUrl: string | null }[];
}

export function CreateGroupForm({ tournaments }: CreateGroupFormProps) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState({
    tokenPerMatch: 100,
    initialTokens: 200,
    bonusGoalDiffPct: 2,
    bonusExactScorePct: 3,
    bonusPodiumMentionPct: 1.5,
    bonusPodiumExactPct: 3,
    oddsBoost: 1.0,
    lossPercentage: 90,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !tournamentId) return;

    // Client-side reserved name check — server-side throws can't surface
    // friendly messages through Next.js Server Action error handling.
    if (isReservedOfficialSlug(slugify(name.trim()))) {
      setNameError(t("officialGroupNameReserved"));
      toast.error(t("officialGroupNameReserved"));
      return;
    }
    setNameError(null);

    startTransition(async () => {
      try {
        const group = await createGroup({
          name: name.trim(),
          tournamentId,
          isPublic,
          description: description.trim() || undefined,
          ...settings,
        });
        toast.success(t("createSuccess"));
        const selectedTournament = tournaments.find((t) => t.id === tournamentId);
        router.push(`/tournaments/${selectedTournament?.slug}/groups/${group.slug}`);
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
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder={t("name")}
              required
              minLength={2}
              aria-invalid={nameError ? true : undefined}
            />
            {nameError && <p className="text-destructive text-xs">{nameError}</p>}
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
                        <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={20} />
                      )}
                      {tournament.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="isPublic">{t("public")}</Label>
              <span className="text-muted-foreground text-xs">{t("publicDescription")}</span>
            </div>
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>

          {/* Collapsible advanced settings */}
          <button
            type="button"
            className="inline-flex items-center gap-2 self-start text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {t("advanced")}
          </button>

          {showAdvanced && (
            <Card className="bg-surface-2">
              <CardContent className="grid grid-cols-2 gap-4 pt-6">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("tokenPerMatch")}</Label>
                  <NumericInput
                    value={settings.tokenPerMatch}
                    onChange={(val) => setSettings({ ...settings, tokenPerMatch: val })}
                    min={1}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("initialTokens")}</Label>
                  <NumericInput
                    value={settings.initialTokens}
                    onChange={(val) => setSettings({ ...settings, initialTokens: val })}
                    min={0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusGoalDiff")}</Label>
                  <NumericInput
                    value={settings.bonusGoalDiffPct}
                    onChange={(val) => setSettings({ ...settings, bonusGoalDiffPct: val })}
                    min={0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusExactScore")}</Label>
                  <NumericInput
                    value={settings.bonusExactScorePct}
                    onChange={(val) => setSettings({ ...settings, bonusExactScorePct: val })}
                    min={0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusPodiumMention")}</Label>
                  <NumericInput
                    value={settings.bonusPodiumMentionPct}
                    onChange={(val) => setSettings({ ...settings, bonusPodiumMentionPct: val })}
                    min={0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("bonusPodiumExact")}</Label>
                  <NumericInput
                    value={settings.bonusPodiumExactPct}
                    onChange={(val) => setSettings({ ...settings, bonusPodiumExactPct: val })}
                    min={0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("oddsBoost")}</Label>
                  <NumericInput
                    value={settings.oddsBoost}
                    onChange={(val) => setSettings({ ...settings, oddsBoost: val })}
                    allowDecimal
                    min={1.0}
                    max={3.0}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t("lossPercentage")}</Label>
                  <NumericInput
                    value={settings.lossPercentage}
                    onChange={(val) => setSettings({ ...settings, lossPercentage: val })}
                    min={0}
                    max={100}
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
