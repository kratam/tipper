import { describe, expect, it } from "vitest";
import {
  computePodiumStats,
  type PodiumStatBet,
  podiumHits,
  podiumPointsFromHits,
  rankPodiumBets,
  rankPodiumBetsByPaid,
} from "@/lib/podium-stats";
import { calculatePodiumPoints } from "@/lib/scoring";

const ACTUAL = { gold: "ARG", silver: "FRA", bronze: "CRO" };
const UNITS = { bonusPodiumMention: 100, bonusPodiumExact: 200 };

function bet(
  userId: string,
  gold: string,
  silver: string,
  bronze: string,
  id = `bet-${userId}`,
): PodiumStatBet {
  return { betId: id, userId, goldTeamId: gold, silverTeamId: silver, bronzeTeamId: bronze };
}

describe("podiumHits", () => {
  it("jelöli a pontos találatot pozíciónként", () => {
    const hits = podiumHits(bet("u", "ARG", "FRA", "CRO"), ACTUAL);
    expect(hits).toEqual({ gold: "exact", silver: "exact", bronze: "exact" });
  });

  it("említésnek veszi a dobogós csapatot rossz helyen", () => {
    // FRA és CRO dobogós, csak fordítva tippelte; ARG a helyén.
    const hits = podiumHits(bet("u", "ARG", "CRO", "FRA"), ACTUAL);
    expect(hits).toEqual({ gold: "exact", silver: "mention", bronze: "mention" });
  });

  it("tévesztésnek veszi a dobogóra nem került csapatot", () => {
    const hits = podiumHits(bet("u", "GER", "FRA", "BRA"), ACTUAL);
    expect(hits).toEqual({ gold: "miss", silver: "exact", bronze: "miss" });
  });
});

describe("podiumPointsFromHits", () => {
  it("említésért mention-egységet, pontos helyért mention+exact egységet ad", () => {
    expect(podiumPointsFromHits({ gold: "exact", silver: "mention", bronze: "miss" }, UNITS)).toBe(
      300 + 100,
    );
  });

  it("nulla, ha nincs egy találat sem", () => {
    expect(podiumPointsFromHits({ gold: "miss", silver: "miss", bronze: "miss" }, UNITS)).toBe(0);
  });

  // A kijelzett pontnak egyeznie kell azzal, amit a torna lezárásakor
  // ténylegesen jóváírtunk (actions/admin.ts → calculatePodiumPoints).
  it("minden tipp-kombinációra egyezik a scoring calculatePodiumPoints-szal", () => {
    const teams = ["ARG", "FRA", "CRO", "GER"];
    for (const g of teams) {
      for (const s of teams) {
        for (const b of teams) {
          const prediction = { gold: g, silver: s, bronze: b };
          const viaHits = podiumPointsFromHits(podiumHits(bet("u", g, s, b), ACTUAL), UNITS);
          expect(viaHits).toBe(calculatePodiumPoints(prediction, ACTUAL, UNITS));
        }
      }
    }
  });
});

describe("rankPodiumBets", () => {
  it("pont szerint csökkenően rangsorol, 1-alapú rangokkal", () => {
    const ranked = rankPodiumBets(
      [
        bet("a", "GER", "BRA", "ESP"), // 0 pont
        bet("b", "ARG", "FRA", "CRO"), // mind pontos
        bet("c", "ARG", "CRO", "BRA"), // arany pontos + egy említés
      ],
      ACTUAL,
      UNITS,
    );

    expect(ranked.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked[0].points).toBe(900);
    expect(ranked[2].points).toBe(0);
  });

  it("holtversenyt betId szerint bont, hogy a sorrend determinisztikus legyen", () => {
    const ranked = rankPodiumBets(
      [bet("a", "GER", "BRA", "ESP", "z"), bet("b", "GER", "BRA", "ESP", "a")],
      ACTUAL,
      UNITS,
    );
    expect(ranked.map((r) => r.betId)).toEqual(["a", "z"]);
  });

  it("üres listára üreset ad", () => {
    expect(rankPodiumBets([], ACTUAL, UNITS)).toEqual([]);
  });
});

describe("rankPodiumBetsByPaid", () => {
  // A ténylegesen jóváírt token az igazság: a csoport bónusz-százaléka vagy a
  // meccsszám a lezárás ÓTA változhatott, az újraszámolás ilyenkor félrevezet.
  it("a ledgerből kapott pontot használja, nem a mai beállításból számoltat", () => {
    const ranked = rankPodiumBetsByPaid(
      [bet("a", "ARG", "FRA", "CRO"), bet("b", "GER", "BRA", "ESP")],
      ACTUAL,
      { a: 20 },
    );

    expect(ranked[0].userId).toBe("a");
    expect(ranked[0].points).toBe(20);
    // Jóváírás nélkül 0 — a lezárás 0 pontra nem ír ledger-sort.
    expect(ranked[1].points).toBe(0);
  });

  it("a találat-jelölést továbbra is az eredményből számolja", () => {
    const ranked = rankPodiumBetsByPaid([bet("a", "ARG", "CRO", "FRA")], ACTUAL, { a: 999 });
    expect(ranked[0].hits).toEqual({ gold: "exact", silver: "mention", bronze: "mention" });
  });

  it("a jóváírás szerint rangsorol", () => {
    const ranked = rankPodiumBetsByPaid(
      [bet("a", "ARG", "FRA", "CRO"), bet("b", "GER", "BRA", "ESP")],
      ACTUAL,
      { a: 10, b: 500 },
    );
    expect(ranked.map((r) => r.userId)).toEqual(["b", "a"]);
  });
});

describe("computePodiumStats", () => {
  const bets = [
    bet("a", "ARG", "FRA", "CRO"),
    bet("b", "ARG", "BRA", "FRA"),
    bet("c", "BRA", "ARG", "CRO"),
  ];

  it("pozíciónként megszámolja, melyik csapatot hányan tippelték", () => {
    const stats = computePodiumStats(bets, ACTUAL);

    expect(stats.betCount).toBe(3);
    expect(stats.goldPicks).toEqual([
      { teamId: "ARG", count: 2 },
      { teamId: "BRA", count: 1 },
    ]);
    expect(stats.silverPicks[0]).toEqual({ teamId: "ARG", count: 1 });
  });

  it("megszámolja a tökéletes és az aranyérmes-találatokat", () => {
    const stats = computePodiumStats(bets, ACTUAL);
    expect(stats.perfectCount).toBe(1);
    expect(stats.goldCorrectCount).toBe(2);
  });

  it("holtversenyben a csapat-azonosító szerint rendez, hogy stabil legyen", () => {
    const stats = computePodiumStats(
      [bet("a", "BRA", "X", "Y"), bet("b", "ARG", "X", "Y")],
      ACTUAL,
    );
    expect(stats.goldPicks.map((p) => p.teamId)).toEqual(["ARG", "BRA"]);
  });

  it("eredmény nélkül (még nem zárt torna) nem számol találatot", () => {
    const stats = computePodiumStats(bets, null);
    expect(stats.perfectCount).toBeNull();
    expect(stats.goldCorrectCount).toBeNull();
    expect(stats.betCount).toBe(3);
    expect(stats.goldPicks.length).toBe(2);
  });
});
