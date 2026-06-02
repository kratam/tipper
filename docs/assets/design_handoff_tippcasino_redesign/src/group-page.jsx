// TippCasino — group detail page (groups/[gSlug]): Ranglista / Eredmények / Beállítások.
const { useState: useStateGP } = React;
const gp = React.createElement;

/* ---- form controls ---- */
function NumInput({ value, onChange, min = 0, max = 9999, step = 1, suffix }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  return gp(
    "div",
    { className: "num-input" },
    gp("button", { type: "button", onClick: dec }, gp(IconMinus, { size: 14 })),
    gp("span", { className: "nv" }, value),
    suffix && gp("span", { className: "suf" }, suffix),
    gp("button", { type: "button", onClick: inc }, gp(IconPlus, { size: 14 })),
  );
}

function Switch({ checked, onChange }) {
  return gp(
    "button",
    {
      type: "button",
      className: "switch",
      role: "switch",
      "aria-checked": checked,
      onClick: () => onChange(!checked),
    },
    gp("span", { className: "knob" }),
  );
}

function profitClass(p) {
  return p > 0 ? "up" : p < 0 ? "down" : "";
}
function profitStr(p) {
  return (p > 0 ? "+" : "") + p;
}
function medalGP(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
}

/* ---- a single match result row (used in Ranglista expansion) ---- */
function MatchRow({ m, bet }) {
  return gp(
    "div",
    { className: "bet-row" },
    gp("img", {
      className: "bet-flag",
      src: m.home.flag,
      alt: "",
      style: { width: 18, height: 13 },
    }),
    gp("img", {
      className: "bet-flag",
      src: m.away.flag,
      alt: "",
      style: { width: 18, height: 13 },
    }),
    gp(
      "div",
      { className: "br-main" },
      gp("div", { className: "br-name" }, m.home.name + " – " + m.away.name),
      gp(
        "div",
        { className: "br-meta" },
        gp("span", { className: "br-pred" }, bet.ph + "–" + bet.pa),
        gp("span", null, "vége " + m.result.h + "–" + m.result.a),
      ),
    ),
    gp(
      "div",
      { className: "br-right" },
      gp(
        "span",
        { className: "br-payout " + (bet.profit > 0 ? "win" : bet.profit < 0 ? "loss" : "") },
        profitStr(bet.profit),
      ),
      gp("span", { className: "br-stake" }, "tét " + bet.stake, gp(TokenIcon, { size: 10 })),
    ),
  );
}

/* ---- Ranglista tab ---- */
function LeaderTab({ g }) {
  const [open, setOpen] = useStateGP(null);
  return gp(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    g.leaderboard.map((row) => {
      const isOpen = open === row.u;
      const bets = g.finishedMatches
        .map((m) => ({ m, bet: m.allBets.find((b) => b.u === row.u) }))
        .filter((x) => x.bet);
      return gp(
        "div",
        { key: row.u, className: "acc-card" + (row.me ? " me" : "") },
        gp(
          "button",
          {
            className: "acc-head",
            "aria-expanded": isOpen,
            onClick: () => setOpen(isOpen ? null : row.u),
          },
          gp(
            "span",
            { className: "rank" + (medalGP(row.rank) ? " medal" : "") },
            medalGP(row.rank) || "#" + row.rank,
          ),
          gp(Avatar, { name: row.name, color: row.color, size: 28 }),
          gp(
            "span",
            { className: "nm" },
            row.name,
            row.me &&
              gp(
                "span",
                { style: { color: "var(--accent)", fontSize: 11, marginLeft: 6, fontWeight: 600 } },
                "(te)",
              ),
          ),
          gp("span", { className: "profit " + profitClass(row.profit) }, profitStr(row.profit)),
          gp(IconChevronDown, {
            size: 16,
            className: "chev",
            style: { transform: isOpen ? "rotate(180deg)" : "none" },
          }),
        ),
        isOpen &&
          gp(
            "div",
            { className: "acc-body" },
            gp("div", { className: "acc-meta" }, "Lezárt tippek"),
            bets.length === 0
              ? gp(
                  "p",
                  { className: "faint", style: { fontSize: 12.5, margin: 0 } },
                  "Nincs lezárt tipp.",
                )
              : gp(
                  "div",
                  { className: "bet-list" },
                  bets.map(({ m, bet }) => gp(MatchRow, { key: m.id, m, bet })),
                ),
          ),
      );
    }),
  );
}

