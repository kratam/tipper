// TippCasino — Podium tab (predict tournament top 3) + own-groups summary cards.
const { useState: useStatePD } = React;
const pd = React.createElement;

const MEDALS = { gold: "🥇", silver: "🥈", bronze: "🥉" };
const POD_LABEL = { gold: "1.", silver: "2.", bronze: "3." };

/* ---- searchable team picker ---- */
function TeamPickerModal({ medal, teams, selectedId, disabledIds, onSelect, onClose }) {
  const [q, setQ] = useStatePD("");
  const filtered = teams.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  return pd(
    "div",
    { className: "overlay", onClick: onClose },
    pd(
      "div",
      { className: "modal", onClick: (ev) => ev.stopPropagation() },
      pd(
        "div",
        { className: "modal-head" },
        pd(
          "span",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: 15,
            },
          },
          pd("span", { style: { fontSize: 17 } }, MEDALS[medal]),
          POD_LABEL[medal] + " helyezett",
        ),
        pd(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          pd(IconX, { size: 18 }),
        ),
      ),
      pd(
        "div",
        { className: "modal-body" },
        pd(
          "div",
          { className: "tp-search" },
          pd(IconGlobe, { size: 16, style: { color: "var(--text-faint)" } }),
          pd("input", {
            autoFocus: true,
            placeholder: "Csapat keresése…",
            value: q,
            onChange: (e) => setQ(e.target.value),
          }),
        ),
        pd(
          "div",
          { className: "tp-list" },
          filtered.length === 0
            ? pd(
                "p",
                {
                  className: "faint",
                  style: { textAlign: "center", padding: "20px 0", fontSize: 13 },
                },
                "Nincs találat.",
              )
            : filtered.map((t) => {
                const dis = disabledIds.has(t.id) && t.id !== selectedId;
                const sel = t.id === selectedId;
                return pd(
                  "button",
                  {
                    key: t.id,
                    className: "tp-item" + (sel ? " sel" : "") + (dis ? " dis" : ""),
                    disabled: dis,
                    onClick: () => {
                      if (!dis) {
                        onSelect(t.id);
                        onClose();
                      }
                    },
                  },
                  pd("img", { className: "flag", src: t.flag, alt: "" }),
                  pd("span", { className: "tp-nm" }, t.name),
                  sel && pd("span", { className: "tp-medal" }, MEDALS[medal]),
                  dis && pd(IconCheck, { size: 14, style: { color: "var(--text-faint)" } }),
                );
              }),
        ),
      ),
    ),
  );
}

/* ---- one podium column ---- */
function PodColumn({ cfg, team, onClick }) {
  return pd(
    "div",
    { className: "pod-col", style: { order: cfg.order } },
    pd("div", { className: "pod-emoji" }, MEDALS[cfg.medal]),
    pd(
      "div",
      {
        className: "pod-stand pod-" + cfg.medal + (team ? "" : " empty"),
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === "Enter") onClick();
        },
      },
      team
        ? pd(
            "div",
            { className: "pod-team" },
            pd("img", {
              className: "pt-disc",
              src: team.flag,
              alt: "",
              style: {
                width: cfg.medal === "gold" ? 46 : 38,
                height: cfg.medal === "gold" ? 46 : 38,
              },
            }),
            pd(
              "span",
              { className: "pt-name" },
              team.name.length > 11 ? team.name.slice(0, 9) + "…" : team.name,
            ),
          )
        : pd(
            "div",
            { className: "pod-empty-txt" },
            pd("div", { className: "pe-plus" }, "+"),
            pd("div", { className: "pe-lbl" }, "Válassz"),
          ),
    ),
    pd("div", { className: "pod-bar " + cfg.medal }, POD_LABEL[cfg.medal]),
  );
}

