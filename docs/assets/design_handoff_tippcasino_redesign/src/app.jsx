// TippCasino — tournament page composition.
const { useState, useMemo } = React;
const ce = React.createElement;

/* Odds color: blue (favorite) → purple → orange (longshot). Kept from the original. */
function oddsColor(odds) {
  const v = parseFloat(odds);
  const t = Math.min(1, Math.max(0, (v - 1.2) / (7.5 - 1.2)));
  if (t < 0.5) {
    const s = t / 0.5;
    return `rgb(${Math.round(96 + 71 * s)},${Math.round(165 - 26 * s)},250)`;
  }
  const s = (t - 0.5) / 0.5;
  return `rgb(${Math.round(167 + 82 * s)},${Math.round(139 - 24 * s)},${Math.round(250 - 228 * s)})`;
}

/* ---------------- NAV ---------------- */
function Nav({ onHelp, screen, onNav }) {
  const u = TC_DATA.user;
  return ce(
    "nav",
    { className: "nav" },
    ce(
      "div",
      { className: "nav-inner" },
      ce(
        "a",
        {
          className: "brand",
          href: "#",
          onClick: (e) => {
            e.preventDefault();
            onNav("tournament");
          },
        },
        ce("img", { src: LOGO, alt: "TippCasino" }),
        ce("span", { className: "brand-name" }, "TippCasino"),
      ),
      ce(
        "div",
        { className: "nav-links" },
        ce(
          "button",
          {
            className:
              "nav-link" + (screen === "tournament" || screen === "tournaments" ? " active" : ""),
            onClick: () => onNav("tournaments"),
          },
          "Tornák",
        ),
        ce(
          "button",
          {
            className:
              "nav-link" + (screen === "groups-list" || screen === "group" ? " active" : ""),
            onClick: () => onNav("groups-list"),
          },
          "Csoportok",
        ),
      ),
      ce(
        "div",
        { className: "nav-right" },
        ce(
          "button",
          { className: "nav-ico", title: "Súgó", onClick: onHelp },
          ce(IconHelp, { size: 18 }),
        ),
        ce(
          "button",
          { className: "nav-locale" },
          ce(IconGlobe, { size: 16 }),
          ce("span", { className: "lc-text" }, "HU"),
        ),
        ce(
          "button",
          { className: "nav-user", title: "Kijelentkezés", onClick: () => onNav("landing") },
          ce(Avatar, { name: u.name, color: "#3a3f4b", size: 28 }),
          ce("span", { className: "name" }, u.name),
          ce(IconLogOut, { size: 15, style: { opacity: 0.6 } }),
        ),
      ),
    ),
  );
}

/* ---------------- PAGE HEAD ---------------- */
function PageHead() {
  return ce(
    "div",
    { className: "page-head" },
    ce(
      "div",
      { className: "badge" },
      ce(IconCrown, { size: 24, fill: "currentColor", strokeWidth: 1.4 }),
    ),
    ce("h1", null, "FIFA WC 2026"),
  );
}

