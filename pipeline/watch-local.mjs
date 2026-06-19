#!/usr/bin/env node
// Local "watch": send keyframes + transcript to an Ollama vision model and get a
// structured business teardown. Usage: node watch-local.mjs <framesDir> <transcript.txt> <out.md>
// Env: OLLAMA_HOST (http://localhost:11434), BBB_VLM (qwen2.5vl:7b)
import fs from "node:fs";
import path from "node:path";

const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const VLM = process.env.BBB_VLM || "qwen2.5vl:7b";
const [framesDir, transcriptFile, out] = process.argv.slice(2);

const transcript = fs.existsSync(transcriptFile) ? fs.readFileSync(transcriptFile, "utf8") : "";
// pick up to 8 evenly-spaced frames
let frames = fs.readdirSync(framesDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();
if (frames.length > 8) {
  const step = frames.length / 8;
  frames = Array.from({ length: 8 }, (_, i) => frames[Math.floor(i * step)]);
}
const images = frames.map((f) => fs.readFileSync(path.join(framesDir, f)).toString("base64"));

const prompt = `You are analyzing a viral business reel (frames attached + transcript below).
Identify the business shown and explain it for an entrepreneur who wants to copy it in the USA.
Transcript: """${transcript}"""
Write concise structured notes covering: (1) what the business/product is, (2) how it makes money,
(3) why it's working / the hook, (4) target customer, (5) any visual product/brand details you see in the frames.`;

const r = await fetch(`${HOST}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: VLM,
    messages: [{ role: "user", content: prompt, images }],
    stream: false,
    options: { temperature: 0.4 },
  }),
});
if (!r.ok) { console.error("Ollama VLM error", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const j = await r.json();
const txt = j.message?.content || "";
if (!txt) { console.error("empty VLM response", JSON.stringify(j).slice(0, 300)); process.exit(1); }
fs.writeFileSync(out, txt, "utf8");
console.log(`teardown -> ${out} (${txt.length} chars, model ${VLM})`);
