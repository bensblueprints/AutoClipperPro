#!/usr/bin/env node
// HeyGen helper for the AutoClipperPro pipeline.
// Auth: HEYGEN_API_KEY via X-Api-Key header.
//
// Usage:
//   node heygen.mjs avatars                          list avatars + talking photos
//   node heygen.mjs voices                           list voices
//   node heygen.mjs upload <audioFile>               upload mp3/wav -> prints asset url+id
//   node heygen.mjs generate <avatarId> <audioUrl> <title> [w h]   -> prints video_id
//   node heygen.mjs status <videoId>                 -> prints status (+ url when done)
//   node heygen.mjs download <videoId> <outFile>     poll until done, download mp4
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.HEYGEN_API_KEY;
if (!KEY) { console.error("HEYGEN_API_KEY not set"); process.exit(1); }
const H = { "X-Api-Key": KEY, Accept: "application/json" };

async function jget(url) {
  const r = await fetch(url, { headers: H });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}
async function jpost(url, payload) {
  const r = await fetch(url, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [cmd, ...args] = process.argv.slice(2);

try {
  if (cmd === "avatars") {
    const { body } = await jget("https://api.heygen.com/v2/avatars");
    const av = (body.data?.avatars || []).map((a) => ({ id: a.avatar_id, name: a.avatar_name, type: "avatar" }));
    const tp = (body.data?.talking_photos || []).map((a) => ({ id: a.talking_photo_id, name: a.talking_photo_name, type: "talking_photo" }));
    console.log(JSON.stringify([...av, ...tp], null, 2));
  } else if (cmd === "voices") {
    const { body } = await jget("https://api.heygen.com/v2/voices");
    console.log(JSON.stringify((body.data?.voices || []).slice(0, 50).map((v) => ({ id: v.voice_id, name: v.name, lang: v.language })), null, 2));
  } else if (cmd === "upload") {
    const file = args[0];
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const ctype = ext === ".wav" ? "audio/wav" : "audio/mpeg";
    const r = await fetch("https://upload.heygen.com/v1/asset", { method: "POST", headers: { "X-Api-Key": KEY, "Content-Type": ctype }, body: buf });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("upload failed", r.status, JSON.stringify(body)); process.exit(1); }
    // returns data.id and data.url
    console.log(JSON.stringify({ id: body.data?.id, url: body.data?.url }, null, 2));
  } else if (cmd === "generate") {
    const [avatarId, audioUrl, title, w = "1280", h = "720"] = args;
    const payload = {
      title: title || "BBB explainer",
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "audio", audio_url: audioUrl },
        },
      ],
      dimension: { width: Number(w), height: Number(h) },
    };
    const { ok, status, body } = await jpost("https://api.heygen.com/v2/video/generate", payload);
    if (!ok || body.error) { console.error("generate failed", status, JSON.stringify(body)); process.exit(1); }
    console.log(JSON.stringify({ video_id: body.data?.video_id }, null, 2));
  } else if (cmd === "generate-text") {
    // Avatar speaks input text in a chosen (cloned) voice. LANDSCAPE 1280x720.
    const [avatarId, voiceId, textFile, title, w = "1280", h = "720"] = args;
    const input_text = fs.readFileSync(textFile, "utf8").trim();
    const payload = {
      title: title || "BBB explainer",
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", voice_id: voiceId, input_text },
        },
      ],
      dimension: { width: Number(w), height: Number(h) },
    };
    const { ok, status, body } = await jpost("https://api.heygen.com/v2/video/generate", payload);
    if (!ok || body.error) { console.error("generate-text failed", status, JSON.stringify(body)); process.exit(1); }
    console.log(JSON.stringify({ video_id: body.data?.video_id }, null, 2));
  } else if (cmd === "status") {
    const { body } = await jget(`https://api.heygen.com/v1/video_status.get?video_id=${args[0]}`);
    console.log(JSON.stringify({ status: body.data?.status, url: body.data?.video_url, error: body.data?.error }, null, 2));
  } else if (cmd === "download") {
    const [videoId, out] = args;
    let url = null;
    for (let i = 0; i < 120; i++) {
      const { body } = await jget(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`);
      const st = body.data?.status;
      process.stderr.write(`status: ${st}\n`);
      if (st === "completed") { url = body.data?.video_url; break; }
      if (st === "failed") { console.error("render failed", JSON.stringify(body.data?.error)); process.exit(1); }
      await sleep(5000);
    }
    if (!url) { console.error("timed out waiting for render"); process.exit(1); }
    const r = await fetch(url);
    const ab = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(out, ab);
    console.log(JSON.stringify({ saved: out, bytes: ab.length, url }, null, 2));
  } else {
    console.error("unknown command:", cmd);
    process.exit(1);
  }
} catch (e) {
  console.error("error:", e.message);
  process.exit(1);
}
