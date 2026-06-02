// TippCasino — minimal icon set (lucide-style single-path SVGs).
const { createElement: h } = React;

function makeIcon(paths, opts = {}) {
  return function Icon({ size = 18, strokeWidth = 2, fill = "none", className, style }) {
    return h(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: fill,
        stroke: "currentColor",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
        style,
        "aria-hidden": true,
      },
      paths.map((d, i) => h("path", { key: i, d })),
    );
  };
}

const IconChevronDown = makeIcon(["m6 9 6 6 6-6"]);
const IconCrown = makeIcon(["M5 17h14", "m3 7 4.5 4L12 5l4.5 6L21 7l-1.8 8H4.8L3 7z"]);
const IconCheck = makeIcon(["M20 6 9 17l-5-5"]);
const IconCircleCheck = makeIcon(["M21.8 10A10 10 0 1 1 17 3.3", "m9 11 3 3L22 4"]);
const IconGlobe = makeIcon([
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  "M2 12h20",
  "M12 2a15 15 0 0 1 0 20",
  "M12 2a15 15 0 0 0 0 20",
]);
const IconHelp = makeIcon([
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4",
  "M12 17h.01",
]);
const IconMenu = makeIcon(["M4 6h16", "M4 12h16", "M4 18h16"]);
const IconX = makeIcon(["M18 6 6 18", "m6 6 12 12"]);
const IconPlus = makeIcon(["M12 5v14", "M5 12h14"]);
const IconMinus = makeIcon(["M5 12h14"]);
const IconRules = makeIcon(["M4 4h11l5 5v11a0 0 0 0 1 0 0H4z", "M14 4v5h5", "M8 13h7", "M8 17h7"]);
const IconArrow = makeIcon(["M5 12h14", "m12 5 7 7-7 7"]);
const IconTarget = makeIcon([
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z",
  "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
]);
const IconTrash = makeIcon(["M3 6h18", "M8 6V4h8v2", "m6 6 1 14h10l1-14", "M10 11v6", "M14 11v6"]);
const IconLogOut = makeIcon([
  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
  "m16 17 5-5-5-5",
  "M21 12H9",
]);
const IconAlert = makeIcon([
  "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  "M12 9v4",
  "M12 17h.01",
]);
const IconUsers = makeIcon([
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
  "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  "M22 21v-2a4 4 0 0 0-3-3.9",
  "M16 3.1a4 4 0 0 1 0 7.8",
]);
const IconTrophy = makeIcon([
  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
  "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
  "M4 22h16",
  "M10 14.7V17a2 2 0 0 1-2 2",
  "M14 14.7V17a2 2 0 0 0 2 2",
  "M18 2H6v7a6 6 0 0 0 12 0V2z",
]);
const IconChevR = makeIcon(["m9 18 6-6-6-6"]);

Object.assign(window, {
  IconChevronDown,
  IconCrown,
  IconCheck,
  IconCircleCheck,
  IconGlobe,
  IconHelp,
  IconMenu,
  IconX,
  IconPlus,
  IconMinus,
  IconRules,
  IconArrow,
  IconTarget,
  IconTrash,
  IconLogOut,
  IconAlert,
  IconUsers,
  IconTrophy,
  IconChevR,
});
