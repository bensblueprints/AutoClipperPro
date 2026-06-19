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

const BRAND = process.env.ACP_BRAND || "";
const CTA_URL = process.env.ACP_CTA_URL || "";
const brandFor = BRAND ? ` writing for "${BRAND}"` : "";
const ctaLine = CTA_URL ? `CTA (grab the full business plan FREE at ${CTA_URL})` : "a short CTA to follow for more";
const PLAN = `You are a sharp business analyst${brandFor}. From these notes about a viral business, write a concise, punchy **business plan in Markdown** for launching it in the USA. Use these sections: # Title, ## The Insight, ## The Product, ## US Market & Competitors, ## Startup Cost & Unit Economics, ## China Import Sourcing (FOB + landed cost ranges), ## Revenue Potential, ## Go-To-Market, ## 30/60/90-Day Launch, ## Risks. Be specific with dollar figures and realistic. Notes:\n"""${teardown}"""`;

const DAY = process.env.BBB_DAY || "1";
const SCRIPT = `Write a 60-90 second short-form video script in a confident, punchy, conversational voice — a high-energy creator talking straight to camera. Short sentences. Second person ("you", "if I were you", "guess what"). Light slang ("freaking"). Rhetorical questions. Zero corporate fluff.

Follow this EXACT 7-beat structure. Do NOT lead with the day counter:
1) HOOK (line 1): if the business centers on a PERSON doing a service/skill/trade, open "Look at this freaking guy right here" (use "girl" if she's a woman); if it centers on a PRODUCT/object/thing, open "Look at this freaking thing right here." (~3 of 4 scripts use this signature hook; occasionally instead open with a bold claim, a contrarian question, or "[real person] makes $[number] doing [thing]".)
2) ONE sentence: what it is and why it's great.
3) Weave in, SECOND (never first): "Day ${DAY} of genius business ideas, follow for more."
4) The mechanism: how it actually works, plainly.
5) MANDATORY money math: concrete cost -> price -> margin, plus an hourly or monthly number. Name real stores/tools/brands (Home Depot, Hobby Lobby, Facebook Marketplace, etc.). Specific beats big.
6) The clever angle: give the tactic a memorable 2-3 word NAME (e.g. "the piggyback method", "white labeling"), plus the sourcing/sales edge and China sourcing if relevant. Pre-empt the excuses, then push ("you can make excuses... or you can go try the thing. You either win or you learn.").
7) Close on a punchy one-line aphorism, THEN the CTA: ${ctaLine}.

Mark the beats in [brackets]. Keep it tight and high-energy. Match the voice/structure of these two GOLD-STANDARD examples (match energy & structure, do NOT reuse their content):
EXAMPLE A: "Look at this freaking guy right here. This guy makes $15,000 a month building custom garage shelves and selling them exclusively on Facebook Marketplace, and I know exactly how you can copy him. He sells these for $770, pays $200 in materials, and all he needs is a chop saw from Home Depot. These are too big to ship, so anyone in any little market could build the same shelves and sell them for the same prices. Go grab the full plan."
EXAMPLE B: "Look at this freaking thing right here. These are called fabric ceilings, super popular in Europe, and they need to be here in the US. I call it the piggyback method: find a dozen pergola installers and have them offer this as a $1,000 upcharge — you do all the work and give them $200 per referral. Your cost is $200, labor's a couple hours, and you're making two to three hundred bucks an hour. Full business plan here."

Now write the script for THIS business. Notes:\n"""${teardown}"""`;

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
