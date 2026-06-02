// TippCasino — Groups list page + new-group form + join-public modal.
const { useState: useStateGL } = React;
const gl = React.createElement;

const STATUS_LABEL = { active: "Aktív", upcoming: "Hamarosan", finished: "Lezárt" };

function profitClassGL(p) {
  return p > 0 ? "up" : p < 0 ? "down" : "flat";
}

/* ---- group card (gradient header) ---- */
function GroupCardGL({ g, variant, onClick }) {
  const hasProfit = g.profit != null;
  return gl(
    "button",
    { className: "gcard" + (variant === "public" ? " public" : ""), onClick },
    gl(
      "div",
      { className: "gc-head" },
      gl(
        "div",
        { style: { minWidth: 0, flex: 1 } },
        gl("div", { className: "gc-name" }, g.name),
        gl("div", { className: "gc-tour" }, g.tournamentName),
      ),
      variant === "public"
        ? gl(IconGlobe, { size: 16, className: "gc-globe" })
        : hasProfit
          ? gl(
              "span",
              { className: "gc-badge " + profitClassGL(g.profit) },
              (g.profit > 0 ? "+" : "") + g.profit,
              gl(TokenIcon, { size: 12 }),
            )
          : gl(IconUsers, { size: 16, className: "gc-globe" }),
    ),
    gl(
      "div",
      { className: "gc-body" },
      g.description && gl("p", { className: "gc-desc" }, g.description),
      gl(
        "div",
        { className: "gc-foot" },
        gl("span", { className: "gc-members" }, gl(IconUsers, { size: 13 }), g.members + " tag"),
        gl("span", { className: "status-badge " + g.status }, STATUS_LABEL[g.status]),
      ),
    ),
  );
}

/* ---- new group modal ---- */
function NewGroupModal({ onClose }) {
  const [name, setName] = useStateGL("");
  const [tour, setTour] = useStateGL(TC_DATA.tournaments[0].slug);
  const [isPublic, setPublic] = useStateGL(false);
  const [preset, setPreset] = useStateGL("standard");
  const presets = [
    { value: "casual", label: "Laza" },
    { value: "standard", label: "Standard" },
    { value: "hardcore", label: "Hardcore" },
  ];
  return gl(
    "div",
    { className: "overlay", onClick: onClose },
    gl(
      "div",
      { className: "modal", onClick: (ev) => ev.stopPropagation() },
      gl(
        "div",
        { className: "modal-head" },
        gl("span", { style: { fontWeight: 700, fontSize: 16 } }, "Új csoport"),
        gl(
          "button",
          { className: "nav-ico", style: { color: "var(--text-muted)" }, onClick: onClose },
          gl(IconX, { size: 18 }),
        ),
      ),
      gl(
        "div",
        { className: "modal-body" },
        gl(
          "div",
          { className: "field" },
          gl("label", null, "Csoport neve"),
          gl("input", {
            className: "ta",
            style: { minHeight: 0, height: 40 },
            placeholder: "pl. Sörözős Liga",
            value: name,
            onChange: (e) => setName(e.target.value),
            autoFocus: true,
          }),
        ),
        gl(
          "div",
          { className: "field" },
          gl("label", null, "Torna"),
          gl(
            "div",
            { className: "seg", style: { gridAutoColumns: "1fr" } },
            TC_DATA.tournaments
              .filter((x) => x.status !== "finished")
              .map((x) =>
                gl(
                  "button",
                  {
                    key: x.slug,
                    className: "seg-item",
                    "aria-selected": tour === x.slug,
                    onClick: () => setTour(x.slug),
                  },
                  x.name,
                ),
              ),
          ),
        ),
        gl(
          "div",
          { className: "field" },
          gl("label", null, "Pontozási sablon"),
          gl(Segmented, { items: presets, value: preset, onChange: setPreset }),
        ),
        gl(
          "div",
          { className: "switch-row" },
          gl(
            "div",
            null,
            gl("div", { className: "sr-label" }, "Publikus csoport"),
            gl("div", { className: "sr-sub" }, "Bárki megtalálja és csatlakozhat"),
          ),
          gl(Switch, { checked: isPublic, onChange: setPublic }),
        ),
        gl(
          "div",
          { style: { display: "flex", gap: 8, marginTop: 18 } },
          gl(Btn, { variant: "secondary", style: { flex: 1 }, onClick: onClose }, "Mégse"),
          gl(
            Btn,
            {
              variant: "primary",
              style: { flex: 2, opacity: name ? 1 : 0.5, pointerEvents: name ? "auto" : "none" },
              onClick: onClose,
            },
            "Csoport létrehozása",
          ),
        ),
      ),
    ),
  );
}

