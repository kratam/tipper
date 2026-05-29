// ─────────────────────────────────────────────────────────────────────────────
// eredmenyek.com (Flashscore) MEGBÍZHATÓSÁGI PROBE — tiszta logika (fs/IO nélkül).
//
// Úgy hívja az eredmenyek.com belső API-jait, mintha már élesben használnánk
// (odds + meccs-státusz/eredmény), és visszaad egy strukturált rekordot, hogy
// mérhessük: stabil-e az x-fsign és élnek-e a végpontok.
//
// Két fő végpont:
//   • Feed (flashscore.ninja, dc_ = detail): `x-fsign` header kell hozzá.
//     Az x-fsign böngésző nélkül kinyerhető: homepage → core_15_*.js → `feed_sign`.
//   • Odds GraphQL (lsapp.eu): auth NÉLKÜL ad JSON-t (1X2 / HOME_DRAW_AWAY).
//
// Használat: lib (Vercel cron route) ÉS a `scripts/eredmenyek-probe.ts` CLI is
// ezt importálja — egy forrás. A lib nem ír fájlt; a hívó dönt a kimenetről.
// ─────────────────────────────────────────────────────────────────────────────

const HOME = "https://www.eredmenyek.com/";
const FEED_BASE = "https://global.flashscore.ninja/15/x/feed/";
const ODDS_GQL = "https://global.ds.lsapp.eu/odds/pq_graphql";
const BOOKMAKER_ID = 498; // TippmixPro (HU geo-IP alapján ez jön vissza)
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15000;

export type Anchor = { id: string; sport: number; label: string };

// Anchor meccsek: stabil event ID-k, amelyeket minden futáskor ellenőrzünk.
// Vegyesen: foci-VB (jövőbeli → élő odds) + hoki-VB (lefutott → eredmény + záró odds).
// A foci-VB meccsek hetekig "scheduled" odds-szal → odds-végpont stabilitás.
// A hoki-VB meccsek "finished" → detail/score feed + záró odds.
export const ANCHORS: Anchor[] = [
  { id: "h4EoUB7T", sport: 1, label: "⚽ VB Mexikó–Dél-Afrika (jövő)" },
  { id: "CGdvIm6K", sport: 1, label: "⚽ VB (jövő)" },
  { id: "bo9vy2zK", sport: 1, label: "⚽ VB (jövő)" },
  { id: "dIOpSymJ", sport: 4, label: "🏒 Hoki VB Csehország–Kanada (vége: 2-3)" },
  { id: "0Q19iDXR", sport: 4, label: "🏒 Hoki VB Norvégia–Dánia OT (vége: 4-3)" },
  { id: "EZ6fHKY0", sport: 4, label: "🏒 Hoki VB Magyarország–Lettország (vége: 1-8)" },
];

const STATUS_MAP: Record<string, string> = { "1": "scheduled", "2": "live", "3": "finished" };

export type Timed<T> = { ok: boolean; ms: number; value?: T; error?: string };
export type FsignResult = { fsign: string; coreUrl: string };
export type DetailResult = {
  statusCode: string | null;
  status: string;
  startTs: number | null;
  startIso: string | null;
  homeScore: string | null;
  awayScore: string | null;
};
export type OddsResult = {
  present: boolean;
  bookmakerId?: number | null;
  home?: string | null;
  draw?: string | null;
  away?: string | null;
};
export type AnchorRun = Anchor & { detail: Timed<DetailResult>; odds: Timed<OddsResult> };
export type ProbeRecord = {
  ts: string;
  fsign: Timed<FsignResult> & { changed: boolean };
  anchors: AnchorRun[];
  summary: {
    anchorsTotal: number;
    fsignOk: boolean;
    detailOk: number;
    oddsOk: number;
    oddsWithData: number;
    allGreen: boolean;
  };
};

// ── apró segédek ────────────────────────────────────────────────────────────

/** Időmért, soha-nem-dobó wrapper: { ok, ms, value? , error? } */
async function timed<T>(fn: () => Promise<T>): Promise<Timed<T>> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: String((e as Error)?.message ?? e) };
  }
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: ctrl.signal });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} (${body.length} bytes)`);
    return body;
  } finally {
    clearTimeout(to);
  }
}

/** Flashscore "÷¬" feed → kulcs/érték objektum (első előfordulás nyer). */
function parseFeed(text: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const part of text.split("¬")) {
    const i = part.indexOf("÷");
    if (i > 0) {
      const k = part.slice(0, i);
      if (!(k in o)) o[k] = part.slice(i + 1);
    }
  }
  return o;
}

// ── lépések ───────────────────────────────────────────────────────────────────

/** x-fsign kinyerése böngésző nélkül: homepage → core_15_*.js → feed_sign. */
export async function harvestFsign(): Promise<FsignResult> {
  const html = await fetchText(HOME);
  const m = html.match(/\/x\/js\/core_15_[0-9]+\.js/);
  if (!m) throw new Error("core_15_*.js URL nem található a homepage HTML-ben");
  const coreUrl = `https://www.eredmenyek.com${m[0]}`;
  const js = await fetchText(coreUrl);
  const sm = js.match(/feed_sign['"]?\s*[:=]\s*['"]([A-Za-z0-9_-]+)['"]/);
  if (!sm) throw new Error("feed_sign nem található a core JS-ben");
  return { fsign: sm[1], coreUrl };
}