/* ---- Eredmények tab — same accordion card as Ranglista ---- */
function ResultsTab({ g }) {
  const [open, setOpen] = useStateGP(g.finishedMatches[0] ? g.finishedMatches[0].id : null);
  if (!g.finishedMatches.length)
    return gp(
      "p",
      { className: "muted", style: { textAlign: "center", padding: "32px 0" } },
      "Még nincs lezárt meccs.",
    );
  return gp(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    g.finishedMatches.map((m) => {
      const isOpen = open === m.id;
      return gp(
        "div",
        { key: m.id, className: "acc-card" },
        gp(
          "button",
          {
            className: "acc-head",
            "aria-expanded": isOpen,
            onClick: () => setOpen(isOpen ? null : m.id),
          },
          gp(
            "div",
            { className: "team", style: { flex: 1 } },
            gp("img", { className: "flag", src: m.home.flag, alt: "" }),
            gp("span", { className: "tn" }, m.home.name),
          ),
          gp("span", { className: "score" }, m.result.h + " : " + m.result.a),
          gp(
            "div",
            { className: "team away", style: { flex: 1 } },
            gp("span", { className: "tn" }, m.away.name),
            gp("img", { className: "flag", src: m.away.flag, alt: "" }),
          ),
          gp(IconChevronDown, {
            size: 16,
            className: "chev",
            style: { transform: isOpen ? "rotate(180deg)" : "none" },
          }),
        ),
        isOpen &&
          gp(
            "div",
            { className: "acc-body" },
            gp("div", { className: "acc-meta" }, m.allBets.length + " tipp"),
            gp(
              "div",
              { className: "bet-list" },
              m.allBets.map((b) => gp(BetRow, { key: b.u, b, finished: true })),
            ),
          ),
      );
    }),
  );
}

/* ---- Beállítások tab ---- */
function SettingsTab({ g }) {
  const [s, setS] = useStateGP(g.settings);
  const [isPublic, setPublic] = useStateGP(g.isPublic);
  const [desc, setDesc] = useStateGP(g.description);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  const numField = (label, key, opts = {}) =>
    gp(
      "div",
      { className: "field" },
      gp("label", null, label),
      gp(NumInput, { value: s[key], onChange: (v) => set(key, v), ...opts }),
    );

  return gp(
    "div",
    null,
    gp(
      "div",
      { className: "card-section" },
      gp("h3", { className: "cs-title" }, "Pontozás"),
      gp(
        "div",
        { className: "settings-grid" },
        numField("Odds-szorzó", "oddsBoost", { step: 0.1, min: 1, max: 5, suffix: "×" }),
        numField("Veszteség visszatérítés", "lossPercentage", { step: 5, max: 100, suffix: "%" }),
        numField("Gólkülönbség bónusz", "bonusGoalDiff", { step: 1, max: 100 }),
        numField("Pontos eredmény bónusz", "bonusExactScore", { step: 1, max: 100 }),
        numField("Dobogó – említés", "bonusPodiumMention", { step: 5, max: 200 }),
        numField("Dobogó – pontos hely", "bonusPodiumExact", { step: 5, max: 200 }),
      ),
    ),
    gp(
      "div",
      { className: "card-section" },
      gp("h3", { className: "cs-title" }, "Láthatóság"),
      gp(
        "div",
        { className: "switch-row", style: { marginBottom: 14 } },
        gp(
          "div",
          null,
          gp("div", { className: "sr-label" }, "Publikus csoport"),
          gp("div", { className: "sr-sub" }, "Bárki megtalálja és csatlakozhat"),
        ),
        gp(Switch, { checked: isPublic, onChange: setPublic }),
      ),
      gp(
        "div",
        { className: "field", style: { marginBottom: 0 } },
        gp("label", null, "Leírás"),
        gp("textarea", { className: "ta", value: desc, onChange: (e) => setDesc(e.target.value) }),
      ),
    ),
    gp(
      "div",
      { className: "card-section" },
      gp("h3", { className: "cs-title" }, "Tagok · " + g.members.length),
      gp(
        "div",
        null,
        g.members.map((mem) =>
          gp(
            "div",
            { key: mem.u, className: "member-row" },
            gp(Avatar, { name: mem.name, color: mem.color, size: 30 }),
            gp("span", { className: "nm" }, mem.name),
            mem.me
              ? gp("span", { className: "you" }, "te")
              : gp(
                  "button",
                  { className: "icon-btn", title: "Eltávolítás" },
                  gp(IconTrash, { size: 15 }),
                ),
          ),
        ),
      ),
    ),
    gp(
      "div",
      { style: { display: "flex", gap: 8, marginTop: "var(--gap)" } },
      gp(Btn, { variant: "primary", style: { flex: 1 } }, "Mentés"),
      gp(Btn, { variant: "secondary" }, gp(IconLogOut, { size: 15 }), "Kilépés"),
    ),
    gp(
      "div",
      { className: "danger-zone" },
      gp("div", { className: "dz-title" }, "Veszélyzóna"),
      gp(
        Btn,
        { variant: "danger", className: "btn-danger" },
        gp(IconTrash, { size: 15 }),
        "Csoport törlése",
      ),
    ),
  );
}

