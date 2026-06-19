const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { runPipeline, STAGES } = require("./pipeline");

let win;
// cloud/brain config persisted in userData
const cfgPath = () => path.join(app.getPath("userData"), "config.json");
const DEFAULTS = {
  brain: "cloud",
  cloudProvider: "anthropic", cloudModel: "claude-opus-4-8", cloudBaseUrl: "", cloudKey: "",
  ollamaHost: "", localVlm: "qwen2.5vl:7b", localLlm: "qwen2.5:14b",
  elevenKey: "", heygenKey: "", heygenAvatarId: "", heygenVoiceId: "",
  ffmpegPath: "ffmpeg", ffprobePath: "ffprobe", ytDlpPath: "yt-dlp", chromePath: "",
  outputDir: "", rclonePath: "", rcloneRemote: "", rcloneBase: "AutoClipperPro",
  brandName: "", ctaUrl: "",
};
function loadCfg() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(cfgPath(), "utf8")) }; }
  catch { return { ...DEFAULTS }; }
}
function saveCfg(c) { fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); }
let config = null;
const queue = []; // {id, url, status: queued|running|done|error, stage, msg, result, error}
let processing = false;
let counter = 0;

function broadcast() { if (win) win.webContents.send("state", { queue, stages: STAGES }); }

function addUrls(text) {
  const urls = (text.match(/https?:\/\/[^\s]+/g) || []).map((u) => u.replace(/[.,)]+$/, ""));
  for (const url of urls) queue.push({ id: ++counter, url, status: "queued", stage: null, msg: "", result: null, error: null });
  broadcast();
  pump();
  return urls.length;
}

async function pump() {
  if (processing) return;
  const job = queue.find((j) => j.status === "queued");
  if (!job) return;
  processing = true;
  job.status = "running"; broadcast();
  try {
    const res = await runPipeline(job.url, `job-${job.id}-${Date.now()}`, (stage, state, msg) => {
      job.stage = stage; job.msg = msg || ""; job.stageState = state; broadcast();
    }, config || loadCfg());
    job.status = "done"; job.result = res; job.stage = "done"; job.msg = res.title || "";
  } catch (e) {
    job.status = "error"; job.error = String(e.message || e);
  }
  broadcast();
  processing = false;
  setTimeout(pump, 200); // next job
}

ipcMain.handle("add-urls", (_e, text) => addUrls(text));
ipcMain.handle("get-state", () => ({ queue, stages: STAGES }));
ipcMain.handle("retry", (_e, id) => { const j = queue.find((x) => x.id === id); if (j) { j.status = "queued"; j.error = null; broadcast(); pump(); } });
ipcMain.handle("remove", (_e, id) => { const i = queue.findIndex((x) => x.id === id && x.status !== "running"); if (i >= 0) queue.splice(i, 1); broadcast(); });
ipcMain.handle("clear-done", () => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].status === "done") queue.splice(i, 1); broadcast(); });
ipcMain.handle("reveal", (_e, file) => { if (file) shell.showItemInFolder(file); });
ipcMain.handle("open-folder", (_e, dir) => { if (dir) shell.openPath(dir); });
ipcMain.handle("open-url", (_e, url) => { if (url) shell.openExternal(url); });
ipcMain.handle("get-config", () => { config = config || loadCfg(); return config; });
ipcMain.handle("save-config", (_e, c) => { config = { ...loadCfg(), ...c }; saveCfg(config); return config; });

function createWindow() {
  win = new BrowserWindow({
    width: 760, height: 820, minWidth: 560, minHeight: 600,
    backgroundColor: "#0b0b0c", title: "AutoClipperPro",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  config = loadCfg();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
