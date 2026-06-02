// TippCasino — data recreated from the FIFA WC 2026 tournament page.
// Flags via flagcdn.com (same source the real app uses).
window.TC_DATA = (() => {
  const F = (code) => `https://flagcdn.com/w40/${code}.png`;

  // userBet result flags: 'pending' (upcoming, tip placed), 'win', 'loss'
  function match(o) {
    return o;
  }

  const days = [
    {
      key: "2026-06-11",
      label: "2026. június 11., csütörtök",
      betCount: 2,
      total: 2,
      open: true,
      matches: [
        match({
          id: "m1",
          time: "21:00",
          venue: "helyszín 15:00",
          home: { name: "Mexikó", flag: F("mx") },
          away: { name: "Dél-Afrika", flag: F("za") },
          odds: { h: "1.46", d: "4.25", a: "7.5" },
          tip: { h: 3, a: 0 },
          bets: [{ group: "Ranglista", stake: 100 }],
        }),
        match({
          id: "m2",
          time: "04:00",
          venue: "helyszín 22:00",
          home: { name: "Dél-Korea", flag: F("kr") },
          away: { name: "Csehország", flag: F("cz") },
          odds: { h: "2.7", d: "3.15", a: "2.7" },
          tip: { h: 0, a: 0 },
          bets: [{ group: "Ranglista", stake: 100 }],
        }),
      ],
    },
    {
      key: "2026-06-12",
      label: "2026. június 12., péntek",
      betCount: 2,
      total: 2,
      open: true,
      matches: [
        match({
          id: "m3",
          time: "21:00",
          venue: "helyszín 15:00",
          home: { name: "Kanada", flag: F("ca") },
          away: { name: "Bosznia-Hercegovina", flag: F("ba") },
          odds: { h: "1.8", d: "3.7", a: "4.33" },
          tip: { h: 0, a: 2 },
          bets: [{ group: "Ranglista", stake: 20 }],
        }),
        match({
          id: "m4",
          time: "03:00",
          venue: "helyszín 21:00",
          home: { name: "Amerikai Egyesült Államok", flag: F("us") },
          away: { name: "Paraguay", flag: F("py") },
          odds: { h: "2.02", d: "3.3", a: "3.85" },
          tip: { h: 2, a: 0 },
          bets: [{ group: "Ranglista", stake: 100 }],
        }),
      ],
    },
    {
      key: "2026-06-13",
      label: "2026. június 13., szombat",
      betCount: 3,
      total: 3,
      open: true,
      matches: [
        match({
          id: "m5",
          time: "21:00",
          venue: "helyszín 15:00",
          home: { name: "Katar", flag: F("qa") },
          away: { name: "Svájc", flag: F("ch") },
          odds: { h: "12", d: "6.25", a: "1.22" },
          tip: { h: 1, a: 3 },
          bets: [{ group: "Ranglista", stake: 200 }],
        }),
        match({
          id: "m6",
          time: "00:00",
          venue: "helyszín 18:00",
          home: { name: "Brazília", flag: F("br") },
          away: { name: "Marokkó", flag: F("ma") },
          odds: { h: "1.62", d: "3.85", a: "5.5" },
          tip: { h: 0, a: 0 },
          bets: [{ group: "Ranglista", stake: 56 }],
        }),
        match({
          id: "m7",
          time: "03:00",
          venue: "helyszín 21:00",
          home: { name: "Haiti", flag: F("ht") },
          away: { name: "Skócia", flag: F("gb-sct") },
          odds: { h: "6.5", d: "4.6", a: "1.46" },
          tip: { h: 0, a: 3 },
          bets: [{ group: "Ranglista", stake: 108 }],
        }),
      ],
    },
  ];

  // Collapsed future days (no tips yet) — faithful to the screenshot's long list.
  const collapsed = [
    ["2026. június 14., vasárnap", 5, 5],
    ["2026. június 15., hétfő", 0, 4],
    ["2026. június 16., kedd", 0, 3],
    ["2026. június 17., szerda", 0, 5],
    ["2026. június 18., csütörtök", 0, 4],
    ["2026. június 19., péntek", 0, 4],
    ["2026. június 20., szombat", 0, 3],
    ["2026. június 21., vasárnap", 0, 5],
    ["2026. június 22., hétfő", 0, 4],
    ["2026. június 23., kedd", 0, 4],
    ["2026. június 24., szerda", 0, 6],
    ["2026. június 25., csütörtök", 0, 6],
    ["2026. június 26., péntek", 0, 6],
    ["2026. június 27., szombat", 0, 6],
    ["2026. június 28., vasárnap", 0, 1],
    ["2026. június 29., hétfő", 0, 3],
    ["2026. június 30., kedd", 0, 3],
    ["2026. július 1., szerda", 0, 3],
    ["2026. július 2., csütörtök", 0, 3],
    ["2026. július 3., péntek", 0, 3],
    ["2026. július 4., szombat", 0, 2],
    ["2026. július 5., vasárnap", 0, 2],
    ["2026. július 6., hétfő", 0, 2],
    ["2026. július 7., kedd", 0, 2],
    ["2026. július 9., csütörtök", 0, 1],
    ["2026. július 10., péntek", 0, 1],
    ["2026. július 11., szombat", 0, 2],
    ["2026. július 14., kedd", 0, 1],
    ["2026. július 15., szerda", 0, 1],
    ["2026. július 18., szombat", 0, 1],
    ["2026. július 19., vasárnap", 0, 1],
  ].map(([label, betCount, total], i) => ({
    key: "c" + i,
    label,
    betCount,
    total,
    open: false,
    matches: [],
  }));

  const leaderboard = [
    { rank: 1, name: "Orsi Nagy", pts: 0, color: "#e08a3c" },
    { rank: 2, name: "Benő", pts: 0, color: "#5aa9e6" },
    { rank: 3, name: "Csiszi", pts: 0, color: "#3a3f4b", me: true },
    { rank: 4, name: "K2", pts: 0, color: "#e0563c" },
    { rank: 5, name: "György Szilágyi", pts: 0, color: "#7b6cc4" },
  ];

  /* ---------------- Bettors, group settings, payout model ---------------- */
  const SETTINGS = { oddsBoost: 1.0, bonusGoalDiff: 5, bonusExactScore: 10, lossPercentage: 90 };

  const BETTORS = {
    orsi: { name: "Orsi Nagy", color: "#e08a3c" },
    beno: { name: "Benő", color: "#5aa9e6" },
    csiszi: { name: "Csiszi", color: "#3a3f4b", me: true },
    k2: { name: "K2", color: "#e0563c" },
    gyuri: { name: "György Szilágyi", color: "#7b6cc4" },
    dani: { name: "Dani", color: "#2a9d8f" },
    niki: { name: "Niki", color: "#c44b9f" },
    tomi: { name: "Tomi", color: "#4a7ba6" },
  };

  const out = (h, a) => (h > a ? "1" : h === a ? "X" : "2");

  // Compute payout/profit for a finished bet using the real scoring model.
  function settle(bet, result, odds) {
    const oddsVal = parseFloat(
      odds[out(bet.ph, bet.pa)] != null
        ? { 1: odds.h, X: odds.d, 2: odds.a }[out(bet.ph, bet.pa)]
        : odds.h,
    );
    const correct = out(bet.ph, bet.pa) === out(result.h, result.a);
    if (!correct) {
      const refund = Math.round((bet.stake * (100 - SETTINGS.lossPercentage)) / 100);
      return {
        ...bet,
        payout: refund,
        profit: refund - bet.stake,
        correct: false,
        goalDiff: false,
        exact: false,
        oddsAtBet: oddsVal,
      };
    }
    const goalDiff = bet.ph - bet.pa === result.h - result.a;
    const exact = bet.ph === result.h && bet.pa === result.a;
    let payout = Math.round(bet.stake * oddsVal * SETTINGS.oddsBoost);
    if (goalDiff) payout += SETTINGS.bonusGoalDiff;
    if (exact) payout += SETTINGS.bonusExactScore;
    return {
      ...bet,
      payout,
      profit: payout - bet.stake,
      correct: true,
      goalDiff,
      exact,
      oddsAtBet: oddsVal,
    };
  }

  function buildBets(raw, result, odds) {
    const settled = raw.map((b) => {
      const who = BETTORS[b.u];
      const base = {
        ...b,
        name: who.name,
        color: who.color,
        me: !!who.me,
        outcome: out(b.ph, b.pa),
      };
      return result
        ? settle(base, result, odds)
        : { ...base, oddsAtBet: parseFloat({ 1: odds.h, X: odds.d, 2: odds.a }[out(b.ph, b.pa)]) };
    });
    if (result) {
      settled.sort((a, z) => z.profit - a.profit);
      settled.forEach((b, i) => {
        b.rank = i + 1;
      });
    } else {
      settled.sort((a, z) => z.stake - a.stake);
    }
    return settled;
  }

  // Finished matches (shown under "Lejátszott") with full bet ledgers.
  const fm1Odds = { h: "1.62", d: "3.85", a: "5.5" };
  const fm1Result = { h: 2, a: 1 };
  const fm1 = {
    id: "f1",
    status: "finished",
    time: "18:00",
    venue: "helyszín 12:00",
    home: { name: "Spanyolország", flag: F("es") },
    away: { name: "Japán", flag: F("jp") },
    odds: fm1Odds,
    result: fm1Result,
    allBets: buildBets(
      [
        { u: "orsi", ph: 2, pa: 1, stake: 200 },
        { u: "csiszi", ph: 2, pa: 0, stake: 150 },
        { u: "beno", ph: 1, pa: 1, stake: 120 },
        { u: "k2", ph: 3, pa: 1, stake: 100 },
        { u: "gyuri", ph: 0, pa: 2, stake: 80 },
        { u: "dani", ph: 2, pa: 1, stake: 240 },
        { u: "niki", ph: 1, pa: 0, stake: 60 },
        { u: "tomi", ph: 2, pa: 2, stake: 50 },
      ],
      fm1Result,
      fm1Odds,
    ),
  };

  const fm2Odds = { h: "2.7", d: "3.15", a: "2.7" };
  const fm2Result = { h: 1, a: 1 };
  const fm2 = {
    id: "f2",
    status: "finished",
    time: "21:00",
    venue: "helyszín 15:00",
    home: { name: "Horvátország", flag: F("hr") },
    away: { name: "Uruguay", flag: F("uy") },
    odds: fm2Odds,
    result: fm2Result,
    allBets: buildBets(
      [
        { u: "csiszi", ph: 1, pa: 1, stake: 180 },
        { u: "beno", ph: 1, pa: 1, stake: 220 },
        { u: "orsi", ph: 2, pa: 1, stake: 140 },
        { u: "k2", ph: 0, pa: 1, stake: 90 },
        { u: "gyuri", ph: 1, pa: 1, stake: 110 },
        { u: "dani", ph: 2, pa: 0, stake: 70 },
      ],
      fm2Result,
      fm2Odds,
    ),
  };

  const playedDays = [
    {
      key: "2026-06-10",
      label: "2026. június 10., szerda",
      betCount: 2,
      total: 2,
      open: true,
      matches: [fm1, fm2],
    },
  ];

  // Live match — in progress, no result yet.
  const liveOdds = { h: "1.8", d: "3.7", a: "4.33" };
  const liveMatch = {
    id: "l1",
    status: "live",
    time: "ÉLŐ",
    venue: "2. félidő",
    home: { name: "Kanada", flag: F("ca") },
    away: { name: "Bosznia-Hercegovina", flag: F("ba") },
    odds: liveOdds,
    allBets: buildBets(
      [
        { u: "csiszi", ph: 2, pa: 1, stake: 100 },
        { u: "orsi", ph: 1, pa: 0, stake: 160 },
        { u: "beno", ph: 2, pa: 0, stake: 130 },
        { u: "k2", ph: 1, pa: 1, stake: 90 },
        { u: "dani", ph: 3, pa: 1, stake: 75 },
        { u: "gyuri", ph: 0, pa: 1, stake: 50 },
        { u: "niki", ph: 2, pa: 2, stake: 40 },
      ],
      null,
      liveOdds,
    ),
  };

  // Surface the live match at the very top of the first upcoming day.
  days[0].matches.unshift(liveMatch);

  /* ---------------- Group (groups/[gSlug]) ---------------- */
  // Aggregate per-user profit across finished matches → group leaderboard.
  const profitByUser = {};
  [fm1, fm2].forEach((m) =>
    m.allBets.forEach((b) => {
      profitByUser[b.u] = (profitByUser[b.u] || 0) + b.profit;
    }),
  );
  const groupLeaderboard = Object.keys(BETTORS)
    .map((u) => ({
      u,
      name: BETTORS[u].name,
      color: BETTORS[u].color,
      me: !!BETTORS[u].me,
      profit: profitByUser[u] || 0,
    }))
    .sort((a, z) => z.profit - a.profit)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  /* ---------------- Teams (for podium picker) ---------------- */
  const teams = [
    { id: "br", name: "Brazília", flag: F("br") },
    { id: "fr", name: "Franciaország", flag: F("fr") },
    { id: "ar", name: "Argentína", flag: F("ar") },
    { id: "es", name: "Spanyolország", flag: F("es") },
    { id: "en", name: "Anglia", flag: F("gb-eng") },
    { id: "de", name: "Németország", flag: F("de") },
    { id: "pt", name: "Portugália", flag: F("pt") },
    { id: "nl", name: "Hollandia", flag: F("nl") },
    { id: "be", name: "Belgium", flag: F("be") },
    { id: "hr", name: "Horvátország", flag: F("hr") },
    { id: "it", name: "Olaszország", flag: F("it") },
    { id: "uy", name: "Uruguay", flag: F("uy") },
    { id: "us", name: "Amerikai Egyesült Államok", flag: F("us") },
    { id: "mx", name: "Mexikó", flag: F("mx") },
    { id: "ca", name: "Kanada", flag: F("ca") },
    { id: "jp", name: "Japán", flag: F("jp") },
    { id: "kr", name: "Dél-Korea", flag: F("kr") },
    { id: "ma", name: "Marokkó", flag: F("ma") },
    { id: "sn", name: "Szenegál", flag: F("sn") },
    { id: "ch", name: "Svájc", flag: F("ch") },
    { id: "rs", name: "Szerbia", flag: F("rs") },
    { id: "dk", name: "Dánia", flag: F("dk") },
    { id: "pl", name: "Lengyelország", flag: F("pl") },
    { id: "co", name: "Kolumbia", flag: F("co") },
  ];

  /* ---------------- Group (groups/[gSlug]) ---------------- */
  const group = {
    name: "Sörözős Liga",
    tournamentName: "FIFA WC 2026",
    isOfficial: false,
    isPublic: true,
    isOwner: true,
    description:
      "Heti meccsnézés a kocsmában + világbajnoki tippverseny. Aki a végén a csúcson van, a többiek fizetik az első kört. 🍺",
    settings: {
      oddsBoost: 1.0,
      bonusGoalDiff: 5,
      bonusExactScore: 10,
      lossPercentage: 90,
      bonusPodiumMention: 20,
      bonusPodiumExact: 20,
      initialTokens: 1000,
      tokenPerMatch: 100,
    },
    members: Object.keys(BETTORS).map((u) => ({
      u,
      name: BETTORS[u].name,
      color: BETTORS[u].color,
      me: !!BETTORS[u].me,
    })),
    leaderboard: groupLeaderboard,
    finishedMatches: [fm1, fm2],
    missingToday: 2,
    inviteCode: "SOR-2026",
  };

  /* ---------------- Public + archived groups, tournaments (groups list) ---------------- */
  const publicGroups = [
    {
      slug: "magyar-vb-tippliga",
      name: "Magyar VB Tippliga",
      tournamentName: "FIFA WC 2026",
      members: 342,
      status: "active",
      description: "A legnagyobb magyar nyelvű tippliga. Csatlakozz és mérd össze a tudásod!",
    },
    {
      slug: "office-legends",
      name: "Office Legends",
      tournamentName: "FIFA WC 2026",
      members: 64,
      status: "active",
      description: "Irodai bajnokság, baráti tét. Hetente sörre megy a játék.",
    },
    {
      slug: "kezdok-kore",
      name: "Kezdők Köre",
      tournamentName: "FIFA WC 2026",
      members: 128,
      status: "upcoming",
      description: "Új tippelőknek — alacsony tét, sok segítség.",
    },
  ];

  const archivedGroups = [
    {
      slug: "eb-2024-haverok",
      name: "EB 2024 Haverok",
      tournamentName: "EURO 2024",
      members: 6,
      status: "finished",
      profit: 1240,
      description: "Lezárult — Csiszi nyert!",
    },
    {
      slug: "vb-2022",
      name: "Katar 2022",
      tournamentName: "FIFA WC 2022",
      members: 9,
      status: "finished",
      profit: -320,
      description: "Emlékezetes torna.",
    },
  ];

  const tournaments = [
    {
      slug: "fifa-wc-2026",
      name: "FIFA WC 2026",
      status: "active",
      date: "2026. jún 11 – júl 19",
      teams: 48,
      myGroups: 3,
    },
    {
      slug: "euro-2028",
      name: "EURO 2028",
      status: "upcoming",
      date: "2028. jún",
      teams: 24,
      myGroups: 0,
    },
    {
      slug: "copa-2027",
      name: "Copa América 2027",
      status: "upcoming",
      date: "2027. nyár",
      teams: 16,
      myGroups: 0,
    },
  ];

  /* ---------------- Own groups summary (tournament page) ---------------- */
  const ownGroups = [
    {
      slug: "sorozos-liga",
      name: "Sörözős Liga",
      official: false,
      members: 8,
      myRank: 3,
      totalPlayers: 8,
      profit: 414,
      missingNext3: 0,
      top: [groupLeaderboard[0], groupLeaderboard[1], groupLeaderboard[2]],
    },
    {
      slug: "melos-haverok",
      name: "Melós Haverok",
      official: false,
      members: 5,
      myRank: 1,
      totalPlayers: 5,
      profit: 880,
      missingNext3: 2,
      top: [
        { name: "Csiszi", color: "#3a3f4b", me: true, profit: 880 },
        { name: "Tomi", color: "#4a7ba6", profit: 540 },
        { name: "Niki", color: "#c44b9f", profit: 210 },
      ],
    },
    {
      slug: "official-wc",
      name: "Hivatalos – FIFA WC 2026",
      official: true,
      members: 1240,
      myRank: 312,
      totalPlayers: 1240,
      profit: -60,
      missingNext3: 1,
      top: [
        { name: "proTipster", color: "#e0563c", profit: 4120 },
        { name: "golKiraly", color: "#2a9d8f", profit: 3890 },
        { name: "vb2026", color: "#7b6cc4", profit: 3550 },
      ],
    },
  ];

  return {
    days,
    collapsed,
    playedDays,
    leaderboard,
    settings: SETTINGS,
    group,
    teams,
    ownGroups,
    publicGroups,
    archivedGroups,
    tournaments,
    user: { name: "Csiszi", initials: "CS" },
  };
})();
