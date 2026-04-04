"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGroup, leaveGroup, removeMember, updateGroupSettings } from "@/actions/groups";
import { GroupResultsContent } from "@/components/group-results-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaderboardPolling } from "@/hooks/use-leaderboard-polling";
import { useRouter } from "@/i18n/navigation";

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface MemberInfo {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
}

interface GroupSettings {
  tokenPerMatch: number;
  initialTokens: number;
  distributionDaysBefore: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
}

interface FinishedMatch {
  id: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  round: string;
}

interface GroupBet {
  matchId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

interface GroupDetailTabsProps {
  groupId: string;
  isOwner: boolean;
  currentUserId: string;
  tournamentStatus: string;
  leaderboard: LeaderboardRow[];
  members: MemberInfo[];
  settings: GroupSettings;
  finishedMatches: FinishedMatch[];
  groupBets: GroupBet[];
}

export function GroupDetailTabs({
  groupId,
  isOwner,
  currentUserId,
  tournamentStatus,
  leaderboard,
  members,
  settings: initialSettings,
  finishedMatches,
  groupBets,
}: GroupDetailTabsProps) {
  const t = useTranslations("groups");
  const tLeaderboard = useTranslations("leaderboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);

  // Live polling: merge fresh balance/rank data from SWR
  const liveLeaderboard = useLeaderboardPolling(groupId, tournamentStatus, leaderboard);

  function handleSaveSettings() {
    startTransition(async () => {
      try {
        await updateGroupSettings(groupId, settings);
        toast.success(tc("save"));
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleRemoveMember(userId: string) {
    startTransition(async () => {
      try {
        await removeMember(groupId, userId);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleDeleteGroup() {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await deleteGroup(groupId);
        toast.success(t("deleteSuccess"));
        router.push("/groups");
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  function handleLeaveGroup() {
    startTransition(async () => {
      try {
        await leaveGroup(groupId);
        toast.success(t("leaveSuccess"));
        router.push("/groups");
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <Tabs defaultValue="leaderboard">
      <TabsList>
        <TabsTrigger value="leaderboard">{t("leaderboard")}</TabsTrigger>
        <TabsTrigger value="results">{t("results")}</TabsTrigger>
        {isOwner && <TabsTrigger value="settings">{t("settings")}</TabsTrigger>}
      </TabsList>

      {/* Leaderboard */}
      <TabsContent value="leaderboard" className="mt-4 flex flex-col gap-4">
        {/* Leaderboard table */}
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
                <span className="w-10">{tLeaderboard("rank")}</span>
                <span className="flex-1">{tLeaderboard("player")}</span>
                <span className="w-20 text-right font-mono">{tLeaderboard("profit")}</span>
              </div>
              {/* Rows */}
              {liveLeaderboard.map((row) => {
                const isCurrentUser = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-4 px-4 py-3 ${
                      isCurrentUser ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20" : ""
                    }`}
                  >
                    <span className="w-10 font-mono text-sm font-bold">#{row.rank}</span>
                    <div className="flex flex-1 items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={row.userAvatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {row.userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{row.userName}</span>
                    </div>
                    <span className="w-20 text-right font-mono text-sm font-bold text-amber-500">
                      {row.profit}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Leave group button (non-owners only) */}
        {!isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-2 text-destructive"
            onClick={handleLeaveGroup}
            disabled={isPending}
          >
            <LogOut className="size-4" />
            {t("leave")}
          </Button>
        )}
      </TabsContent>

      {/* Results */}
      <TabsContent value="results" className="mt-4">
        <GroupResultsContent
          matches={finishedMatches}
          bets={groupBets}
          currentUserId={currentUserId}
          memberCount={members.length}
        />
      </TabsContent>

      {/* Settings (owner only) */}
      {isOwner && (
        <TabsContent value="settings" className="mt-4 flex flex-col gap-4">
          {/* Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settings")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tournamentStatus === "upcoming" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{t("tokenPerMatch")}</Label>
                      <Input
                        type="number"
                        value={settings.tokenPerMatch}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            tokenPerMatch: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            initialTokens: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            distributionDaysBefore: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            bonusGoalDiff: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            bonusExactScore: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            bonusPodiumMention: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            bonusPodiumExact: Number(e.target.value),
                          })
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
                          setSettings({
                            ...settings,
                            oddsBoost: Number(e.target.value),
                          })
                        }
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={isPending}>
                    {tc("save")}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("settingsLocked")}</p>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("members")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarImage src={member.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  {member.userId !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-1 size-3" />
                      {t("removeMember")}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Separator />

          {/* Delete group */}
          <Button
            variant="destructive"
            size="sm"
            className="w-fit gap-2"
            onClick={() => handleDeleteGroup()}
            disabled={isPending}
          >
            <Trash2 className="size-4" />
            {t("deleteGroup")}
          </Button>
        </TabsContent>
      )}
    </Tabs>
  );
}
