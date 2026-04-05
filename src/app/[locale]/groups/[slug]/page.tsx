import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { redirect } from "@/i18n/navigation";

/**
 * Legacy redirect: /groups/[slug] → /tournaments/[tSlug]/groups/[slug]
 */
export default async function LegacyGroupRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();

  const group = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
    with: { tournament: true },
  });

  if (!group) notFound();

  redirect({ href: `/tournaments/${group.tournament.slug}/groups/${group.slug}`, locale });
}
