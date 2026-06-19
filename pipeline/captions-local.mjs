#!/usr/bin/env node
// Build styled burn-in captions (ASS) + end CTA flash from a local words.json
// (from transcribe-local.py). Same look as /bbb's captions.mjs, no cloud.
// Usage: node captions-local.mjs <words.json> <out.ass> [W=1080] [H=1920] [capY]
import fs from "node:fs";

const [wordsFile, outAss, Ws = "1080", Hs = "1920", capYs] = process.argv.slice(2);
const W = +Ws, H = +Hs;
const capY = capYs ? +capYs : Math.round(H * 0.73);
const ctaY = Math.round(H * 0.4);
const CTA = process.env.ACP_CTA || process.env.BBB_CTA || "GET THE FULL PLAN FREE";
const CTA_URL = process.env.ACP_CTA_URL || process.env.BBB_CTA_URL || "";

const data = JSON.parse(fs.readFileSync(wordsFile, "utf8"));
const words = (data.words || []).filter((w) => w.text && w.text.trim());
const dur = data.duration || (words.length ? words[words.length - 1].end : 0);

const t = (sec) => {
  if (sec < 0) sec = 0;
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};

const chunks = [];
for (let i = 0; i < words.length; i += 3) {
  const g = words.slice(i, i + 3);
  chunks.push({ start: g[0].start, end: g[g.length - 1].end, text: g.map((x) => x.text).join(" ").toUpperCase().replace(/[{}]/g, "") });
}
for (let i = 0; i < chunks.length - 1; i++) chunks[i].end = chunks[i + 1].start;

const cx = Math.round(W / 2);
let ev = "";
for (const c of chunks) ev += `Dialogue: 0,${t(c.start)},${t(c.end)},Cap,,0,0,0,,{\\pos(${cx},${capY})}${c.text}\n`;

const ctaText = `{\\b1}${CTA}` + (CTA_URL ? `\\N{\\fs60}${CTA_URL}` : "");
let cur = Math.max(0, dur - 2.8);
for (let k = 0; k < 5 && cur < dur - 1.0; k++) {
  ev += `Dialogue: 1,${t(cur)},${t(cur + 0.22)},CTA,,0,0,0,,{\\pos(${cx},${ctaY})}${ctaText}\n`;
  cur += 0.38;
}
ev += `Dialogue: 1,${t(dur - 1.0)},${t(dur)},CTA,,0,0,0,,{\\pos(${cx},${ctaY})\\fad(120,0)}${ctaText}\n`;

const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Arial,78,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,3,5,40,40,40,1
Style: CTA,Arial,80,&H0037AFD4,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,7,4,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev}`;

fs.writeFileSync(outAss, ass, "utf8");
console.log(JSON.stringify({ saved: outAss, words: words.length, chunks: chunks.length, dur }, null, 2));
