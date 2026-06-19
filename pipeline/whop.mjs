#!/usr/bin/env node
// Whop helper for the /bbb pipeline.  Auth: WHOP_API_KEY (Bearer).
// Base: https://api.whop.com/api/v1
//
// NOTE: Whop's API can create courses + chapters but CANNOT create lesson
// content or upload PDFs/docs — that final attach is a manual click in Whop's UI.
//
// Usage:
//   node whop.mjs company
//   node whop.mjs courses
//   node whop.mjs experiences
//   node whop.mjs create-course <experienceId> <title> [tagline]   -> course id
//   node whop.mjs create-chapter <courseId> <title>                -> chapter id
import process from "node:process";

const KEY = process.env.WHOP_API_KEY;
const COMPANY = process.env.WHOP_COMPANY_ID;
if (!KEY) { console.error("WHOP_API_KEY not set"); process.exit(1); }
const BASE = "https://api.whop.com/api/v1";
const H = { Authorization: `Bearer ${KEY}`, Accept: "application/json" };

async function req(method, url, payload) {
  const opt = { method, headers: { ...H } };
  if (payload) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(payload); }
  const r = await fetch(url, opt);
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

const [cmd, ...args] = process.argv.slice(2);

try {
  if (cmd === "company") {
    const { body } = await req("GET", "https://api.whop.com/v5/company");
    console.log(JSON.stringify({ id: body.id, title: body.title }, null, 2));
  } else if (cmd === "courses") {
    const { body } = await req("GET", `${BASE}/courses?company_id=${COMPANY}`);
    console.log(JSON.stringify((body.data || []).map((c) => ({ id: c.id, title: c.title })), null, 2));
  } else if (cmd === "experiences") {
    const { body } = await req("GET", `${BASE}/experiences?company_id=${COMPANY}`);
    console.log(JSON.stringify((body.data || []).map((e) => ({ id: e.id, name: e.name, app: e.app?.name })), null, 2));
  } else if (cmd === "create-course") {
    const [experienceId, title, tagline] = args;
    const { ok, status, body } = await req("POST", `${BASE}/courses`, { experience_id: experienceId, title, tagline: tagline || "" });
    if (!ok) { console.error("create-course failed", status, JSON.stringify(body)); process.exit(1); }
    console.log(JSON.stringify({ id: body.id || body.data?.id, title }, null, 2));
  } else if (cmd === "forum-post") {
    // Reliable API publish path: post to a forum experience.
    // Usage: forum-post <experienceId> <title> <contentFile>
    const [experienceId, title, contentFile] = args;
    const fs = await import("node:fs");
    const content = fs.readFileSync(contentFile, "utf8");
    const { ok, status, body } = await req("POST", `${BASE}/forum_posts`, { experience_id: experienceId, title, content });
    if (!ok) { console.error("forum-post failed", status, JSON.stringify(body)); process.exit(1); }
    console.log(JSON.stringify({ id: body.id || body.data?.id, title, url: body.url }, null, 2));
  } else if (cmd === "create-chapter") {
    const [courseId, title] = args;
    const { ok, status, body } = await req("POST", `${BASE}/courses/${courseId}/chapters`, { title });
    if (!ok) { console.error("create-chapter failed", status, JSON.stringify(body)); process.exit(1); }
    console.log(JSON.stringify({ id: body.id || body.data?.id, title }, null, 2));
  } else {
    console.error("unknown command:", cmd);
    process.exit(1);
  }
} catch (e) {
  console.error("error:", e.message);
  process.exit(1);
}
