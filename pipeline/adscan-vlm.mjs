#!/usr/bin/env node
// General ad detector with frame-accurate boundaries.
//  1) sample frames, ask the beast VLM "promo GRAPHIC CARD or real footage?"
//  2) reject single-frame false positives (a real ad spans >=2 sampled frames)
//  3) snap each ad region to the surrounding SCENE CUTS (the ad is a distinct
//     spliced shot) -> cut removes the whole card, no flash, no over-cut.
// Usage: node adscan-vlm.mjs <video> [fps=3]
// Env: OLLAMA_HOST, BBB_VLM, FFMPEG_PATH ; ADSCAN_DEBUG=1 for verdicts
import { spawnSync } from "node:child_process";
import { promises as fsp } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const VLM = process.env.BBB_VLM || "qwen2.5vl:7b";
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const DBG = !!process.env.ADSCAN_DEBUG;
const [video, fpsS = "4"] = process.argv.slice(2);
const FPS = parseFloat(fpsS);
const SNAP_WIN = 3.5; // how far to look for a bounding scene cut
const PAD = 0.25;     // fallback pad if no cut found

const PROMPT =
  "Look at THIS single frame. Is it a spliced-in promotional GRAPHIC CARD versus real footage?\n" +
  "GRAPHIC CARD = a flat designed poster/thumbnail that interrupts the video: a podcast cover, a HEADSHOT next to BIG TITLE TEXT, a 'tune in / subscribe' card, channel/brand logos, an app ad. Looks like a graphic, not a real scene.\n" +
  "REAL FOOTAGE = an actual filmed scene (people, hands, tools, tiles, floors, rooms, products), OK even if promotional or with a 1-3 word subtitle.\n" +
  "Is THIS a promotional GRAPHIC CARD? Answer EXACTLY one word: AD or OK.";

async function classify(b64) {
  const r = await fetch(`${HOST}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: VLM, messages: [{ role: "user", content: PROMPT, images: [b64] }], stream: false, options: { temperature: 0 } }),
  });
  if (!r.ok) return "OK";
  return ((await r.json()).message?.content || "").trim();
}

// scene-cut timestamps
function sceneCuts() {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", video, "-vf", "select='gt(scene,0.3)',metadata=print", "-an", "-f", "null", "-"], { encoding: "utf8" });
  const out = (r.stderr || "") + (r.stdout || "");
  const cuts = [];
  for (const m of out.matchAll(/pts_time:([0-9.]+)/g)) cuts.push(parseFloat(m[1]));
  return cuts.sort((a, b) => a - b);
}

// ---- 1) coarse VLM scan ----
const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "adscan-"));
spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", video, "-vf", `fps=${FPS},scale=384:-1`, path.join(tmp, "f_%05d.jpg")], { stdio: "inherit" });
const frames = (await fsp.readdir(tmp)).filter((f) => f.endsWith(".jpg")).sort();
const hits = [];
for (let i = 0; i < frames.length; i++) {
  const t = +(i / FPS).toFixed(2);
  const ans = await classify(fs.readFileSync(path.join(tmp, frames[i])).toString("base64"));
  const isAd = /^\W*AD\b/i.test(ans);
  if (isAd) hits.push(t);
  if (DBG) process.stderr.write(`${t}s: ${ans.slice(0, 10)}${isAd ? "  <-- AD?" : ""}\n`);
}
await fsp.rm(tmp, { recursive: true, force: true });

// ---- 2) merge + reject single-frame FPs ----
const regions = [];
for (const t of hits) {
  const last = regions[regions.length - 1];
  if (last && t - last.end <= 1.5) { last.end = t; last.n++; }
  else regions.push({ start: t, end: t, n: 1 });
}
const real = regions.filter((r) => r.n >= 2);
if (DBG) for (const r of regions) process.stderr.write(`  region ${r.start}-${r.end} frames=${r.n} ${r.n >= 2 ? "KEEP" : "drop(FP)"}\n`);

// ---- 3) snap to scene cuts ----
const cuts = real.length ? sceneCuts() : [];
const segments = real.map((r) => {
  const before = cuts.filter((c) => c <= r.start + 0.34 && c >= r.start - SNAP_WIN).pop();
  const after = cuts.find((c) => c >= r.end - 0.34 && c <= r.end + SNAP_WIN);
  return {
    start: before != null ? +before.toFixed(2) : Math.max(0, +(r.start - PAD).toFixed(2)),
    end: after != null ? +after.toFixed(2) : +(r.end + PAD).toFixed(2),
  };
});
console.log(JSON.stringify({ checked: frames.length, regions: regions.length, segments }, null, 2));