/* ---------------- RIBBON (official group) ---------------- */
function Ribbon({ onOpen }) {
  const [open, setOpen] = useState(true);
  const lb = TC_DATA.leaderboard;
  return ce(
    "div",
    { className: "ribbon" },
    ce(
      "button",
      { className: "ribbon-head", onClick: () => setOpen(!open), "aria-expanded": open },
      ce(
        "span",
        { className: "crown" },
        ce(IconCrown, { size: 17, fill: "currentColor", strokeWidth: 1.4 }),
      ),
      ce(
        "span",
        { className: "ribbon-stat" },
        ce("b", null, "#3"),
        ce("span", { className: "muted" }, "  ·  "),
        ce("span", { className: "gold" }, "0"),
        ce(TokenIcon, { size: 13 }),
      ),
      ce(
        "span",
        { className: "ribbon-note" },
        ce(IconCircleCheck, { size: 15 }),
        "nincs meccs (köv. 3 nap)",
      ),
      ce(
        "span",
        { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 } },
        ce(
          "span",
          {
            className: "gold mono",
            style: { fontSize: 13, fontWeight: 700 },
            onClick: (ev) => {
              ev.stopPropagation();
              onOpen && onOpen();
            },
          },
          "Részletek →",
        ),
        ce(IconChevronDown, {
          size: 18,
          className: "faint",
          style: { transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" },
        }),
      ),
    ),
    open &&
      ce(
        "div",
        { className: "ribbon-body" },
        ce(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          ce("span", { style: { fontWeight: 700, fontSize: 14 } }, "Ranglista"),
          ce(Btn, { variant: "secondary", size: "sm" }, ce(IconRules, { size: 14 }), "Szabályok"),
        ),
        ce(
          "div",
          {
            className: "lb-list",
            role: "link",
            tabIndex: 0,
            onClick: () => onOpen && onOpen(),
            onKeyDown: (ev) => {
              if (ev.key === "Enter") onOpen && onOpen();
            },
            title: "Csoport megnyitása",
          },
          lb.map((row) =>
            ce(
              "div",
              { key: row.rank, className: "lb-row" + (row.me ? " me" : "") },
              ce("span", { className: "rank" }, "#" + row.rank),
              ce(Avatar, { name: row.name, color: row.color, size: 26 }),
              ce("span", { style: { flex: 1, fontWeight: row.me ? 700 : 500 } }, row.name),
              ce("span", { className: "pts" }, row.pts),
            ),
          ),
          ce("span", { className: "lb-open" }, "Csoport megnyitása", ce(IconChevR, { size: 14 })),
        ),
      ),
  );
}

/* ---------------- MATCH CARD ---------------- */
function MatchCard({ m, onClick }) {
  const status = m.status || "scheduled";
  const myBet =
    status === "scheduled"
      ? m.tip
        ? { ph: m.tip.h, pa: m.tip.a, stake: m.bets[0].stake }
        : null
      : m.allBets
        ? m.allBets.find((b) => b.me)
        : null;
  const settled = status === "finished" && myBet ? (myBet.correct ? "win" : "loss") : null;

  return ce(
    "button",
    { className: "match" + (status === "live" ? " live" : ""), onClick },
    ce(
      "div",
      { className: "match-time" },
      status === "live"
        ? ce("span", { className: "t live" }, ce("span", { className: "live-dot" }), "ÉLŐ")
        : status === "finished"
          ? ce("span", { className: "t" }, m.result.h + "–" + m.result.a)
          : ce("span", { className: "t" }, m.time),
      ce("span", { className: "venue" }, status === "finished" ? "vége" : m.venue),
    ),
    ce(
      "div",
      { className: "match-row" },
      ce(
        "div",
        { className: "team" },
        ce("img", { className: "flag", src: m.home.flag, alt: "", loading: "lazy" }),
        ce("span", { className: "tn" }, m.home.name),
      ),
      ce("span", { className: "match-vs" }, status === "finished" ? "" : "VS"),
      ce(
        "div",
        { className: "team away" },
        ce("span", { className: "tn" }, m.away.name),
        ce("img", { className: "flag", src: m.away.flag, alt: "", loading: "lazy" }),
      ),
    ),
    m.odds &&
      status === "scheduled" &&
      ce(
        "div",
        { className: "odds" },
        ce(
          "span",
          { className: "odd" },
          ce("span", { className: "k" }, "1"),
          ce("span", { className: "v", style: { color: oddsColor(m.odds.h) } }, m.odds.h),
        ),
        ce(
          "span",
          { className: "odd" },
          ce("span", { className: "k" }, "X"),
          ce("span", { className: "v", style: { color: oddsColor(m.odds.d) } }, m.odds.d),
        ),
        ce(
          "span",
          { className: "odd" },
          ce("span", { className: "k" }, "2"),
          ce("span", { className: "v", style: { color: oddsColor(m.odds.a) } }, m.odds.a),
        ),
      ),
    myBet
      ? ce(
          "div",
          { className: "tip" },
          ce(
            "span",
            { className: "score" + (settled ? " " + settled : "") },
            ce(IconTarget, { size: 14, style: { verticalAlign: "-2px", marginRight: 4 } }),
            myBet.ph + " – " + myBet.pa,
          ),
          ce(
            "div",
            { className: "tip-pills" },
            status === "finished"
              ? ce(
                  "span",
                  { className: "pill " + (myBet.profit > 0 ? "pill-win" : "pill-loss") },
                  (myBet.profit > 0 ? "+" : "") + myBet.profit,
                  ce(TokenIcon, { size: 11 }),
                )
              : ce(
                  "span",
                  { className: "pill" },
                  "Ranglista ",
                  String(myBet.stake),
                  ce(TokenIcon, { size: 11 }),
                ),
          ),
        )
      : ce("div", { className: "nobet-row" }, ce(IconTarget, { size: 14 }), " Nincs tipp"),
  );
}

