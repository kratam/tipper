import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, circles, groups } from "@/db/schema";

/** A user köreinek listája tagokkal és owner-rel (kezelőoldal + tournament-kártyák). */
export async function getUserCircles(userId: string) {
  const memberships = await db.query.circleMembers.findMany({
    where: eq(circleMembers.userId, userId),
    with: {
      circle: {
        with: {
          owner: true,
          members: { with: { user: true } },
        },
      },
    },
  });
  return memberships.map((m) => m.circle);
}

/** Egy kör slug alapján, tagokkal (detail oldal + member-check). */
export async function getCircleBySlug(slug: string) {
  return db.query.circles.findFirst({
    where: eq(circles.slug, slug),
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });
}

/** Kör meghívókód alapján (join). */
export async function getCircleByInviteCode(code: string) {
  return db.query.circles.findFirst({
    where: eq(circles.inviteCode, code),
  });
}

/** A kör tagjainak userId halmaza (szűrőhöz). */
export async function getCircleMemberIds(circleId: string): Promise<Set<string>> {
  const rows = await db.query.circleMembers.findMany({
    where: eq(circleMembers.circleId, circleId),
    columns: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/** Egy tournament hivatalos csoportja (a szűrt nézet forrása). */
export async function getOfficialGroupByTournamentId(tournamentId: string) {
  return db.query.groups.findFirst({
    where: and(eq(groups.tournamentId, tournamentId), eq(groups.isOfficial, true)),
  });
}
