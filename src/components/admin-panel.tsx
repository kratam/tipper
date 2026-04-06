"use client";

import { Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTournament,
  finishTournament,
  triggerSync,
  updateTournamentLogo,
  updateTournamentName,
  updateTournamentPodiumLockDate,
  updateTournamentStatus,
  updateTournamentTimezone,
} from "@/actions/admin";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
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

const SUPPORTED_LEAGUES = [{ id: 111, name: "IIHF World Championship" }] as const;

const TIMEZONES = [
  "Europe/Budapest",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
] as const;

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
  logoUrl: string | null;
  timezone: string;
  podiumLockDate: Date;
  teams: TeamInfo[];
}

interface AdminPanelProps {
  tournaments: TournamentInfo[];
}

export function AdminPanel({ tournaments }: AdminPanelProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState("");
  const [podiumLockDate, setPodiumLockDate] = useState("");
  const [timezone, setTimezone] = useState("Europe/Budapest");

  // Finish tournament podium selection
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [podiumGold, setPodiumGold] = useState("");
  const [podiumSilver, setPodiumSilver] = useState("");
  const [podiumBronze, setPodiumBronze] = useState("");

  // Name + logo editing (unified)
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [logoInput, setLogoInput] = useState("");

  // Timezone editing
  const [editingTimezoneId, setEditingTimezoneId] = useState<string | null>(null);
  const [timezoneInput, setTimezoneInput] = useState("");

  // Podium lock date editing
  const [editingPodiumDateId, setEditingPodiumDateId] = useState<string | null>(null);
  const [podiumDateInput, setPodiumDateInput] = useState("");

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
          timezone,
        });
        toast.success(t("createSuccess"));
        setName("");
        setLeagueId("");
        setSeason("");
        setPodiumLockDate("");
        setTimezone("Europe/Budapest");
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

  function handleSaveDetails(tournamentId: string, originalName: string, originalLogo: string) {
    const nameChanged = nameInput.trim() !== originalName;
    const logoChanged = logoInput.trim() !== originalLogo;
    if (!nameInput.trim() || (!nameChanged && !logoChanged)) return;
    startTransition(async () => {
      try {
        if (nameChanged) {
          await updateTournamentName(tournamentId, nameInput);
        }
        if (logoChanged) {
          await updateTournamentLogo(tournamentId, logoInput);
        }
        toast.success(nameChanged ? t("nameUpdateSuccess") : t("logoUpdateSuccess"));
        setEditingDetailsId(null);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleSavePodiumDate(tournamentId: string) {
    if (!podiumDateInput) return;
    startTransition(async () => {
      try {
        await updateTournamentPodiumLockDate(tournamentId, new Date(podiumDateInput));
        toast.success(t("podiumDateUpdateSuccess"));
        setEditingPodiumDateId(null);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleSaveTimezone(tournamentId: string) {
    startTransition(async () => {
      try {
        await updateTournamentTimezone(tournamentId, timezoneInput);
        toast.success(t("timezoneUpdateSuccess"));
        setEditingTimezoneId(null);
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
                <Select value={leagueId} onValueChange={setLeagueId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectLeague")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LEAGUES.map((league) => (
                      <SelectItem key={league.id} value={String(league.id)}>
                        {league.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("season")}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={season}
                  onChange={(e) => setSeason(e.target.value.replace(/[^0-9]/g, ""))}
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
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("timezone")}</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <h2 className="font-bold font-mono text-lg">{t("existingTournaments")}</h2>
        {tournaments.map((tournament) => (
          <Card key={tournament.id}>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {tournament.logoUrl && (
                    <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={32} />
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tournament.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (editingDetailsId === tournament.id) {
                            setEditingDetailsId(null);
                          } else {
                            setEditingDetailsId(tournament.id);
                            setNameInput(tournament.name);
                            setLogoInput(tournament.logoUrl ?? "");
                          }
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                    <span className="font-mono text-muted-foreground text-xs">
                      {t("leagueId")}: {tournament.apiLeagueId} | {t("season")}:{" "}
                      {tournament.apiSeason} | {tournament.timezone}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (editingTimezoneId === tournament.id) {
                            setEditingTimezoneId(null);
                          } else {
                            setEditingTimezoneId(tournament.id);
                            setTimezoneInput(tournament.timezone);
                          }
                        }}
                      >
                        <Pencil className="inline size-3" />
                      </button>
                    </span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {t("podiumLockDate")}:{" "}
                      {new Date(tournament.podiumLockDate).toLocaleString("hu-HU")}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (editingPodiumDateId === tournament.id) {
                            setEditingPodiumDateId(null);
                          } else {
                            setEditingPodiumDateId(tournament.id);
                            // Format as datetime-local value
                            const d = new Date(tournament.podiumLockDate);
                            const pad = (n: number) => String(n).padStart(2, "0");
                            setPodiumDateInput(
                              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                            );
                          }
                        }}
                      >
                        <Pencil className="inline size-3" />
                      </button>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TournamentStatusBadge status={tournament.status} />
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

              {/* Name + logo editing */}
              {editingDetailsId === tournament.id && (
                <div className="flex flex-col gap-3 border-border border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Label className="w-16 shrink-0 text-xs">{t("tournamentName")}</Label>
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-16 shrink-0 text-xs">Logo URL</Label>
                    <Input
                      value={logoInput}
                      onChange={(e) => setLogoInput(e.target.value)}
                      placeholder={t("logoUrlPlaceholder")}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingDetailsId(null)}>
                      ✕
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleSaveDetails(tournament.id, tournament.name, tournament.logoUrl ?? "")
                      }
                      disabled={isPending || !nameInput.trim()}
                    >
                      {t("saveLogo")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Podium lock date editing */}
              {editingPodiumDateId === tournament.id && (
                <div className="flex items-center gap-2 border-border border-t pt-3">
                  <Input
                    type="datetime-local"
                    value={podiumDateInput}
                    onChange={(e) => setPodiumDateInput(e.target.value)}
                    className="flex-1 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSavePodiumDate(tournament.id)}
                    disabled={isPending || !podiumDateInput}
                  >
                    {t("saveLogo")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingPodiumDateId(null)}>
                    ✕
                  </Button>
                </div>
              )}

              {/* Timezone editing */}
              {editingTimezoneId === tournament.id && (
                <div className="flex items-center gap-2 border-border border-t pt-3">
                  <Select value={timezoneInput} onValueChange={setTimezoneInput}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => handleSaveTimezone(tournament.id)}
                    disabled={isPending}
                  >
                    {t("saveLogo")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTimezoneId(null)}>
                    ✕
                  </Button>
                </div>
              )}

              {/* Podium selection for finishing */}
              {finishingId === tournament.id && tournament.teams.length > 0 && (
                <div className="flex flex-col gap-3 border-border border-t pt-3">
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
