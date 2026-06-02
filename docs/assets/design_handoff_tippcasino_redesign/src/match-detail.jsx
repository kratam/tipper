// TippCasino — live / finished match detail modal (Tippek + Statisztika tabs).
const { useState: useStateMD } = React;
const md = React.createElement;

const OUT_COLOR = { 1: "var(--win)", X: "var(--text-faint)", 2: "var(--loss)" };
const OUT_GRAD = {
  1: "linear-gradient(180deg, var(--win), color-mix(in oklab, var(--win) 78%, black))",
  X: "linear-gradient(180deg, var(--text-faint), color-mix(in oklab, var(--text-faint) 72%, black))",
  2: "linear-gradient(180deg, var(--loss), color-mix(in oklab, var(--loss) 78%, black))",
};
const OUT_LABEL = { 1: "Hazai", X: "Döntetlen", 2: "Vendég" };

function fmtTok(n) {
  if (n >= 10000) return Math.round(n / 100) / 10 + "k";
  return String(n);
}
function medal(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
}

/* ---- one bettor row ---- */
function BetRow({ b, finished }) {
  return md(
    "div",
    { className: "bet-row" + (b.me ? " me" : "") },
    finished
      ? md(
          "span",
          { className: medal(b.rank) ? "br-medal" : "br-rank" },
          medal(b.rank) || "#" + b.rank,
        )
      : md("span", { className: "br-rank" }, "·"),
    md(Avatar, { name: b.name, color: b.color, size: 26 }),
    md(
      "div",
      { className: "br-main" },
      md("div", { className: "br-name" }, b.name),
      md(
        "div",
        { className: "br-meta" },
        md("span", { className: "br-pred" }, b.ph + "–" + b.pa),
        md("span", null, "@ " + (b.oddsAtBet != null ? b.oddsAtBet.toFixed(2) : "—")),
      ),
    ),
    md(
      "div",
      { className: "br-right" },
      finished
        ? md(
            "span",
            { className: "br-payout " + (b.profit > 0 ? "win" : b.profit < 0 ? "loss" : "") },
            (b.profit > 0 ? "+" : "") + b.profit,
          )
        : md("span", { className: "br-payout" }, fmtTok(b.stake)),
      md(
        "span",
        { className: "br-stake" },
        finished ? "tét " + fmtTok(b.stake) : "nyeremény " + Math.round(b.stake * b.oddsAtBet),
        md(TokenIcon, { size: 10 }),
      ),
    ),
  );
}

/* ---- TIPS tab ---- */
function TipsTab({ bets, finished }) {
  const [expanded, setExpanded] = useStateMD(false);
  if (!bets.length)
    return md(
      "p",
      { className: "muted", style: { textAlign: "center", padding: "16px 0", fontSize: 13 } },
      "Még nincs tipp.",
    );

  if (!finished) {
    const visible = expanded ? bets : bets.slice(0, 5);
    return md(
      "div",
      { className: "bet-list" },
      visible.map((b) => md(BetRow, { key: b.u, b, finished: false })),
      bets.length > 5 &&
        md(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { width: "100%", borderStyle: "dashed", borderColor: "var(--border)" },
            onClick: () => setExpanded(!expanded),
          },
          expanded ? "Összecsuk" : "Összes (" + bets.length + ")",
        ),
    );
  }

  // finished: podium (top 3) + window around me
  const meIdx = bets.findIndex((b) => b.me);
  const podium = bets.slice(0, 3);
  let neighbors = [];
  let hiddenBetween = 0;
  if (meIdx > 3) {
    neighbors = bets.slice(Math.max(3, meIdx - 1), meIdx + 2);
    hiddenBetween = Math.max(0, neighbors[0].rank - 1 - 3);
  }
  const allShown = expanded;
  const rows = allShown ? bets : null;

  return md(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    allShown
      ? md(
          "div",
          { className: "bet-list" },
          rows.map((b) => md(BetRow, { key: b.u, b, finished: true })),
        )
      : md(
          React.Fragment,
          null,
          md(
            "div",
            null,
            md("div", { className: "section-label" }, "Dobogó"),
            md(
              "div",
              { className: "bet-list" },
              podium.map((b) => md(BetRow, { key: b.u, b, finished: true })),
            ),
          ),
          neighbors.length > 0 &&
            md(
              "div",
              null,
              hiddenBetween > 0 &&
                md("div", { className: "list-divider" }, "··· +" + hiddenBetween + " játékos ···"),
              md("div", { className: "section-label" }, "Körülötted"),
              md(
                "div",
                { className: "bet-list" },
                neighbors.map((b) => md(BetRow, { key: b.u, b, finished: true })),
              ),
            ),
        ),
    bets.length > (allShown ? 0 : podium.length + neighbors.length) &&
      md(
        "button",
        {
          className: "btn btn-ghost btn-sm",
          style: { width: "100%", borderStyle: "dashed", borderColor: "var(--border)" },
          onClick: () => setExpanded(!allShown),
        },
        allShown ? "Összecsuk" : "Teljes ranglista (" + bets.length + ")",
      ),
  );
}

/* ---- STATS tab ---- */
function StackedBar({ slices, metric }) {
  const total = slices.reduce((s, x) => s + metric(x), 0);
  if (!total) return md("div", { className: "stacked empty" });
  return md(
    "div",
    { className: "stacked" },
    slices.map((s) => {
      const v = metric(s);
      if (!v) return null;
      return md(
        "span",
        { key: s.key, className: "seg-fill", style: { flex: v, background: OUT_GRAD[s.key] } },
        md("span", { className: "seg-tag" }, s.key),
      );
    }),
  );
}

