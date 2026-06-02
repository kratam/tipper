// TippCasino — Landing page, tournament picker, name-entry modal.
const { useState: useStateLP } = React;
const lp = React.createElement;

const STATUS_LABEL_LP = { active: "Aktív", upcoming: "Hamarosan", finished: "Lezárt" };

/* ---- Google "G" mark ---- */
function GoogleG({ size = 18 }) {
  return lp(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": true },
    lp("path", {
      fill: "#EA4335",
      d: "M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.5 17.6 9.5 24 9.5z",
    }),
    lp("path", {
      fill: "#4285F4",
      d: "M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.9 37.9 46.5 31.8 46.5 24.5z",
    }),
    lp("path", {
      fill: "#FBBC05",
      d: "M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6.1z",
    }),
    lp("path", {
      fill: "#34A853",
      d: "M24 48c6.2 0 11.5-2 15.3-5.5l-7.5-5.8c-2 1.4-4.7 2.3-7.8 2.3-6.4 0-11.8-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z",
    }),
  );
}

/* ---- name entry modal (first login) ---- */
function NameModal({ onDone }) {
  const [name, setName] = useStateLP("");
  return lp(
    "div",
    { className: "overlay" },
    lp(
      "div",
      { className: "modal", style: { maxWidth: 400 } },
      lp(
        "div",
        { className: "help-hero" },
        lp("span", { className: "crown" }, lp(IconUsers, { size: 20 })),
        lp(
          "div",
          { style: { flex: 1 } },
          lp("h2", null, "Üdv a fedélzeten!"),
          lp("p", null, "Hogyan szólítsunk? Ezt a nevet látják a többiek a ranglistán."),
        ),
      ),
      lp(
        "div",
        { className: "modal-body" },
        lp("input", {
          className: "name-input",
          placeholder: "Becenév",
          value: name,
          autoFocus: true,
          maxLength: 20,
          onChange: (e) => setName(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && name.trim()) onDone(name.trim());
          },
        }),
        lp(
          "div",
          { className: "faint", style: { fontSize: 11.5, textAlign: "right", marginTop: 6 } },
          name.length + "/20",
        ),
        lp(
          Btn,
          {
            variant: "primary",
            style: {
              width: "100%",
              marginTop: 12,
              opacity: name.trim() ? 1 : 0.5,
              pointerEvents: name.trim() ? "auto" : "none",
            },
            onClick: () => onDone(name.trim()),
          },
          "Kezdés",
        ),
      ),
    ),
  );
}

/* ---- landing ---- */
function Landing({ onSignIn }) {
  const features = [
    {
      ico: lp(IconTarget, { size: 20 }),
      h: "Tippelj",
      p: "Add meg a meccsek pontos végeredményét, és gyűjts zsetont a tudásoddal.",
    },
    {
      ico: lp(IconUsers, { size: 20 }),
      h: "Versenyezz",
      p: "Hozz létre csoportot a haverokkal, vagy csatlakozz egy publikus tippligához.",
    },
    {
      ico: lp(IconTrophy, { size: 20 }),
      h: "Nyerj",
      p: "Kerülj a ranglista élére a torna végére, és vidd el a dicsőséget.",
    },
  ];
  return lp(
    "div",
    { className: "landing" },
    lp(
      "div",
      { className: "landing-hero" },
      lp("img", { className: "landing-logo", src: LOGO, alt: "TippCasino" }),
      lp("h1", { className: "landing-title" }, "TippCasino"),
      lp(
        "p",
        { className: "landing-sub" },
        "Tippelj a világ legnagyobb focitornáira, versenyezz a barátaiddal, és bizonyítsd be, hogy te értesz a legjobban a focihoz.",
      ),
      lp(
        Btn,
        { variant: "google", className: "btn-google landing-cta", onClick: onSignIn },
        lp(GoogleG, { size: 19 }),
        "Belépés Google-fiókkal",
      ),
    ),
    lp(
      "div",
      { className: "feature-grid" },
      features.map((f, i) =>
        lp(
          "div",
          { key: i, className: "feature-card" },
          lp("div", { className: "feature-ico" }, f.ico),
          lp("h3", null, f.h),
          lp("p", null, f.p),
        ),
      ),
    ),
    lp(
      "div",
      { className: "landing-foot" },
      lp("a", { href: "#" }, "Adatvédelem"),
      lp("span", null, "·"),
      lp("a", { href: "#" }, "Felhasználási feltételek"),
    ),
  );
}

/* ---- tournament picker ---- */
function TournamentPicker({ onPick }) {
  return lp(
    "div",
    { className: "tc-shell" },
    lp(
      "div",
      { className: "page-head" },
      lp("div", { className: "badge" }, lp(IconTrophy, { size: 24, strokeWidth: 1.6 })),
      lp("h1", null, "Tornák"),
    ),
    lp(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "var(--gap)" } },
      TC_DATA.tournaments.map((t) => {
        const active = t.status === "active";
        return lp(
          "button",
          {
            key: t.slug,
            className: "tour-row",
            onClick: () => {
              if (active) onPick(t);
            },
            style: { cursor: active ? "pointer" : "default", opacity: active ? 1 : 0.7 },
          },
          lp(
            "span",
            { className: "tour-ico" + (active ? "" : " dim") },
            lp(IconTrophy, { size: 22, strokeWidth: 1.6 }),
          ),
          lp(
            "div",
            { className: "tour-main" },
            lp("div", { className: "tour-name" }, t.name),
            lp("div", { className: "tour-meta" }, t.date + "  ·  " + t.teams + " csapat"),
          ),
          lp(
            "div",
            { className: "tour-right" },
            lp("span", { className: "status-badge " + t.status }, STATUS_LABEL_LP[t.status]),
            active && t.myGroups > 0
              ? lp(
                  "span",
                  { className: "tour-meta", style: { color: "var(--accent)" } },
                  t.myGroups + " csoportod",
                )
              : null,
            active && lp(IconChevR, { size: 16, style: { color: "var(--text-faint)" } }),
          ),
        );
      }),
    ),
  );
}

Object.assign(window, { Landing, TournamentPicker, NameModal });
