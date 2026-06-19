// AutoClipperPro pipeline: reel URL -> business plan + breakdown video.
// Fully config-driven (keys/paths entered in the app, nothing hardcoded).
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PIPE = path.join(__dirname, "pipeline");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { env: { ...process.env, ...(opts.env || {}) }, cwd: opts.cwd, windowsHide: true }); }
    catch (e) { return reject(e); }
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || opts.ignoreCode) resolve({ code, out, err });
      else reject(new Error(`${path.basename(args[args.length - 1] || cmd)} exited ${code}: ${err.slice(-300)}`));
    });
  });
}
const ps = (s, a, o) => run("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(PIPE, s), ...a], o);
const node = (s, a, o) => run("node", [path.join(PIPE, s), ...a], o);
const lastJson = (s) => { const m = s.match(/\{[\s\S]*\}/g); return m ? JSON.parse(m[m.length - 1]) : null; };

const STAGES = ["download", "ad-scan", "transcribe", "frames", "watch", "write", "avatar", "captions", "composite", "publish"];

async function runPipeline(url, jobId, onStage, cfg = {}) {
  const outBase = cfg.outputDir || path.join(process.env.USERPROFILE || ".", "AutoClipperPro-output");
  const dir = path.join(outBase, jobId);
  fs.mkdirSync(dir, { recursive: true });
  const ff = cfg.ffmpegPath || "ffmpeg";
  const result = { dir };

  const brand = { ACP_BRAND: cfg.brandName || "", ACP_CTA_URL: cfg.ctaUrl || "" };
  const base = {
    FFMPEG_PATH: cfg.ffmpegPath || "", FFPROBE_PATH: cfg.ffprobePath || "",
    XI_API_KEY: cfg.elevenKey || "", HEYGEN_API_KEY: cfg.heygenKey || "",
    OLLAMA_HOST: cfg.ollamaHost || "", BBB_VLM: cfg.localVlm || "qwen2.5vl:7b", BBB_LLM: cfg.localLlm || "qwen2.5:14b",
    CHROME_PATH: cfg.chromePath || "", RCLONE_PATH: cfg.rclonePath || "", ...brand,
  };
  const cloudEnv = { BBB_CLOUD_PROVIDER: cfg.cloudProvider || "anthropic", BBB_CLOUD_KEY: cfg.cloudKey || "", BBB_CLOUD_MODEL: cfg.cloudModel || "", BBB_CLOUD_BASEURL: cfg.cloudBaseUrl || "", ...brand };
  const useCloud = cfg.brain === "cloud" && cfg.cloudKey;
  const haveOllama = !!cfg.ollamaHost;

  const findClip = () => fs.readdirSync(dir).filter((f) => f.endsWith(".mp4") && !/avatar|final|clean/i.test(f)).map((f) => path.join(dir, f))[0];

  // 1) download
  onStage("download", "running");
  await ps("grab.ps1", [url], { env: { ...base, CLIP_GRAB_DIR: dir, CLIP_GRAB_NOOPEN: "1", YT_DLP_PATH: cfg.ytDlpPath || "yt-dlp" } });
  const clip = findClip();
  if (!clip) throw new Error("download produced no file");
  onStage("download", "done");

  // 2) ad-scan + cut (VLM if Ollama configured, else skip)
  let reel = clip;
  onStage("ad-scan", "running");
  if (haveOllama) {
    const scan = await node("adscan-vlm.mjs", [clip, "4"], { env: base });
    const segs = (lastJson(scan.out) || {}).segments || [];
    if (segs.length) {
      reel = path.join(dir, "clip_clean.mp4");
      await ps("cut-segments.ps1", ["-Reel", clip, "-Out", reel, "-Segments", segs.map((s) => `${s.start}-${s.end}`).join(",")], { env: base });
    }
    onStage("ad-scan", "done", segs.length ? `cut ${segs.length}` : "clean");
  } else onStage("ad-scan", "done", "skipped");

  // 3) transcribe + 4) frames
  onStage("transcribe", "running");
  await node("transcribe.mjs", [clip, path.join(dir, "transcript.txt")], { env: base });
  onStage("transcribe", "done");
  onStage("frames", "running");
  await ps("frames.ps1", [clip, path.join(dir, "frames"), "15"], { env: base });
  onStage("frames", "done");

  // 5) watch
  onStage("watch", "running", useCloud ? "cloud" : "local");
  if (useCloud) await node("watch-cloud.mjs", [path.join(dir, "frames"), path.join(dir, "transcript.txt"), path.join(dir, "teardown.md")], { env: cloudEnv });
  else await node("watch-local.mjs", [path.join(dir, "frames"), path.join(dir, "transcript.txt"), path.join(dir, "teardown.md")], { env: base });
  onStage("watch", "done");

  // 6) write (day + hook)
  onStage("write", "running", useCloud ? "cloud" : "local");
  const day = (await node("daycount.mjs", ["next"]).catch(() => ({ out: "1" }))).out.trim() || "1";
  if (useCloud) await node("write-cloud.mjs", [path.join(dir, "teardown.md"), dir], { env: { ...cloudEnv, BBB_DAY: day } });
  else await node("write-local.mjs", [path.join(dir, "teardown.md"), dir], { env: { ...base, BBB_DAY: day } });
  const planMd = fs.readFileSync(path.join(dir, "business-plan.md"), "utf8");
  const title = ((planMd.match(/^#\s+(.+)$/m) || [])[1] || `Business ${jobId}`).replace(/business plan/i, "").trim() || `Business ${jobId}`;
  result.title = title; result.day = day;
  onStage("write", "done", `Day ${day}: ${title}`);

  // 7) avatar (HeyGen)
  onStage("avatar", "running");
  const gen = await node("heygen.mjs", ["generate-text", cfg.heygenAvatarId, cfg.heygenVoiceId, path.join(dir, "narration.txt"), title, "1280", "720"], { env: base });
  const vid = (lastJson(gen.out) || {}).video_id;
  if (!vid) throw new Error("HeyGen returned no video_id (check key / credits / avatar id)");
  await node("heygen.mjs", ["download", vid, path.join(dir, "avatar.mp4")], { env: base });
  onStage("avatar", "done");

  // 8) captions (ElevenLabs word timings)
  onStage("captions", "running");
  await run(ff, ["-y", "-hide_banner", "-loglevel", "error", "-i", path.join(dir, "avatar.mp4"), "-vn", "-ar", "44100", path.join(dir, "vo.mp3")]);
  await node("captions.mjs", [path.join(dir, "vo.mp3"), path.join(dir, "captions.ass"), "1080", "1920", "1150"], { env: base });
  onStage("captions", "done");

  // 9) composite
  onStage("composite", "running");
  await ps("composite.ps1", ["-Reel", reel, "-Avatar", path.join(dir, "avatar.mp4"), "-Audio", path.join(dir, "vo.mp3"), "-Out", path.join(dir, "final.mp4"), "-Captions", path.join(dir, "captions.ass"), "-Corner", "bottom-right", "-BandTop", "1300", "-BandH", "480"], { env: base });
  onStage("composite", "done");

  // 10) publish: titled PDF (best-effort) + optional Drive
  onStage("publish", "running");
  const safe = title.replace(/[<>:"/\\|?*]/g, "").trim();
  const pdf = path.join(dir, `${safe} - Business Plan.pdf`);
  const vidOut = path.join(dir, `${safe} - Breakdown.mp4`);
  await node("makepdf.mjs", [path.join(dir, "business-plan.md"), pdf, title], { env: base, ignoreCode: true }).catch(() => {});
  try { fs.renameSync(path.join(dir, "final.mp4"), vidOut); } catch {}
  result.video = fs.existsSync(vidOut) ? vidOut : path.join(dir, "final.mp4");
  if (cfg.rclonePath && cfg.rcloneRemote) {
    const dest = `${cfg.rcloneRemote}:${cfg.rcloneBase || "AutoClipperPro"}/${safe}`;
    await run(cfg.rclonePath, ["copy", pdf, dest], { ignoreCode: true }).catch(() => {});
    await run(cfg.rclonePath, ["copy", result.video, dest], { ignoreCode: true }).catch(() => {});
    const link = await run(cfg.rclonePath, ["link", dest], { ignoreCode: true }).catch(() => ({ out: "" }));
    result.drive = (link.out.match(/https:\/\/\S+/) || [])[0] || null;
  }
  onStage("publish", "done");
  return result;
}

module.exports = { runPipeline, STAGES };