/* ---------------- DAY ACCORDION ---------------- */
function DayGroup({ day, onMatch }) {
  const [open, setOpen] = useState(!!day.open);
  const full = day.betCount === day.total && day.total > 0;
  return ce(
    "div",
    { className: "day", "data-open": open },
    ce(
      "button",
      { className: "day-head", onClick: () => setOpen(!open), "aria-expanded": open },
      ce("span", { className: "d-label" }, day.label),
      ce(
        "span",
        { className: "d-count" + (full ? " full" : "") },
        day.betCount + "/" + day.total + " tipp",
      ),
      ce(IconChevronDown, { size: 18, className: "chev" }),
    ),
    open &&
      day.matches.length > 0 &&
      ce(
        "div",
        { className: "day-grid" },
        day.matches.map((m) => ce(MatchCard, { key: m.id, m, onClick: () => onMatch(m) })),
      ),
  );
}

/* ---------------- BET MODAL ---------------- */
function BetModal({ m, onClose }) {
  const [h, setH] = useState(m.tip ? m.tip.h : 0);
  const [a, setA] = useState(m.tip ? m.tip.a : 0);
  const [stake, setStake] = useState(m.bets && m.bets[0] ? m.bets[0].stake : 50);
  const outcome = h > a ? "1" : h === a ? "X" : "2";
  const presets = [10, 50, 100, 250];

  function Step({ val, set }) {
    return ce(
      "div",
      { className: "stepper" },
      ce(
        "button",
        { className: "step-btn", onClick: () => set(Math.min(99, val + 1)) },
        ce(IconPlus, { size: 14 }),
      ),
      ce("span", { className: "num" }, val),
      ce(
        "button",
        { className: "step-btn", onClick: () => set(Math.max(0, val - 1)) },
        ce(IconMinus, { size: 14 }),
      ),
    );
  }
  const Odd = ({ k, v }) =>
    ce(
      "div",
      { className: "odd-cell" + (outcome === k ? " sel" : "") },
      ce("span", { className: "k" }, k),
      ce("span", null, v),
    );

  return ce(
    "div",
    { className: "overlay", onClick: onClose },
    ce(
      "div",
      { className: "modal", onClick: (ev) => ev.stopPropagation() },
      ce(
        "div",
        { className: "modal-head" },
        ce(
          "span",
          { className: "mh-date" },
          "2026. június " + (m.id === "m1" || m.id === "m2" ? "11." : "13."),
        ),
        ce(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          ce(IconX, { size: 18 }),
        ),
      ),
      ce(
        "div",
        { className: "modal-body" },
        ce(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 2,
            },
          },
          ce("span", { className: "tn", style: { flex: 1, fontWeight: 600 } }, m.home.name),
          ce(
            "span",
            { className: "tn", style: { flex: 1, fontWeight: 600, textAlign: "right" } },
            m.away.name,
          ),
        ),
        ce(
          "div",
          { className: "score-set" },
          ce("img", { className: "flag", src: m.home.flag, alt: "" }),
          ce(Step, { val: h, set: setH }),
          ce(
            "span",
            { className: "mono", style: { fontSize: 22, color: "var(--text-faint)" } },
            ":",
          ),
          ce(Step, { val: a, set: setA }),
          ce("img", { className: "flag", src: m.away.flag, alt: "" }),
        ),
        m.odds &&
          ce(
            "div",
            { className: "odd-cells" },
            ce(Odd, { k: "1", v: m.odds.h }),
            ce(Odd, { k: "X", v: m.odds.d }),
            ce(Odd, { k: "2", v: m.odds.a }),
          ),
        ce("div", { className: "divider" }),
        ce(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          ce("span", { style: { fontWeight: 650, fontSize: 14 } }, "Ranglista"),
          ce(
            "span",
            { className: "mono faint", style: { fontSize: 12 } },
            "egyenleg 1000 ",
            ce(TokenIcon, { size: 11 }),
          ),
        ),
        ce(
          "div",
          { className: "stake-presets" },
          presets.map((p) =>
            ce(
              "button",
              {
                key: p,
                className: "preset" + (stake === p ? " sel" : ""),
                onClick: () => setStake(p),
              },
              p,
              ce(TokenIcon, { size: 11 }),
            ),
          ),
        ),
        ce(
          Btn,
          { variant: "primary", className: "", style: { width: "100%" }, onClick: onClose },
          m.bets && m.bets.length ? "Tipp módosítása" : "Tipp leadása",
        ),
      ),
    ),
  );
}

