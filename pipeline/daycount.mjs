#!/usr/bin/env node
// Tracks how many BBB videos have been generated (shared by /bbb and /bbblocal).
// Usage: node daycount.mjs next   -> increment and print the new count (the "Day N")
//        node daycount.mjs peek   -> print current count without incrementing
import fs from "node:fs";
import path from "node:path";

const file = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "state.json");
const cmd = process.argv[2] || "peek";
let s = { count: 0 };
try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
if (cmd === "next") { s.count = (s.count || 0) + 1; fs.writeFileSync(file, JSON.stringify(s, null, 2)); }
console.log(s.count || 0);
