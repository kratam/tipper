import "server-only";
import { db } from "@/db";
import { circleMembers, groupMembers } from "@/db/schema";
import { localizePath } from "@/lib/join-url";
import { distributeInitialTokens } from "@/lib/tokens";
import { getCircleByInviteCode } from "@/queries/circles";
import { getGroupByInviteCode } from "@/queries/groups";

type InviteGroup = NonNullable<Awaited<ReturnType<typeof getGroupByInviteCode>>>;
type InviteCircle = NonNullable<Awaited<ReturnType<typeof getCircleByInviteCode>>>;

/** Idempotens csoport-belépés adott userrel; nincs redirect. */
export async function joinGroupIdempotent(userId: string, group: InviteGroup): Promise<void> {
  // Race-safe: a (group_id, user_id) unique index miatt párhuzamos hívás sem
  // duplikál; a már létező tagság némán kimarad.
  await db.insert(groupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();

  // distributeInitialTokens maga idempotens (kihagyja a meglévő ledger-sorokat),
  // ezért MINDIG lefuttatjuk — így egy korábbi, token-osztás közben elhalt belépés
  // újrapróbálkozáskor pótolja a hiányzó tokeneket.
  await distributeInitialTokens(
    userId,
    group.id,
    group.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
    group.tournament.timezone,
  );
}

/** Idempotens kör-belépés adott userrel; nincs redirect. */
export async function joinCircleIdempotent(userId: string, circle: InviteCircle): Promise<void> {
  // Race-safe idempotens belépés a (circle_id, user_id) unique index alapján.
  await db.insert(circleMembers).values({ circleId: circle.id, userId }).onConflictDoNothing();
}

export type ClaimResult = { ok: true; redirectPath: string } | { ok: false; reason: "not_found" };

/**
 * A meghívó kódot feloldja (group VAGY circle), idempotensen beléptet, és
 * visszaadja a locale-helyes cél-útvonalat. Ismeretlen kód → not_found.
 */
export async function claimInvite(
  userId: string,
  code: string,
  locale: string,
): Promise<ClaimResult> {
  const group = await getGroupByInviteCode(code);
  if (group) {
    await joinGroupIdempotent(userId, group);
    return {
      ok: true,
      redirectPath: localizePath(
        locale,
        `/tournaments/${group.tournament.slug}/groups/${group.slug}`,
      ),
    };
  }

  const circle = await getCircleByInviteCode(code);
  if (circle) {
    await joinCircleIdempotent(userId, circle);
    return { ok: true, redirectPath: localizePath(locale, "/circles") };
  }

  return { ok: false, reason: "not_found" };
}
