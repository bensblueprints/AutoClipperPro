#!/usr/bin/env node
// Cloud "watch": frames + transcript -> business teardown via a cloud LLM.
// Usage: node watch-cloud.mjs <framesDir> <transcript.txt> <out.md>
import fs from "node:fs";
import path from "node:path";
import { complete } from "./cloud-llm.mjs";

const [framesDir, transcriptFile, out] = process.argv.slice(2);
const transcript = fs.existsSync(transcriptFile) ? fs.readFileSync(transcriptFile, "utf8") : "";
let frames = fs.readdirSync(framesDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();
if (frames.length > 8) { const s = frames.length / 8; frames = Array.from({ length: 8 }, (_, i) => frames[Math.floor(i * s)]); }
const images = frames.map((f) => fs.readFileSync(path.join(framesDir, f)).toString("base64"));

const text = `You are analyzing a viral business reel (frames attached + transcript). Identify the business and explain it for an entrepreneur who wants to copy it in the USA.
Transcript: """${transcript}"""
Write concise structured notes: (1) what the business/product is, (2) how it makes money, (3) why it's working / the hook, (4) target customer, (5) visual product/brand details you see, (6) is the central subject a PERSON doing a service (note gender) or a PRODUCT/thing?`;

const teardown = await complete({ text, images, maxTokens: 2000 });
if (!teardown) { console.error("empty teardown"); process.exit(1); }
fs.writeFileSync(out, teardown, "utf8");
console.log(`teardown -> ${out} (${teardown.length} chars, cloud)`);
