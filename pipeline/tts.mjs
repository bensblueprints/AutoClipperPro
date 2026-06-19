#!/usr/bin/env node
// ElevenLabs TTS for the /bbb pipeline (reuses XI_API_KEY).
// Usage: node tts.mjs <textFile> <out.mp3> [voiceId]
import fs from "node:fs";

const KEY = process.env.XI_API_KEY;
if (!KEY) { console.error("XI_API_KEY not set"); process.exit(1); }
const [textFile, out, voiceId = "pNInz6obpgDQGcFmaJgB"] = process.argv.slice(2); // default "Adam"
const text = fs.readFileSync(textFile, "utf8").trim();

const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  }),
});
if (!r.ok) { console.error("TTS failed", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(out, buf);
console.log(JSON.stringify({ saved: out, bytes: buf.length, voiceId }, null, 2));
