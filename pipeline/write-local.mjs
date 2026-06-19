#!/usr/bin/env node
// Local research + writing via an Ollama LLM. From a teardown, writes
// business-plan.md, script.md, narration.txt. Usage: node write-local.mjs <teardown.md> <folder>
// Env: OLLAMA_HOST (http://localhost:11434), BBB_LLM (qwen2.5:14b)
import fs from "node:fs";
import path from "node:path";

const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const LLM = process.env.BBB_LLM || "qwen2.5:14b";
const [teardownFile, folder] = process.argv.slice(2);
const teardown = fs.readFileSync(teardownFile, "utf8");

async function gen(prompt) {
  const r = await fetch(`${HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: LLM, prompt, stream: false, options: { temperature: 0.6, num_ctx: 8192 } }),
  });
  if (!r.ok) { console.error("Ollama LLM error", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const j = await r.json();
  return (j.response || "").trim();
}

const PLAN = `You are a sharp business analyst writing for "Benji's AI Empire". From these notes about a viral business, write a concise, punchy **business plan in Markdown** for launching it in the USA. Use these sections: # Title, ## The Insight, ## The Product, ## US Market & Competitors, ## Startup Cost & Unit Economics, ## China Import Sourcing (FOB + landed cost ranges), ## Revenue Potential, ## Go-To-Market, ## 30/60/90-Day Launch, ## Risks. Be specific with dollar figures and realistic. Notes:\n"""${teardown}"""`;

const DAY = process.env.BBB_DAY || "1";
const SCRIPT = `Write a 75-90 second short-form video script in Benji's voice (confident, direct, no fluff).
It MUST open with these two spoken lines, in order:
1) "Day ${DAY} of genius business ideas, follow for more."
2) A hook based on the subject: if the business centers on a PERSON doing a service/skill/trade, say "Look at this freaking guy right here" (use "girl" if the person is a woman); if it centers on a PRODUCT / object / thing, say "Look at this freaking thing right here."
Then continue: THE INSIGHT, PROOF/NUMBERS, HOW TO BUILD IT (incl. China sourcing), HOW TO START, CTA (grab the full business plan FREE at BenjisAIEmpire.com). Mark sections in brackets. Notes:\n"""${teardown}"""`;

console.error(`writing with ${LLM} @ ${HOST} ...`);
const plan = await gen(PLAN);
fs.writeFileSync(path.join(folder, "business-plan.md"), plan, "utf8");
console.error(`business-plan.md (${plan.length} chars)`);

const script = await gen(SCRIPT);
fs.writeFileSync(path.join(folder, "script.md"), script, "utf8");
console.error(`script.md (${script.length} chars)`);

const narration = await gen(`Rewrite the following script as ONLY the spoken words — no section labels, no brackets, no stage directions, no markdown, no quotes. Plain spoken text only, ready for text-to-speech. Script:\n"""${script}"""`);
fs.writeFileSync(path.join(folder, "narration.txt"), narration, "utf8");
console.error(`narration.txt (${narration.length} chars)`);
console.log("done");
