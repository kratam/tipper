"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTournament,
  finishTournament,
  triggerSync,
  updateTournamentStatus,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { useRouter } from "@/i18n/navigation";

interface TeamInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface TournamentInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  apiLeagueId: number;
  apiSeason: number;
  teams: TeamInfo[];
}

interface AdminPanelProps {
  tournaments: TournamentInfo[];
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500",
    upcoming: "bg-amber-500/10 text-amber-500",
    finished: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={colorMap[status] ?? ""}>
      {status}
    </Badge>
  );
}

export function AdminPanel({ tournaments }: AdminPanelProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState("");
  const [podiumLockDate, setPodiumLockDate] = useState("");

  // Finish tournament podium selection
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [podiumGold, setPodiumGold] = useState("");
  const [podiumSilver, setPodiumSilver] = useState("");
  const [podiumBronze, setPodiumBronze] = useState("");

  function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !leagueId || !season || !podiumLockDate) return;

    startTransition(async () => {
      try {
        await createTournament({
          name: name.trim(),
          apiLeagueId: Number(leagueId),
          apiSeason: Number(season),
          podiumLockDate: new Date(podiumLockDate),
        });
        toast.success(t("createSuccess"));
        setName("");
        setLeagueId("");
        setSeason("");
        setPodiumLockDate("");
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleStatusChange(tournamentId: string, newStatus: "upcoming" | "active" | "finished") {
    startTransition(async () => {
      try {
        await updateTournamentStatus(tournamentId, newStatus);
        toast.success(t("statusUpdateSuccess"));
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleFinishTournament(tournamentId: string) {
    if (!podiumGold || !podiumSilver || !podiumBronze) return;
    startTransition(async () => {
      try {
        await finishTournament({
          tournamentId,
          goldTeamId: podiumGold,
          silverTeamId: podiumSilver,
          bronzeTeamId: podiumBronze,
        });
        toast.success(t("statusUpdateSuccess"));
        setFinishingId(null);
        setPodiumGold("");
        setPodiumSilver("");
        setPodiumBronze("");
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleSync() {
    startTransition(async () => {
      try {
        await triggerSync();
        toast.success(t("syncSuccess"));
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sync button */}
      <Button variant="outline" className="w-fit gap-2" onClick={handleSync} disabled={isPending}>
        <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
        {t("syncNow")}
      </Button>

      {/* Create tournament form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("createTournament")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTournament} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("tournamentName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("leagueId")}</Label>
                <Input
                  type="number"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("season")}</Label>
                <Input
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("podiumLockDate")}</Label>
                <Input
                  type="datetime-local"
                  value={podiumLockDate}
                  onChange={(e) => setPodiumLockDate(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="w-fit">
              {t("createTournament")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Existing tournaments */}
      <div className="flex flex-col gap-4">
        <h2 className="font-mono text-lg font-bold">{t("existingTournaments")}</h2>
        {tournaments.map((tournament) => (
          <Card key={tournament.id}>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{tournament.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    League: {tournament.apiLeagueId} | Season: {tournament.apiSeason}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={tournament.status} />
                  {tournament.status === "upcoming" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(tournament.id, "active")}
                      disabled={isPending}
                    >
                      {t("setActive")}
                    </Button>
                  )}
                  {tournament.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFinishingId(finishingId === tournament.id ? null : tournament.id)
                      }
                      disabled={isPending}
                    >
                      {t("setFinished")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Podium selection for finishing */}
              {finishingId === tournament.id && tournament.teams.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  {[
                    { label: "\u{1F947}", value: podiumGold, onChange: setPodiumGold },
                    { label: "\u{1F948}", value: podiumSilver, onChange: setPodiumSilver },
                    { label: "\u{1F949}", value: podiumBronze, onChange: setPodiumBronze },
                  ].map((slot) => (
                    <div key={slot.label} className="flex items-center gap-2">
                      <span className="w-8 text-center text-lg">{slot.label}</span>
                      <Select value={slot.value} onValueChange={slot.onChange}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("selectTeam")} />
                        </SelectTrigger>
                        <SelectContent>
                          {tournament.teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button
                    onClick={() => handleFinishTournament(tournament.id)}
                    disabled={isPending || !podiumGold || !podiumSilver || !podiumBronze}
                    className="w-fit"
                  >
                    {t("setFinished")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
