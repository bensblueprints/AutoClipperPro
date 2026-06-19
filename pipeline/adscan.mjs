#!/usr/bin/env node
// Detect non-native ad cards (e.g. spliced sponsor/podcast promos) in a reel by
// perceptual-hash matching every frame against a library of known ad-card images
// (./adlib/*.jpg). Prints JSON time-segments to cut. NO AI credits used.
// Usage: node adscan.mjs <video> [fps=4] [threshold=0.22]
import { spawnSync } from "node:child_process";
import { promises as fsp } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Jimp from "jimp";

const [video, fpsS = "4", thrS = "0.22"] = process.argv.slice(2);
const FPS = +fpsS, THR = +thrS;
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const adlib = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "adlib");

const refs = (await fsp.readdir(adlib)).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
if (!refs.length) { console.log(JSON.stringify({ segments: [], note: "ad library empty" })); process.exit(0); }
const refImgs = [];
for (const f of refs) refImgs.push({ name: f, img: await Jimp.read(path.join(adlib, f)) });

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "adscan-"));
spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", video, "-vf", `fps=${FPS},scale=320:-1`, path.join(tmp, "f_%05d.jpg")], { stdio: "inherit" });
const frames = (await fsp.readdir(tmp)).filter((f) => f.endsWith(".jpg")).sort();

const hits = [];
for (let i = 0; i < frames.length; i++) {
  const t = i / FPS;
  const img = await Jimp.read(path.join(tmp, frames[i]));
  let best = 1, who = null;
  for (const r of refImgs) { const d = Jimp.distance(img, r.img); if (d < best) { best = d; who = r.name; } }
  if (best <= THR) hits.push({ t: +t.toFixed(2), d: +best.toFixed(3), who });
}
await fsp.rm(tmp, { recursive: true, force: true });

// merge consecutive hits into segments (gap tolerance 1.0s), pad 0.15s
const segs = [];
const gap = 1.0, pad = 0.15;
for (const h of hits) {
  const last = segs[segs.length - 1];
  if (last && h.t - last.end <= gap) { last.end = h.t; last.matches++; }
  else segs.push({ start: h.t, end: h.t, matches: 1, who: h.who });
}
const out = segs.filter((s) => s.matches >= 1).map((s) => ({ start: Math.max(0, +(s.start - pad).toFixed(2)), end: +(s.end + pad).toFixed(2), who: s.who }));
console.log(JSON.stringify({ frames: frames.length, hits: hits.length, segments: out }, null, 2));