/* ---------------- HELP MODAL ---------------- */
function HelpModal({ onClose }) {
  const steps = [
    {
      h: "Válassz meccset",
      p: "Bármelyik közelgő meccsre kattintva megnyílik a tipp-ablak. A meccs kezdetéig szabadon módosíthatod a tipped.",
    },
    {
      h: "Tippeld meg a pontos végeredményt",
      p: "A +/– gombokkal állítsd be a végeredményt. Ebből jön a kimenetel (1 / X / 2), a gólkülönbség és a pontos eredmény is.",
    },
    {
      h: "Tedd fel a téted zsetonban",
      p: "A csoportban lévő zsetonjaidból teszel fel. A meccskezdéskor érvényes odds rögzül — ezzel számoljuk a nyereményt.",
    },
  ];
  return ce(
    "div",
    { className: "overlay", onClick: onClose },
    ce(
      "div",
      { className: "modal help", onClick: (ev) => ev.stopPropagation() },
      ce(
        "div",
        { className: "help-hero" },
        ce("span", { className: "crown" }, ce(IconHelp, { size: 22, strokeWidth: 2 })),
        ce(
          "div",
          { style: { flex: 1 } },
          ce("h2", null, "Hogyan működik?"),
          ce(
            "p",
            null,
            "Tippelj zsetonokkal a FIFA WC 2026 meccseire, gyarapítsd az egyenleged, kerülj a ranglista élére.",
          ),
        ),
        ce(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          ce(IconX, { size: 18 }),
        ),
      ),
      ce(
        "div",
        { className: "help-body" },
        steps.map((s, i) =>
          ce(
            "div",
            { key: i, className: "help-step" },
            ce("span", { className: "help-num" }, i + 1),
            ce("div", null, ce("h3", null, s.h), ce("p", null, s.p)),
          ),
        ),
        ce("div", { style: { fontWeight: 650, fontSize: 14, margin: "16px 0 0" } }, "Kifizetés"),
        ce(
          "p",
          { className: "muted", style: { margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 } },
          "Ha eltaláltad a kimenetelt (1 / X / 2), a téted az oddsszal (és a csoport szorzójával) fizet:",
        ),
        ce(
          "div",
          { className: "help-formula" },
          ce("span", { className: "f-chip" }, "tét"),
          ce("span", { className: "f-op" }, "×"),
          ce("span", { className: "f-chip" }, "odds"),
          ce("span", { className: "f-op" }, "×"),
          ce("span", { className: "f-chip" }, "szorzó"),
          ce("span", { className: "f-op f-eq" }, "="),
          ce(
            "span",
            {
              className: "f-chip",
              style: { color: "var(--accent)", borderColor: "var(--accent-line)" },
            },
            "nyeremény",
          ),
        ),
        ce(
          "div",
          null,
          ce(
            "div",
            { className: "bonus-row" },
            ce("span", { className: "bdot", style: { background: "var(--win)" } }),
            "Pontos gólkülönbség",
            ce("span", { className: "bval plus" }, "+ bónusz"),
          ),
          ce(
            "div",
            { className: "bonus-row" },
            ce("span", { className: "bdot", style: { background: "var(--accent)" } }),
            "Pontos végeredmény",
            ce("span", { className: "bval plus" }, "+ bónusz"),
          ),
          ce(
            "div",
            { className: "bonus-row" },
            ce("span", { className: "bdot", style: { background: "var(--loss)" } }),
            "Téves kimenetel",
            ce("span", { className: "bval refund" }, "részleges visszatérítés"),
          ),
        ),
        ce(
          "div",
          { className: "help-note" },
          ce(IconCircleCheck, {
            size: 15,
            style: { flex: "none", marginTop: 1, color: "var(--accent)" },
          }),
          ce(
            "span",
            null,
            "A bónuszok mértéke, az odds-szorzó és a téves tipp visszatérítése ",
            ce("b", { style: { color: "var(--text)" } }, "csoportonként állítható"),
            ". A dobogó-tippnél a helyes csapat említése és a pontos helyezés is külön pontot ér.",
          ),
        ),
      ),
      ce(
        "div",
        { className: "help-foot" },
        ce(
          "span",
          { className: "ribbon-note", style: { flex: 1 } },
          ce(IconCircleCheck, { size: 15 }),
          "A tippek a meccs kezdetéig módosíthatók.",
        ),
        ce(Btn, { variant: "primary", onClick: onClose }, "Értem"),
      ),
    ),
  );
}

