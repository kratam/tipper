"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGroup, leaveGroup, removeMember, updateGroupSettings } from "@/actions/groups";
import { GroupLeaderboardContent } from "@/components/group-leaderboard-content";
import { GroupResultsContent } from "@/components/group-results-content";
import { TipMatrix } from "@/components/tip-matrix";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLeaderboardPolling } from "@/hooks/use-leaderboard-polling";
import { useRouter } from "@/i18n/navigation";
import type { GroupRules } from "@/lib/group-rules";
import { getInitials } from "@/lib/initials";
import type { TipMatrixRound } from "@/queries/tip-matrix";

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

type GroupSettings = GroupRules;

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
  oddsAtBet: string | null;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

interface GroupDetailTabsProps {
  groupId: string;
  tournamentId: string;
  isOwner: boolean;
  isOfficial: boolean;
  canEditSettings: boolean;
  currentUserId: string;
  tournamentStatus: string;
  matchTimes: number[];
  isPublic: boolean;
  description: string | null;
  leaderboard: LeaderboardRow[];
  members: MemberInfo[];
  settings: GroupSettings;
  finishedMatches: FinishedMatch[];
  groupBets: GroupBet[];
  timeZone: string;
  initialMatrixRound: TipMatrixRound | null;
  userBadges?: Record<string, Array<{ badgeKey: string; tier: number }>>;
  userStats?: Record<string, { totalBets: number; hitRate: number }>;
}

export function GroupDetailTabs({
  groupId,
  tournamentId,
  isOwner,
  isOfficial,
  canEditSettings,
  currentUserId,
  tournamentStatus,
  matchTimes,
  isPublic,
  description,
  leaderboard,
  members,
  settings: initialSettings,
  finishedMatches,
  groupBets,
  timeZone,
  initialMatrixRound,
  userBadges,
  userStats,
}: GroupDetailTabsProps) {
  const t = useTranslations("groups");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [isPublicState, setIsPublicState] = useState(isPublic);
  const [descriptionState, setDescriptionState] = useState(description ?? "");

  // Live polling: merge fresh balance/rank data from SWR — csak meccs-ablakban
  const liveLeaderboard = useLeaderboardPolling(groupId, matchTimes, leaderboard);

  function handleSaveSettings() {
    startTransition(async () => {
      try {
        await updateGroupSettings(groupId, {
          ...settings,
          isPublic: isPublicState,
          description: descriptionState.trim() || null,
        });
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  return (
    <Tabs defaultValue="matrix">
      <TabsList className="w-full">
        <TabsTrigger value="matrix">{t("tipMatrix")}</TabsTrigger>
        <TabsTrigger value="leaderboard">{t("leaderboard")}</TabsTrigger>
        <TabsTrigger value="results">{t("results")}</TabsTrigger>
        {canEditSettings && <TabsTrigger value="settings">{t("settings")}</TabsTrigger>}
      </TabsList>

      {/* Tipp-tábla */}
      <TabsContent value="matrix" className="mt-4">
        <TipMatrix
          groupId={groupId}
          tournamentId={tournamentId}
          currentUserId={currentUserId}
          timeZone={timeZone}
          leaderboard={liveLeaderboard}
          initialRound={initialMatrixRound}
          userBadges={userBadges}
          userStats={userStats}
        />
      </TabsContent>

      {/* Leaderboard */}
      <TabsContent value="leaderboard" className="mt-4 flex flex-col gap-4">
        <GroupLeaderboardContent
          leaderboard={liveLeaderboard}
          finishedMatches={finishedMatches}
          bets={groupBets}
          currentUserId={currentUserId}
          oddsBoost={settings.oddsBoost}
          userBadges={userBadges}
        />

        {/* Leave group button (non-owners, non-official only) */}
        {!isOwner && !isOfficial && (
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
          oddsBoost={settings.oddsBoost}
        />
      </TabsContent>

      {/* Settings (owner or admin-on-official) */}
      {canEditSettings && (
        <TabsContent value="settings" className="mt-4 flex flex-col gap-4">
          {/* Public & Description — always editable */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("descriptionLabel")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-secondary p-3 px-3.5">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="isPublic" className="font-semibold text-[13.5px]">
                    {t("public")}
                  </Label>
                  <span className="text-[11.5px] text-faint">{t("publicDescription")}</span>
                </div>
                <Switch id="isPublic" checked={isPublicState} onCheckedChange={setIsPublicState} />
              </div>
              <Textarea
                value={descriptionState}
                onChange={(e) => setDescriptionState(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
              <Button onClick={handleSaveSettings} disabled={isPending}>
                {tc("save")}
              </Button>
            </CardContent>
          </Card>

          {/* Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settings")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tournamentStatus === "upcoming" ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 max-[560px]:grid-cols-1">
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("tokenPerMatch")}
                      </Label>
                      <NumericInput
                        value={settings.tokenPerMatch}
                        onChange={(val) => setSettings({ ...settings, tokenPerMatch: val })}
                        min={1}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("initialTokens")}
                      </Label>
                      <NumericInput
                        value={settings.initialTokens}
                        onChange={(val) => setSettings({ ...settings, initialTokens: val })}
                        min={0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("bonusGoalDiff")}
                      </Label>
                      <NumericInput
                        value={settings.bonusGoalDiff}
                        onChange={(val) => setSettings({ ...settings, bonusGoalDiff: val })}
                        min={0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("bonusExactScore")}
                      </Label>
                      <NumericInput
                        value={settings.bonusExactScore}
                        onChange={(val) => setSettings({ ...settings, bonusExactScore: val })}
                        min={0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("bonusPodiumMention")}
                      </Label>
                      <NumericInput
                        value={settings.bonusPodiumMention}
                        onChange={(val) => setSettings({ ...settings, bonusPodiumMention: val })}
                        min={0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("bonusPodiumExact")}
                      </Label>
                      <NumericInput
                        value={settings.bonusPodiumExact}
                        onChange={(val) => setSettings({ ...settings, bonusPodiumExact: val })}
                        min={0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("oddsBoost")}
                      </Label>
                      <NumericInput
                        value={settings.oddsBoost}
                        onChange={(val) => setSettings({ ...settings, oddsBoost: val })}
                        allowDecimal
                        min={1.0}
                        max={3.0}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold text-[12.5px] text-muted-foreground">
                        {t("lossPercentage")}
                      </Label>
                      <NumericInput
                        value={settings.lossPercentage}
                        onChange={(val) => setSettings({ ...settings, lossPercentage: val })}
                        min={0}
                        max={100}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={isPending}>
                    {tc("save")}
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">{t("settingsLocked")}</p>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("members")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 border-border border-b py-2 last:border-b-0"
                >
                  <Avatar className="size-[30px]">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium text-[13.5px]">{member.name}</span>
                  {member.userId !== currentUserId && (
                    <button
                      type="button"
                      title={t("removeMember")}
                      aria-label={t("removeMember")}
                      className="grid size-[30px] place-items-center rounded-[8px] text-faint transition-colors hover:bg-loss-soft hover:text-loss disabled:pointer-events-none disabled:opacity-50"
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={isPending}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {!isOfficial && (
            <div className="rounded-sm border border-loss-soft p-3.5">
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => handleDeleteGroup()}
                disabled={isPending}
              >
                <Trash2 className="size-4" />
                {t("deleteGroup")}
              </Button>
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