/** Meccs detail (dc_) feed → státusz + kezdés + eredmény. */
export async function fetchDetail(id: string, fsign: string): Promise<DetailResult> {
  const f = parseFeed(await fetchText(`${FEED_BASE}dc_1_${id}`, { "x-fsign": fsign }));
  const code = f.DA ?? null;
  return {
    statusCode: code,
    status:
      code != null && STATUS_MAP[code]
        ? STATUS_MAP[code]
        : code == null
          ? "unknown"
          : `code:${code}`,
    startTs: f.DC ? Number(f.DC) : null,
    startIso: f.DC ? new Date(Number(f.DC) * 1000).toISOString() : null,
    homeScore: f.DE ?? null,
    awayScore: f.DF ?? null,
  };
}

/** Odds GraphQL (auth nélkül) → 1X2. */
export async function fetchOdds(id: string): Promise<OddsResult> {
  const url = `${ODDS_GQL}?_hash=ope2&eventId=${id}&bookmakerId=${BOOKMAKER_ID}&betType=HOME_DRAW_AWAY&betScope=FULL_TIME`;
  const j = JSON.parse(await fetchText(url));
  const o = j?.data?.findPrematchOddsForBookmaker;
  if (!o) return { present: false };
  return {
    present: true,
    bookmakerId: o.bookmakerId ?? null,
    home: o.home?.value ?? null,
    draw: o.draw?.value ?? null,
    away: o.away?.value ?? null,
  };
}

// ── egy probe-futás ─────────────────────────────────────────────────────────

/** Lefuttatja a teljes láncot az anchor meccsekre. `prevFsign`: változás-detektáláshoz. */
export async function runProbe(prevFsign: string | null = null): Promise<ProbeRecord> {
  const startedAt = new Date().toISOString();

  const fsignStep = await timed(harvestFsign);
  const fsign = fsignStep.ok && fsignStep.value ? fsignStep.value.fsign : null;
  const fsignChanged = prevFsign != null && fsign != null && prevFsign !== fsign;

  const anchorResults: AnchorRun[] = [];
  for (const a of ANCHORS) {
    const detail = await timed(() => {
      if (!fsign) throw new Error("nincs x-fsign (harvest hiba)");
      return fetchDetail(a.id, fsign);
    });
    const odds = await timed(() => fetchOdds(a.id));
    anchorResults.push({ ...a, detail, odds });
  }

  const detailOk = anchorResults.filter((r) => r.detail.ok).length;
  const oddsOk = anchorResults.filter((r) => r.odds.ok).length;
  const oddsWithData = anchorResults.filter((r) => r.odds.ok && r.odds.value?.present).length;

  return {
    ts: startedAt,
    fsign: { ...fsignStep, changed: fsignChanged },
    anchors: anchorResults,
    summary: {
      anchorsTotal: ANCHORS.length,
      fsignOk: fsignStep.ok,
      detailOk,
      oddsOk,
      oddsWithData,
      allGreen: fsignStep.ok && detailOk === ANCHORS.length && oddsOk === ANCHORS.length,
    },
  };
}

// ── olvasható összegzés (CLI + Vercel log) ────────────────────────────────────

function fmtScore(d: DetailResult): string {
  if (d.homeScore == null || d.awayScore == null) return "(nincs eredmény)";
  return `${d.homeScore}-${d.awayScore}`;
}

/** Emberi olvasásra szánt, többsoros összegzés a probe rekordból. */
export function formatSummary(r: ProbeRecord): string {
  const s = r.summary;
  const lines: string[] = [];
  const banner = s.allGreen ? "✅ MINDEN OK" : "⚠️  HIBA(K)";
  lines.push("═".repeat(72));
  lines.push(`${banner}  •  ${r.ts}`);
  lines.push("─".repeat(72));

  if (r.fsign.ok && r.fsign.value) {
    const chg = r.fsign.changed ? "  ⟵ VÁLTOZOTT! 🔁" : "";
    lines.push(`x-fsign: ${r.fsign.value.fsign}  (${r.fsign.ms} ms)${chg}`);
  } else {
    lines.push(`x-fsign: ❌ HARVEST HIBA — ${r.fsign.error}  (${r.fsign.ms} ms)`);
  }

  for (const a of r.anchors) {
    const d =
      a.detail.ok && a.detail.value
        ? `${a.detail.value.status.padEnd(9)} ${fmtScore(a.detail.value)}`
        : `❌ detail: ${a.detail.error}`;
    const o = a.odds.ok
      ? a.odds.value?.present
        ? `1X2 ${a.odds.value.home}/${a.odds.value.draw}/${a.odds.value.away}`
        : "odds: nincs"
      : `❌ odds: ${a.odds.error}`;
    lines.push(`  ${a.label}`);
    lines.push(`      ${d.padEnd(34)} | ${o}`);
  }

  lines.push("─".repeat(72));
  lines.push(
    `Összegzés: fsign=${s.fsignOk ? "ok" : "HIBA"} | detail ${s.detailOk}/${s.anchorsTotal} | odds ${s.oddsOk}/${s.anchorsTotal} (adattal: ${s.oddsWithData})`,
  );
  lines.push("═".repeat(72));
  return lines.join("\n");
}