/* ---------------- APP ---------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  accent: "gold",
  density: "regular",
  font: "sora",
  radius: 14,
  texture: true,
} /*EDITMODE-END*/;

const ACCENT_HEX = { gold: "#f0b850", ruby: "#f2657e", azure: "#4fb3f7", violet: "#b08bff" };
const HEX_ACCENT = {
  "#f0b850": "gold",
  "#f2657e": "ruby",
  "#4fb3f7": "azure",
  "#b08bff": "violet",
};

const FONTS = {
  sora: { ui: '"Sora", sans-serif', mono: '"JetBrains Mono", monospace', label: "Sora" },
  archivo: { ui: '"Archivo", sans-serif', mono: '"Space Mono", monospace', label: "Archivo" },
  manrope: { ui: '"Manrope", sans-serif', mono: '"IBM Plex Mono", monospace', label: "Manrope" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [filter, setFilter] = useState("upcoming");
  const [modalMatch, setModalMatch] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [screen, setScreen] = useState(() => localStorage.getItem("tc_screen") || "landing");
  const [showName, setShowName] = useState(false);
  React.useEffect(() => {
    localStorage.setItem("tc_screen", screen);
  }, [screen]);

  const upcomingDays = useMemo(() => [...TC_DATA.days, ...TC_DATA.collapsed], []);
  const days =
    filter === "played"
      ? TC_DATA.playedDays
      : filter === "all"
        ? [...TC_DATA.playedDays, ...upcomingDays]
        : upcomingDays;
  const showPodium = filter === "podium";

  const font = FONTS[t.font] || FONTS.sora;
  const rootStyle = {
    "--radius": t.radius + "px",
    "--font-ui": font.ui,
    "--font-mono": font.mono,
  };

  const filterItems = [
    { value: "upcoming", label: "Közelgő" },
    { value: "played", label: "Lejátszott" },
    { value: "all", label: "Mind" },
    {
      value: "podium",
      label: "Dobogósok",
      icon: ce(IconCheck, { size: 15, style: { color: "var(--win)" } }),
    },
  ];

  return ce(
    "div",
    {
      className: "tc-root",
      "data-theme": t.theme,
      "data-accent": t.accent,
      "data-density": t.density,
      style: rootStyle,
    },
    ce("div", { className: "tc-bg", style: { opacity: t.texture ? 1 : 1 } }),
    screen === "landing"
      ? ce(
          React.Fragment,
          null,
          ce(Landing, { onSignIn: () => setShowName(true) }),
          showName &&
            ce(NameModal, {
              onDone: () => {
                setShowName(false);
                setScreen("tournaments");
              },
            }),
        )
      : ce(
          React.Fragment,
          null,
          ce(Nav, { onHelp: () => setShowHelp(true), screen, onNav: setScreen }),
          screen === "group"
            ? ce(GroupDetail, { onBack: () => setScreen("groups-list"), onMatch: setModalMatch })
            : screen === "groups-list"
              ? ce(GroupsList, { onOpenGroup: () => setScreen("group") })
              : screen === "tournaments"
                ? ce(TournamentPicker, { onPick: () => setScreen("tournament") })
                : ce(
                    "div",
                    { className: "tc-shell" },
                    ce(PageHead),
                    ce(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "var(--gap)" } },
                      ce(Ribbon, { onOpen: () => setScreen("group") }),
                      ce(Segmented, { items: filterItems, value: filter, onChange: setFilter }),
                      showPodium
                        ? ce(PodiumTab)
                        : days.length === 0
                          ? ce(
                              "p",
                              {
                                className: "muted",
                                style: { textAlign: "center", padding: "48px 0" },
                              },
                              "Nincs lejátszott meccs.",
                            )
                          : ce(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "var(--gap)",
                                },
                              },
                              days.map((d) =>
                                ce(DayGroup, { key: d.key, day: d, onMatch: setModalMatch }),
                              ),
                            ),
                      !showPodium &&
                        filter !== "played" &&
                        ce(
                          "div",
                          { style: { marginTop: 28 } },
                          ce(OwnGroupsSummary, { onOpen: () => setScreen("group") }),
                        ),
                    ),
                  ),
          modalMatch &&
            (modalMatch.status === "finished" || modalMatch.status === "live"
              ? ce(MatchResultModal, { m: modalMatch, onClose: () => setModalMatch(null) })
              : ce(BetModal, { m: modalMatch, onClose: () => setModalMatch(null) })),
          showHelp && ce(HelpModal, { onClose: () => setShowHelp(false) }),
        ),

    /* ---- Tweaks ---- */
    ce(
      TweaksPanel,
      null,
      ce(TweakSection, { label: "Téma" }),
      ce(TweakRadio, {
        label: "Mód",
        value: t.theme,
        options: [
          { value: "dark", label: "Sötét" },
          { value: "light", label: "Világos" },
        ],
        onChange: (v) => setTweak("theme", v),
      }),
      ce(TweakToggle, {
        label: "Háttér textúra",
        value: t.texture,
        onChange: (v) => setTweak("texture", v),
      }),
      ce(TweakColor, {
        label: "Accent",
        value: ACCENT_HEX[t.accent],
        options: ["#f0b850", "#f2657e", "#4fb3f7", "#b08bff"],
        onChange: (hex) => setTweak("accent", HEX_ACCENT[hex] || "gold"),
      }),
      ce(TweakSection, { label: "Elrendezés" }),
      ce(TweakRadio, {
        label: "Sűrűség",
        value: t.density,
        options: [
          { value: "compact", label: "Kompakt" },
          { value: "regular", label: "Normál" },
          { value: "comfy", label: "Levegős" },
        ],
        onChange: (v) => setTweak("density", v),
      }),
      ce(TweakSlider, {
        label: "Sarkok",
        value: t.radius,
        min: 4,
        max: 24,
        step: 1,
        unit: "px",
        onChange: (v) => setTweak("radius", v),
      }),
      ce(TweakSection, { label: "Tipográfia" }),
      ce(TweakRadio, {
        label: "Font",
        value: t.font,
        options: [
          { value: "sora", label: "Sora" },
          { value: "archivo", label: "Archivo" },
          { value: "manrope", label: "Manrope" },
        ],
        onChange: (v) => setTweak("font", v),
      }),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(ce(App));
