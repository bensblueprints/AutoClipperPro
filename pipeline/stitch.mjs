#!/usr/bin/env node
// Stitch multiple reels into ONE longer vertical background clip (no looping).
// Each input is scaled to fit + padded to 1080x1920 @30fps, then concatenated.
// Video-only (the final uses Ben's avatar VO); transcribe the source clips
// separately for the "watch" step.
// Usage: node stitch.mjs <out.mp4> <in1.mp4> <in2.mp4> [in3.mp4] [in4.mp4] ...
import { spawn } from "node:child_process";

const ff = process.env.FFMPEG_PATH || "ffmpeg";
const [out, ...ins] = process.argv.slice(2);

if (!out || ins.length < 1) {
  console.error("usage: node stitch.mjs <out.mp4> <in1> <in2> [in3] [in4] ...");
  process.exit(1);
}

const W = 1080, H = 1920, FPS = 30;
const inputs = ins.flatMap((f) => ["-i", f]);
const norm = ins
  .map(
    (_, i) =>
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p[v${i}]`
  )
  .join(";");
const concat = ins.map((_, i) => `[v${i}]`).join("") + `concat=n=${ins.length}:v=1:a=0[outv]`;

const args = [
  ...inputs,
  "-filter_complex", `${norm};${concat}`,
  "-map", "[outv]",
  "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
  "-movflags", "+faststart",
  "-y", out,
];

console.error(`stitching ${ins.length} clips -> ${out} (1080x1920@${FPS})`);
const child = spawn(ff, args, { stdio: ["ignore", "ignore", "inherit"] });
child.on("error", (e) => { console.error("ffmpeg spawn error:", e.message); process.exit(1); });
child.on("close", (code) => {
  if (code === 0) console.log(`done -> ${out}`);
  else { console.error(`ffmpeg exited ${code}`); process.exit(code || 1); }
});