/* ---- Group rules modal ---- */
function GroupRulesModal({ g, onClose }) {
  const s = g.settings;
  const KV = (k, v, hint) =>
    gp(
      "div",
      { className: "kv" },
      gp(
        "span",
        { className: "kv-k" },
        k,
        hint && gp("span", { className: "faint", style: { fontSize: 11, marginLeft: 6 } }, hint),
      ),
      gp("span", { className: "kv-v" }, v),
    );
  return gp(
    "div",
    { className: "overlay", onClick: onClose },
    gp(
      "div",
      { className: "modal help", onClick: (ev) => ev.stopPropagation() },
      gp(
        "div",
        { className: "help-hero" },
        gp("span", { className: "crown" }, gp(IconRules, { size: 20 })),
        gp(
          "div",
          { style: { flex: 1 } },
          gp("h2", null, "Csoport szabályai"),
          gp("p", null, g.name),
        ),
        gp(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          gp(IconX, { size: 18 }),
        ),
      ),
      gp(
        "div",
        { className: "help-body" },
        gp("div", { className: "section-label" }, "Kezdő egyenleg"),
        KV(
          "Induló zsetonok",
          gp(React.Fragment, null, s.initialTokens, gp(TokenIcon, { size: 11 })),
        ),
        KV(
          "Meccsenkénti keret",
          gp(React.Fragment, null, s.tokenPerMatch, gp(TokenIcon, { size: 11 })),
        ),
        gp("div", { className: "section-label", style: { marginTop: 14 } }, "Kifizetés"),
        KV("Odds-szorzó", s.oddsBoost.toFixed(1) + "×"),
        KV("Gólkülönbség bónusz", "+" + s.bonusGoalDiff),
        KV("Pontos eredmény bónusz", "+" + s.bonusExactScore),
        KV("Téves tipp visszatérítés", 100 - s.lossPercentage + "%", "a tétből"),
        gp("div", { className: "section-label", style: { marginTop: 14 } }, "Dobogó-tipp"),
        KV("Helyes csapat említése", "+" + s.bonusPodiumMention),
        KV("Pontos helyezés", "+" + s.bonusPodiumExact),
      ),
      gp(
        "div",
        { className: "help-foot" },
        gp("span", { style: { flex: 1 } }),
        gp(Btn, { variant: "primary", onClick: onClose }, "Bezárás"),
      ),
    ),
  );
}

/* ---- Group detail page ---- */
function GroupDetail({ onBack, onMatch }) {
  const g = TC_DATA.group;
  const [tab, setTab] = useStateGP("leaderboard");
  const [rules, setRules] = useStateGP(false);
  const tabs = [
    { value: "leaderboard", label: "Ranglista" },
    { value: "results", label: "Eredmények" },
    { value: "settings", label: "Beállítások" },
  ];
  return gp(
    "div",
    { className: "tc-shell" },
    gp(
      "div",
      { className: "gp-head" },
      gp(
        "div",
        { style: { minWidth: 0 } },
        gp(
          "a",
          {
            className: "gp-crumb",
            href: "#",
            onClick: (e) => {
              e.preventDefault();
              onBack();
            },
          },
          gp(IconChevR, { size: 13, style: { transform: "rotate(180deg)" } }),
          gp(IconTrophy, { size: 13 }),
          g.tournamentName,
        ),
        gp("h1", { className: "gp-title" }, g.name),
      ),
      gp(
        "div",
        { className: "gp-head-right" },
        g.missingToday > 0 &&
          gp(
            "a",
            {
              className: "gp-missing",
              href: "#",
              onClick: (e) => {
                e.preventDefault();
                onBack();
              },
            },
            gp(IconAlert, { size: 15 }),
            g.missingToday + " hiányzó tipp",
          ),
        gp(
          "button",
          {
            className: "nav-ico",
            title: "Szabályok",
            style: { color: "var(--text-muted)" },
            onClick: () => setRules(true),
          },
          gp(IconRules, { size: 18 }),
        ),
      ),
    ),
    gp(Segmented, { items: tabs, value: tab, onChange: setTab }),
    gp(
      "div",
      { style: { marginTop: "var(--gap)" } },
      tab === "leaderboard"
        ? gp(LeaderTab, { g })
        : tab === "results"
          ? gp(ResultsTab, { g, onMatch })
          : gp(SettingsTab, { g }),
    ),
    rules && gp(GroupRulesModal, { g, onClose: () => setRules(false) }),
  );
}

Object.assign(window, { GroupDetail, Switch, NumInput });
