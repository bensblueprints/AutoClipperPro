#!/usr/bin/env node
// Transcribe a video/audio file via ElevenLabs Scribe (reuses XI_API_KEY).
// Extracts audio with ffmpeg first, then posts to the STT API.
// Usage: node transcribe.mjs <video-or-audio> <out.txt>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const KEY = process.env.XI_API_KEY;
if (!KEY) { console.error("XI_API_KEY not set"); process.exit(1); }
const [input, out] = process.argv.slice(2);
if (!input || !out) { console.error("usage: transcribe.mjs <input> <out.txt>"); process.exit(1); }

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const tmpMp3 = path.join(os.tmpdir(), `bbb-audio-${Date.now()}.mp3`);

// Extract a compact mono mp3 (small upload, plenty for STT)
const ff = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", tmpMp3], { stdio: "inherit" });
if (ff.status !== 0 || !fs.existsSync(tmpMp3)) { console.error("ffmpeg audio extract failed"); process.exit(1); }

const form = new FormData();
form.append("model_id", "scribe_v1");
form.append("file", new Blob([fs.readFileSync(tmpMp3)], { type: "audio/mpeg" }), "audio.mp3");

const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  method: "POST",
  headers: { "xi-api-key": KEY },
  body: form,
});
const body = await r.json().catch(() => ({}));
fs.rmSync(tmpMp3, { force: true });
if (!r.ok || !body.text) { console.error("STT failed", r.status, JSON.stringify(body).slice(0, 300)); process.exit(1); }

fs.writeFileSync(out, body.text, "utf8");
console.error(`transcript: ${body.text.length} chars -> ${out}`);
console.log(body.text.slice(0, 500));
