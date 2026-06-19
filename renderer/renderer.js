const $ = (id) => document.getElementById(id);
const urlsEl = $("urls"), queueEl = $("queue"), qcount = $("qcount");
let STAGES = [];

const STAGE_LABEL = {
  download: "Download", "ad-scan": "Ad scan", transcribe: "Transcribe", frames: "Frames",
  watch: "Watch", write: "Write plan", avatar: "Avatar (HeyGen)", captions: "Captions",
  composite: "Composite", publish: "Publish", done: "Done",
};

async function add() {
  const text = urlsEl.value.trim();
  if (!text) return;
  const n = await window.api.addUrls(text);
  if (n > 0) urlsEl.value = "";
}
$("add").onclick = add;
urlsEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); });
$("clear").onclick = () => window.api.clearDone();

function stageBar(job) {
  const curIdx = job.stage === "done" ? STAGES.length : STAGES.indexOf(job.stage);
  return `<div class="stages">` + STAGES.map((s, i) => {
    let cls = "st";
    if (job.status === "done" || i < curIdx) cls += " ok";
    else if (i === curIdx && job.status === "running") cls += " active";
    else if (job.status === "error" && i === curIdx) cls += " err";
    return `<span class="${cls}" title="${STAGE_LABEL[s] || s}"></span>`;
  }).join("") + `</div>`;
}

function render(state) {
  STAGES = state.stages || STAGES;
  const q = state.queue || [];
  qcount.textContent = q.length ? `${q.length} in queue · ${q.filter((j) => j.status === "done").length} done` : "Queue empty";
  queueEl.innerHTML = q.map((job) => {
    const statusTxt =
      job.status === "running" ? `${STAGE_LABEL[job.stage] || "working"}…${job.msg ? "  " + esc(job.msg) : ""}` :
      job.status === "done" ? `✓ ${esc(job.result?.title || "Done")}` :
      job.status === "error" ? `✗ ${esc(job.error || "failed")}` : "Queued";
    let actions = "";
    if (job.status === "done") {
      actions = `<button data-act="reveal" data-v="${esc(job.result?.video || "")}">Reveal</button>` +
        (job.result?.drive ? `<button data-act="drive" data-v="${esc(job.result.drive)}">Drive</button>` : "") +
        `<button data-act="folder" data-v="${esc(job.result?.dir || "")}">Folder</button>`;
    } else if (job.status === "error") {
      actions = `<button data-act="retry" data-v="${job.id}">Retry</button><button data-act="remove" data-v="${job.id}">✕</button>`;
    } else if (job.status === "queued") {
      actions = `<button data-act="remove" data-v="${job.id}">✕</button>`;
    }
    return `<div class="item ${job.status}">
      <div class="item-top"><span class="url">${esc(job.url)}</span><span class="actions">${actions}</span></div>
      ${stageBar(job)}
      <div class="status ${job.status}">${statusTxt}</div>
    </div>`;
  }).join("");
}

queueEl.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case "reveal": window.api.reveal(v); break;
    case "drive": window.api.openUrl(v); break;
    case "folder": window.api.openFolder(v); break;
    case "retry": window.api.retry(Number(v)); break;
    case "remove": window.api.remove(Number(v)); break;
  }
});

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

window.api.onState(render);
window.api.getState().then(render);

// ---- settings ----
const settingsEl = $("settings");
const FIELDS = ["cloudProvider:provider", "cloudKey", "cloudModel", "cloudBaseUrl",
  "ollamaHost", "localVlm", "localLlm", "elevenKey", "heygenKey", "heygenAvatarId", "heygenVoiceId",
  "ffmpegPath", "ffprobePath", "ytDlpPath", "chromePath", "outputDir", "rclonePath", "rcloneRemote"];
const fid = (f) => f.includes(":") ? f.split(":")[1] : f;
const fkey = (f) => f.split(":")[0];

$("gear").onclick = () => settingsEl.classList.toggle("hidden");
function syncSettingsUI() {
  const brain = document.querySelector('input[name="brain"]:checked').value;
  $("cloud-fields").style.display = brain === "cloud" ? "" : "none";
  $("local-fields").style.display = brain === "local" ? "" : "none";
  $("baseRow").style.display = $("provider").value === "openai" ? "" : "none";
}
document.querySelectorAll('input[name="brain"]').forEach((r) => r.addEventListener("change", syncSettingsUI));
$("provider").addEventListener("change", syncSettingsUI);
$("saveCfg").onclick = async () => {
  const cfg = { brain: document.querySelector('input[name="brain"]:checked').value };
  for (const f of FIELDS) cfg[fkey(f)] = $(fid(f)).value.trim();
  await window.api.saveConfig(cfg);
  $("setMsg").textContent = "Saved ✓"; setTimeout(() => ($("setMsg").textContent = ""), 1500);
};
window.api.getConfig().then((c) => {
  if (!c) return;
  document.querySelector(`input[name="brain"][value="${c.brain || "cloud"}"]`).checked = true;
  for (const f of FIELDS) { const el = $(fid(f)); if (el && c[fkey(f)] != null) el.value = c[fkey(f)]; }
  syncSettingsUI();
});
