#!/usr/bin/env node
// Cloud research + writing via a cloud LLM (Claude by default).
// From a teardown -> business-plan.md, script.md, narration.txt (with Day-N + hook).
// Usage: node write-cloud.mjs <teardown.md> <folder>
import fs from "node:fs";
import path from "node:path";
import { complete } from "./cloud-llm.mjs";

const [teardownFile, folder] = process.argv.slice(2);
const teardown = fs.readFileSync(teardownFile, "utf8");
const DAY = process.env.BBB_DAY || "1";

const PLAN = `You are a sharp business analyst writing for "Benji's AI Empire". From these notes about a viral business, write a concise, punchy **business plan in Markdown** for launching it in the USA. Sections: # Title, ## The Insight, ## The Product, ## US Market & Competitors, ## Startup Cost & Unit Economics, ## China Import Sourcing (FOB + landed cost ranges), ## Revenue Potential, ## Go-To-Market, ## 30/60/90-Day Launch, ## Risks. Be specific with real dollar figures. Notes:\n"""${teardown}"""`;

const SCRIPT = `Write a 75-90 second short-form video script in Benji's voice (confident, direct, no fluff).
It MUST open with these two spoken lines, in order:
1) "Day ${DAY} of genius business ideas, follow for more."
2) A hook based on the subject: if the business centers on a PERSON doing a service/skill/trade, say "Look at this freaking guy right here" (use "girl" if the person is a woman); if it centers on a PRODUCT / object / thing, say "Look at this freaking thing right here."
Then: THE INSIGHT, PROOF/NUMBERS, HOW TO BUILD IT (incl. China sourcing), HOW TO START, CTA (grab the full plan FREE at BenjisAIEmpire.com). Mark sections in brackets. Notes:\n"""${teardown}"""`;

console.error("writing with cloud LLM…");
const plan = await complete({ text: PLAN, maxTokens: 6000 });
fs.writeFileSync(path.join(folder, "business-plan.md"), plan, "utf8");
console.error(`business-plan.md (${plan.length})`);

const script = await complete({ text: SCRIPT, maxTokens: 3000 });
fs.writeFileSync(path.join(folder, "script.md"), script, "utf8");
console.error(`script.md (${script.length})`);

const narration = await complete({ text: `Rewrite this script as ONLY the spoken words — no section labels, no brackets, no stage directions, no markdown, no quotes. Plain spoken text only. Script:\n"""${script}"""`, maxTokens: 2000 });
fs.writeFileSync(path.join(folder, "narration.txt"), narration, "utf8");
console.error(`narration.txt (${narration.length})`);
console.log("done");
