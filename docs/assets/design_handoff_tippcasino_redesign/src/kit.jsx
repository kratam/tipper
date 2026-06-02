// TippCasino — shared design-system primitives.
// ONE Segmented tab, ONE Button, plus Token + Avatar. Reused everywhere.
const { createElement: e } = React;

const LOGO = "assets/tippcasino-logo.png";

function TokenIcon({ size = 12 }) {
  return e("img", {
    src: LOGO,
    alt: "",
    className: "tok",
    style: { width: size, height: size, verticalAlign: "-0.12em" },
    "aria-hidden": true,
  });
}

function Avatar({ name, color, size = 26 }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return e(
    "span",
    {
      className: "avatar",
      style: { width: size, height: size, background: color, fontSize: Math.round(size * 0.4) },
    },
    initials,
  );
}

// THE segmented tab control — used for every tab row in the app.
function Segmented({ items, value, onChange, fit }) {
  return e(
    "div",
    { className: "seg" + (fit ? " fit" : ""), role: "tablist" },
    items.map((it) => {
      const v = typeof it === "string" ? it : it.value;
      const label = typeof it === "string" ? it : it.label;
      const selected = v === value;
      return e(
        "button",
        {
          key: v,
          role: "tab",
          "aria-selected": selected,
          className: "seg-item",
          onClick: () => onChange(v),
        },
        selected && e("span", { className: "dot" }),
        label,
        typeof it === "object" && it.icon ? it.icon : null,
      );
    }),
  );
}

// THE button — variant + size, nothing bespoke elsewhere.
function Btn({ variant = "primary", size, className = "", children, ...rest }) {
  const cls = ["btn", "btn-" + variant, size === "sm" ? "btn-sm" : "", className].join(" ").trim();
  return e("button", { className: cls, ...rest }, children);
}

Object.assign(window, { TokenIcon, Avatar, Segmented, Btn, LOGO });