/* ---- join public group modal ---- */
function JoinPublicModal({ g, onClose }) {
  return gl(
    "div",
    { className: "overlay", onClick: onClose },
    gl(
      "div",
      { className: "modal", onClick: (ev) => ev.stopPropagation() },
      gl(
        "div",
        { className: "gc-head", style: { padding: "20px 18px" } },
        gl(
          "div",
          { style: { minWidth: 0, flex: 1, zIndex: 1 } },
          gl("div", { className: "gc-name", style: { fontSize: 18 } }, g.name),
          gl("div", { className: "gc-tour" }, g.tournamentName),
        ),
        gl(
          "span",
          { className: "gc-badge flat", style: { zIndex: 1 } },
          gl(IconUsers, { size: 13 }),
          g.members,
        ),
      ),
      gl(
        "div",
        { className: "modal-body" },
        g.description &&
          gl(
            "p",
            { className: "muted", style: { fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" } },
            g.description,
          ),
        gl(
          "div",
          { className: "help-note", style: { marginTop: 0 } },
          gl(IconCircleCheck, {
            size: 15,
            style: { color: "var(--accent)", flex: "none", marginTop: 1 },
          }),
          gl(
            "span",
            null,
            "Csatlakozás után " +
              g.members +
              " játékossal versenyzel. A torna kezdetéig bármikor kiléphetsz.",
          ),
        ),
        gl(
          "div",
          { style: { display: "flex", gap: 8, marginTop: 16 } },
          gl(Btn, { variant: "secondary", style: { flex: 1 }, onClick: onClose }, "Mégse"),
          gl(Btn, { variant: "primary", style: { flex: 2 }, onClick: onClose }, "Csatlakozás"),
        ),
      ),
    ),
  );
}

/* ---- groups list screen ---- */
function GroupsList({ onOpenGroup }) {
  const [showNew, setShowNew] = useStateGL(false);
  const [joinG, setJoinG] = useStateGL(null);
  const [archOpen, setArchOpen] = useStateGL(false);
  const own = TC_DATA.ownGroups.map((g) => ({
    ...g,
    tournamentName: g.name.includes("Hivatalos") ? "FIFA WC 2026" : "FIFA WC 2026",
    status: "active",
  }));

  return gl(
    "div",
    { className: "tc-shell" },
    gl(
      "div",
      { className: "page-title-row" },
      gl("h1", null, "Csoportok"),
      gl(
        Btn,
        { variant: "primary", onClick: () => setShowNew(true) },
        gl(IconPlus, { size: 16 }),
        "Új csoport",
      ),
    ),

    gl(
      "div",
      { className: "section-head" },
      gl(IconUsers, { size: 16, style: { color: "var(--text-muted)" } }),
      gl("h2", null, "Csoportjaim"),
      gl("span", { className: "sh-line" }),
    ),
    gl(
      "div",
      { className: "gc-grid", style: { marginTop: 12, marginBottom: 24 } },
      TC_DATA.ownGroups.map((g) =>
        gl(GroupCardGL, {
          key: g.slug,
          variant: "own",
          g: {
            name: g.name,
            tournamentName: "FIFA WC 2026",
            members: g.members,
            status: "active",
            profit: g.profit,
            description: g.official
              ? "A hivatalos világbajnoki tippliga — több ezer játékos."
              : "Baráti tippverseny a világbajnokságra.",
          },
          onClick: () => onOpenGroup(g),
        }),
      ),
    ),

    gl(
      "div",
      { className: "section-head" },
      gl(IconGlobe, { size: 16, style: { color: "var(--text-muted)" } }),
      gl("h2", null, "Publikus csoportok"),
      gl("span", { className: "sh-line" }),
    ),
    gl(
      "div",
      { className: "gc-grid", style: { marginTop: 12, marginBottom: 24 } },
      TC_DATA.publicGroups.map((g) =>
        gl(GroupCardGL, { key: g.slug, variant: "public", g, onClick: () => setJoinG(g) }),
      ),
    ),

    gl(
      "button",
      {
        className: "archived-toggle",
        "aria-expanded": archOpen,
        onClick: () => setArchOpen(!archOpen),
      },
      gl(IconChevronDown, { size: 16, className: "chev" }),
      "Archivált tornák (" + TC_DATA.archivedGroups.length + ")",
    ),
    archOpen &&
      gl(
        "div",
        { className: "gc-grid", style: { marginTop: 14 } },
        TC_DATA.archivedGroups.map((g) =>
          gl(GroupCardGL, { key: g.slug, variant: "own", g, onClick: () => onOpenGroup(g) }),
        ),
      ),

    showNew && gl(NewGroupModal, { onClose: () => setShowNew(false) }),
    joinG && gl(JoinPublicModal, { g: joinG, onClose: () => setJoinG(null) }),
  );
}

Object.assign(window, { GroupsList });
