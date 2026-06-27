"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCircle, leaveCircle } from "@/actions/circles";
import { GroupLeaderboardContent } from "@/components/group-leaderboard-content";
import { GroupResultsContent } from "@/components/group-results-content";
import { TipMatrix } from "@/components/tip-matrix";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import type { TipMatrixRound } from "@/queries/tip-matrix";

interface LeaderboardRow {
  rank: number;
  officialRank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
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

interface CircleBet {
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

interface CircleDetailTabsProps {
  circleId: string;
  isOwner: boolean;
  currentUserId: string;
  memberCount: number;
  oddsBoost: number;
  leaderboard: LeaderboardRow[];
  finishedMatches: FinishedMatch[];
  bets: CircleBet[];
  officialGroupId: string;
  timeZone: string;
  initialMatrixRound: TipMatrixRound | null;
  userBadges?: Record<string, Array<{ badgeKey: string; tier: number }>>;
  userStats?: Record<string, { totalBets: number; hitRate: number }>;
}

export function CircleDetailTabs({
  circleId,
  isOwner,
  currentUserId,
  memberCount,
  oddsBoost,
  leaderboard,
  finishedMatches,
  bets,
  officialGroupId,
  timeZone,
  initialMatrixRound,
  userBadges,
  userStats,
}: CircleDetailTabsProps) {
  const t = useTranslations("circles");
  const tGroups = useTranslations("groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLeave() {
    if (!confirm(t("leaveConfirm"))) return;
    startTransition(async () => {
      try {
        await leaveCircle(circleId);
        toast.success(t("leaveSuccess"));
        router.push("/circles");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await deleteCircle(circleId);
        toast.success(t("deleteSuccess"));
        router.push("/circles");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    });
  }

  return (
    <Tabs defaultValue="matrix">
      <TabsList className="w-full">
        <TabsTrigger value="matrix">{tGroups("tipMatrix")}</TabsTrigger>
        <TabsTrigger value="leaderboard">{tGroups("leaderboard")}</TabsTrigger>
        <TabsTrigger value="results">{tGroups("results")}</TabsTrigger>
      </TabsList>

      <TabsContent value="matrix" className="mt-4">
        <TipMatrix
          groupId={officialGroupId}
          currentUserId={currentUserId}
          timeZone={timeZone}
          leaderboard={leaderboard}
          initialRound={initialMatrixRound}
          readOnly
          userBadges={userBadges}
          userStats={userStats}
        />
      </TabsContent>

      <TabsContent value="leaderboard" className="mt-4 flex flex-col gap-4">
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noData")}</p>
        ) : (
          <GroupLeaderboardContent
            leaderboard={leaderboard}
            finishedMatches={finishedMatches}
            bets={bets}
            currentUserId={currentUserId}
            oddsBoost={oddsBoost}
            userBadges={userBadges}
          />
        )}

        <div className="flex">
          {isOwner ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
              {t("delete")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-2 text-destructive"
              onClick={handleLeave}
              disabled={isPending}
            >
              <LogOut className="size-4" />
              {t("leave")}
            </Button>
          )}
        </div>
      </TabsContent>

      <TabsContent value="results" className="mt-4">
        <GroupResultsContent
          matches={finishedMatches}
          bets={bets}
          currentUserId={currentUserId}
          memberCount={memberCount}
          oddsBoost={oddsBoost}
        />
      </TabsContent>
    </Tabs>
  );
}