/* ---- Podium tab ---- */
function PodiumTab() {
  const teams = TC_DATA.teams;
  const [sel, setSel] = useStatePD({ gold: "", silver: "", bronze: "" });
  const [picker, setPicker] = useStatePD(null);
  const cfgs = [
    { medal: "silver", order: 1 },
    { medal: "gold", order: 2 },
    { medal: "bronze", order: 3 },
  ];
  const selectedIds = new Set(Object.values(sel).filter(Boolean));
  const allSelected = sel.gold && sel.silver && sel.bronze;
  const find = (id) => teams.find((t) => t.id === id);

  return pd(
    "div",
    { className: "panel" },
    pd(
      "div",
      { className: "podium-wrap" },
      pd(
        "p",
        { className: "muted", style: { textAlign: "center", margin: "0 0 18px", fontSize: 13.5 } },
        "Tippeld meg a torna végeredményét. A meccsek kezdetéig módosíthatod.",
      ),
      pd(
        "div",
        { className: "podium" },
        cfgs.map((cfg) =>
          pd(PodColumn, {
            key: cfg.medal,
            cfg,
            team: find(sel[cfg.medal]),
            onClick: () => setPicker(cfg.medal),
          }),
        ),
      ),
      pd(
        "div",
        { style: { maxWidth: 380, margin: "20px auto 0" } },
        pd(
          Btn,
          {
            variant: "primary",
            style: {
              width: "100%",
              opacity: allSelected ? 1 : 0.5,
              pointerEvents: allSelected ? "auto" : "none",
            },
          },
          allSelected ? "Dobogó-tipp leadása" : "Válassz mindhárom helyre",
        ),
      ),
    ),
    picker &&
      pd(TeamPickerModal, {
        medal: picker,
        teams,
        selectedId: sel[picker],
        disabledIds: selectedIds,
        onClose: () => setPicker(null),
        onSelect: (id) => setSel((p) => ({ ...p, [picker]: id })),
      }),
  );
}

/* ---- Own groups summary ---- */
function OwnGroupsSummary({ onOpen }) {
  const groups = TC_DATA.ownGroups;
  return pd(
    "div",
    null,
    pd(
      "div",
      { className: "section-head" },
      pd(IconUsers, { size: 16, style: { color: "var(--text-muted)" } }),
      pd("h2", null, "Csoportjaim"),
      pd("span", { className: "sh-line" }),
    ),
    pd(
      "div",
      { className: "og-grid", style: { marginTop: 12 } },
      groups.map((g) =>
        pd(
          "button",
          { key: g.slug, className: "og-card", onClick: () => onOpen(g) },
          pd(
            "div",
            { className: "og-top" },
            pd(
              "span",
              { className: "og-ico" + (g.official ? " official" : "") },
              g.official
                ? pd(IconCrown, { size: 17, fill: "currentColor", strokeWidth: 1.4 })
                : pd(IconUsers, { size: 16 }),
            ),
            pd(
              "div",
              { style: { minWidth: 0, flex: 1 } },
              pd("div", { className: "og-name" }, g.name),
              pd("div", { className: "og-sub" }, g.members + " tag"),
            ),
            pd(
              "div",
              { className: "og-rank" },
              pd("div", { className: "r" }, "#" + g.myRank),
              pd("div", { className: "rl" }, "/ " + g.totalPlayers),
            ),
          ),
          pd(
            "div",
            { className: "og-mini" },
            g.top.map((p, i) =>
              pd(
                "div",
                { key: i, className: "og-mini-row" },
                pd("span", { className: "mr" }, ["🥇", "🥈", "🥉"][i]),
                pd(Avatar, { name: p.name, color: p.color, size: 18 }),
                pd(
                  "span",
                  { className: "mn", style: { fontWeight: p.me ? 700 : 500 } },
                  p.name,
                  p.me &&
                    pd(
                      "span",
                      { style: { color: "var(--accent)", fontSize: 10, marginLeft: 5 } },
                      "(te)",
                    ),
                ),
                pd(
                  "span",
                  {
                    className: "mp " + (p.profit >= 0 ? "" : ""),
                    style: { color: p.profit >= 0 ? "var(--win)" : "var(--loss)" },
                  },
                  (p.profit > 0 ? "+" : "") + p.profit,
                ),
              ),
            ),
          ),
          pd(
            "div",
            { className: "og-foot" },
            pd(
              "span",
              { className: "og-profit " + (g.profit >= 0 ? "up" : "down") },
              (g.profit > 0 ? "+" : "") + g.profit,
              pd(TokenIcon, { size: 13 }),
            ),
            g.missingNext3 > 0
              ? pd(
                  "span",
                  { className: "og-missing" },
                  pd(IconAlert, { size: 14 }),
                  g.missingNext3 + " hiányzó tipp",
                )
              : pd(
                  "span",
                  { className: "og-ok" },
                  pd(IconCircleCheck, { size: 14 }),
                  "köv. 3 nap kész",
                ),
          ),
        ),
      ),
    ),
  );
}

Object.assign(window, { PodiumTab, OwnGroupsSummary });
