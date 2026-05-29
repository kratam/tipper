#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// eredmenyek.com probe — LOKÁLIS CLI wrapper a `src/lib/eredmenyek-probe.ts` köré.
//
// Élesben a Vercel cron (`/api/cron/eredmenyek-probe`, 5 percenként) futtatja
// ugyanezt a logikát. Ez a CLI csak kézi, helyi ellenőrzésre van (fájlba is logol).
//
// Futtatás (Node 22.18+ futtatja a .ts-t natívan, type-stripping):
//   node scripts/eredmenyek-probe.ts             # egy futás
//   node scripts/eredmenyek-probe.ts --watch     # loop 300 mp-enként
//   node scripts/eredmenyek-probe.ts --watch 60  # loop 60 mp-enként
//
// Kimenet: konzol + logs/eredmenyek-probe.jsonl (gépi, soronként 1 futás).
// ─────────────────────────────────────────────────────────────────────────────

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { formatSummary, type ProbeRecord, runProbe } from "../src/lib/eredmenyek-probe.ts";

const LOG_FILE = "logs/eredmenyek-probe.jsonl";

async function writeLog(record: ProbeRecord): Promise<void> {
  try {
    await mkdir(dirname(LOG_FILE), { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
  } catch (e) {
    console.error("⚠️  Nem sikerült a logba írni:", String((e as Error)?.message ?? e));
  }
}

async function once(prevFsign: string | null): Promise<string | null> {
  const record = await runProbe(prevFsign);
  await writeLog(record);
  console.log(`\n${formatSummary(record)}\nlog: ${LOG_FILE}`);
  return record.fsign.value?.fsign ?? null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const watchIdx = args.indexOf("--watch");
  if (watchIdx === -1) {
    await once(null);
    return;
  }
  const arg = Number(args[watchIdx + 1]);
  const intervalSec = arg > 0 ? arg : 300;
  console.log(`🔁 Watch mód: ${intervalSec} mp-enként. Ctrl+C a leállításhoz.`);
  let prevFsign: string | null = null;
  for (;;) {
    prevFsign = (await once(prevFsign)) ?? prevFsign;
    await new Promise((res) => setTimeout(res, intervalSec * 1000));
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