function StatsTab({ bets, finished, result }) {
  if (!bets.length)
    return md(
      "p",
      { className: "muted", style: { textAlign: "center", padding: "16px 0", fontSize: 13 } },
      "Még nincs tipp.",
    );

  const keys = ["1", "X", "2"];
  const dist = keys.map((k) => {
    const group = bets.filter((b) => b.outcome === k);
    return { key: k, count: group.length, totalStake: group.reduce((s, b) => s + b.stake, 0) };
  });
  const totalStake = bets.reduce((s, b) => s + b.stake, 0);
  const avgStake = Math.round(totalStake / bets.length);
  const biggest = bets.reduce((m, b) => (b.stake > m.stake ? b : m), bets[0]);

  // most common tip
  const tipCounts = {};
  bets.forEach((b) => {
    const k = b.ph + "–" + b.pa;
    tipCounts[k] = (tipCounts[k] || 0) + 1;
  });
  const mostCommon = Object.entries(tipCounts).sort((a, z) => z[1] - a[1])[0];
  const avgH = (bets.reduce((s, b) => s + b.ph, 0) / bets.length).toFixed(1);
  const avgA = (bets.reduce((s, b) => s + b.pa, 0) / bets.length).toFixed(1);
  const exactCount = finished ? bets.filter((b) => b.exact).length : null;
  const winnerCount = finished ? bets.filter((b) => b.correct).length : null;

  const KV = (k, v) =>
    md(
      "div",
      { className: "kv" },
      md("span", { className: "kv-k" }, k),
      md("span", { className: "kv-v" }, v),
    );

  return md(
    "div",
    null,
    md(
      "div",
      { className: "stat-block" },
      md("div", { className: "section-label" }, "1 – X – 2 megoszlás"),
      md("div", { className: "bar-caption" }, "tippek száma · " + bets.length + " játékos"),
      md(StackedBar, { slices: dist, metric: (s) => s.count }),
      md(
        "div",
        { className: "bar-caption", style: { marginTop: 8 } },
        "tét szerint · ",
        fmtTok(totalStake),
        md(TokenIcon, { size: 9 }),
      ),
      md(StackedBar, { slices: dist, metric: (s) => s.totalStake }),
      md(
        "div",
        { className: "legend" },
        dist.map((s) =>
          md(
            "span",
            { key: s.key },
            md("span", { className: "lg-dot", style: { background: OUT_GRAD[s.key] } }),
            md("b", null, s.key),
            " · " + s.count + " · " + fmtTok(s.totalStake),
            md(TokenIcon, { size: 9 }),
          ),
        ),
      ),
    ),
    md(
      "div",
      { className: "stat-block" },
      md("div", { className: "section-label" }, "Eredmény-tippek"),
      KV("Leggyakoribb tipp", mostCommon ? mostCommon[0] + " (" + mostCommon[1] + ")" : "—"),
      KV("Átlagos tipp", avgH + " – " + avgA),
      finished &&
        KV(
          "Pontos eredmény",
          md(
            React.Fragment,
            null,
            exactCount,
            md(IconTarget, { size: 13, style: { color: "var(--accent)" } }),
          ),
        ),
      finished && KV("Helyes kimenetel", winnerCount + " / " + bets.length),
    ),
    md(
      "div",
      { className: "stat-block" },
      md("div", { className: "section-label" }, "Tét"),
      KV(
        "Legnagyobb tét",
        md(
          React.Fragment,
          null,
          biggest.name + " · " + fmtTok(biggest.stake),
          md(TokenIcon, { size: 10 }),
        ),
      ),
      KV("Összes tét", md(React.Fragment, null, fmtTok(totalStake), md(TokenIcon, { size: 10 }))),
      KV("Átlagos tét", md(React.Fragment, null, fmtTok(avgStake), md(TokenIcon, { size: 10 }))),
    ),
  );
}

/* ---- the modal ---- */
function MatchResultModal({ m, onClose }) {
  const [tab, setTab] = useStateMD("tips");
  const finished = m.status === "finished";
  return md(
    "div",
    { className: "overlay", onClick: onClose },
    md(
      "div",
      { className: "modal", onClick: (ev) => ev.stopPropagation() },
      md(
        "div",
        { className: "modal-head" },
        md(
          "span",
          { className: "mh-date" },
          finished ? "Vége · 2026. június 10." : "Élő · 2026. június 11.",
        ),
        md(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          md(IconX, { size: 18 }),
        ),
      ),
      md(
        "div",
        { className: "modal-body" },
        md(
          "div",
          { className: "sb" },
          md(
            "div",
            { className: "side" },
            md("img", { className: "flag", src: m.home.flag, alt: "" }),
            md("span", { className: "nm" }, m.home.name),
          ),
          md(
            "div",
            { className: "center" },
            finished
              ? md("span", { className: "score" }, m.result.h + " : " + m.result.a)
              : md("span", { className: "live" }, md("span", { className: "live-dot" }), "ÉLŐ"),
            md("span", { className: "sub" }, finished ? "végeredmény" : m.venue),
          ),
          md(
            "div",
            { className: "side" },
            md("img", { className: "flag", src: m.away.flag, alt: "" }),
            md("span", { className: "nm" }, m.away.name),
          ),
        ),
        md(Segmented, {
          value: tab,
          onChange: setTab,
          items: [
            { value: "tips", label: "Tippek" },
            { value: "stats", label: "Statisztika" },
          ],
        }),
        md(
          "div",
          { className: "tab-body" },
          tab === "tips"
            ? md(TipsTab, { bets: m.allBets, finished })
            : md(StatsTab, { bets: m.allBets, finished, result: m.result }),
        ),
      ),
    ),
  );
}

Object.assign(window, { MatchResultModal, BetRow });
