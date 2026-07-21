import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { groupMembers, groups, podiumBets, teams, tokenLedger, tournaments } from "@/db/schema";
import { pickGoogleAvatarUrl } from "@/lib/avatar-detect";
import { gravatarHash } from "@/lib/gravatar-hash";
import type { Locale } from "@/lib/providers/types";
import { withTeamDisplay } from "@/queries/team-display";

export interface PodiumTeamDisplay {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface PodiumMemberBet {
  betId: string;
  userId: string;
  userName: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  gravatarHash: string | null;
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

export interface GroupPodiumData {
  /** A torna tényleges dobogója; `null`, amíg nincs lezárva (nincs beírt eredmény). */
  actual: { gold: PodiumTeamDisplay; silver: PodiumTeamDisplay; bronze: PodiumTeamDisplay } | null;
  /** A csoport tagjainak dobogó-tippjei. */
  bets: PodiumMemberBet[];
  /** Az érintett csapatok megjelenítési adatai id szerint (tipp + eredmény). */
  teamsById: Record<string, PodiumTeamDisplay>;
  /**
   * A ténylegesen jóváírt dobogó-bónusz játékosonként (ledger). NEM újraszámolt
   * érték: a csoport bónusz-százaléka és a meccsszám a lezárás óta változhatott,
   * és a ranglista is ezt a számot tartalmazza.
   */
  paidByUser: Record<string, number>;
}

/**
 * Csoportonként a ténylegesen jóváírt dobogó-bónusz játékosonként — a
 * TipMatrix záró oszlopához.
 *
 * Szándékosan a ledgerből olvas (nem újraszámol): pontosan azt mutatja, amit a
 * torna lezárása a játékosnak adott, így nem tud elcsúszni a ranglistától akkor
 * sem, ha a csoport bónusz-százalékát utólag átállítják.
 */
export async function getPodiumBonusByGroup(
  tournamentId: string,
  groupIds: string[],
): Promise<Record<string, Record<string, number>>> {
  if (groupIds.length === 0) return {};

  const rows = await db
    .select({
      groupId: tokenLedger.groupId,
      userId: tokenLedger.userId,
      amount: sql<number>`SUM(${tokenLedger.amount})::int`,
    })
    .from(tokenLedger)
    .innerJoin(podiumBets, eq(tokenLedger.referenceId, podiumBets.id))
    .where(
      and(
        eq(tokenLedger.tournamentId, tournamentId),
        inArray(tokenLedger.groupId, groupIds),
        eq(tokenLedger.type, "win"),
      ),
    )
    .groupBy(tokenLedger.groupId, tokenLedger.userId);

  const byGroup: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    if (!row.groupId) continue;
    byGroup[row.groupId] ??= {};
    byGroup[row.groupId][row.userId] = Number(row.amount);
  }
  return byGroup;
}

/**
 * A dobogó-fül adata egy csoport nézetében: a torna végeredménye, a csoporttagok
 * tippjei és a ténylegesen kiosztott bónusz.
 */
export async function getGroupPodiumData(
  tournamentId: string,
  groupId: string,
): Promise<GroupPodiumData | null> {
  const locale = (await getLocale()) as Locale;

  const [tournament, group] = await Promise.all([
    db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: {
        goldTeamId: true,
        silverTeamId: true,
        bronzeTeamId: true,
        useFlagFallback: true,
      },
    }),
    db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      columns: { id: true },
    }),
  ]);

  if (!tournament || !group) return null;

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    columns: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);

  const rawBets = memberIds.length
    ? await db.query.podiumBets.findMany({
        where: and(
          eq(podiumBets.tournamentId, tournamentId),
          inArray(podiumBets.userId, memberIds),
        ),
        with: { user: true },
      })
    : [];

  const teamIds = new Set<string>();
  for (const bet of rawBets) {
    teamIds.add(bet.goldTeamId);
    teamIds.add(bet.silverTeamId);
    teamIds.add(bet.bronzeTeamId);
  }
  for (const id of [tournament.goldTeamId, tournament.silverTeamId, tournament.bronzeTeamId]) {
    if (id) teamIds.add(id);
  }

  const teamRows = teamIds.size
    ? await db.query.teams.findMany({
        where: inArray(teams.id, [...teamIds]),
        columns: { id: true, name: true, logoUrl: true },
      })
    : [];

  const teamsById: Record<string, PodiumTeamDisplay> = {};
  for (const row of teamRows) {
    teamsById[row.id] = withTeamDisplay(row, locale, tournament.useFlagFallback);
  }

  const { goldTeamId, silverTeamId, bronzeTeamId } = tournament;
  const actual =
    goldTeamId && silverTeamId && bronzeTeamId
      ? {
          gold: teamsById[goldTeamId],
          silver: teamsById[silverTeamId],
          bronze: teamsById[bronzeTeamId],
        }
      : null;

  return {
    actual,
    bets: rawBets.map((bet) => ({
      betId: bet.id,
      userId: bet.userId,
      userName: bet.user.name,
      userDisplayName: bet.user.displayName,
      userAvatarUrl: pickGoogleAvatarUrl(bet.user.avatarUrl, bet.user.avatarIsReal),
      gravatarHash: gravatarHash(bet.user.email),
      goldTeamId: bet.goldTeamId,
      silverTeamId: bet.silverTeamId,
      bronzeTeamId: bet.bronzeTeamId,
    })),
    teamsById,
    paidByUser: (await getPodiumBonusByGroup(tournamentId, [groupId]))[groupId] ?? {},
  };
}
