# AutoClipperPro

**Paste a reel link → get a business plan + a captioned breakdown video with your talking-head avatar in the corner.**

AutoClipperPro is a desktop app (Windows / macOS) that takes a viral business reel and runs a fully automated pipeline:

1. **Downloads** the reel (YouTube / Instagram / TikTok / Facebook)
2. **Removes spliced-in ads** from the clip (optional, needs a local vision model)
3. **Transcribes** it and samples keyframes
4. **"Watches"** the video with an AI (cloud API *or* your own local GPU) and tears down the business
5. **Writes a business plan** + a short narration script (US-market angle + import sourcing)
6. **Renders a talking-head avatar** reading the script (HeyGen)
7. **Burns captions** and **composites** your avatar into the corner over the original reel
8. **Publishes** a titled PDF + the finished MP4 (optionally straight to Google Drive)

Drop in a queue of links and it churns through them one at a time. Accuracy over speed — expect roughly **5–10 minutes per reel**.

> **Bring your own keys.** AutoClipperPro ships with no credentials. You wire up your own API keys in **Settings (⚙)** and they're stored locally on your machine only.

---

## Quick start

1. **Install the prerequisites** (see below).
2. Download the latest installer from the [Releases](../../releases) page (`.exe` for Windows, `.dmg` for macOS), or run from source (also below).
3. Launch AutoClipperPro, click the **⚙ gear**, and fill in your keys.
4. Click **Save**, paste one or more reel links into the box, and hit **Add to Queue**.

---

## Prerequisites

These are external command-line tools the pipeline shells out to. Install the ones you need:

| Tool | Required? | What it's for | Get it |
|---|---|---|---|
| **ffmpeg / ffprobe** | ✅ Required | Frame extraction, audio, compositing, burning captions | https://ffmpeg.org/download.html (or `winget install Gyan.FFmpeg` / `brew install ffmpeg`) |
| **yt-dlp** | ✅ Required | Downloading the source reel | https://github.com/yt-dlp/yt-dlp (or `winget install yt-dlp` / `brew install yt-dlp`) |
| **Node.js 18+** | ✅ Only if running from source | Runs the app + pipeline scripts | https://nodejs.org |
| **Chrome / Chromium** | ⬜ Optional | Renders the business-plan PDF | Likely already installed; otherwise point the app at any Chromium build |
| **Ollama** | ⬜ Optional | Local "brain" + ad detection on your own GPU (no cloud bill) | https://ollama.com |
| **rclone** | ⬜ Optional | Auto-upload deliverables to Google Drive | https://rclone.org/downloads |

Make sure `ffmpeg`, `ffprobe`, and `yt-dlp` are on your **PATH**, or enter their full paths under **Settings → Advanced**.

---

## API keys you'll need

Open **Settings (⚙)** in the app and fill these in. Everything is saved locally to your user-data folder (`config.json`) — nothing is sent anywhere except the providers you configure.

### Brain (watching + writing) — pick ONE

**Cloud (easiest):**
- **Provider** — *Claude (Anthropic)* or any *OpenAI-compatible* endpoint.
- **API key** — your `sk-ant-…` (Anthropic) or `sk-…` (OpenAI-compatible) key.
- **Model** — e.g. `claude-opus-4-8` for Anthropic, or your provider's vision-capable model.
- **Base URL** — only for OpenAI-compatible providers (e.g. `https://api.openai.com/v1`).

**Local (no cloud bill, needs a decent GPU):**
- **Ollama host** — e.g. `http://localhost:11434` (or a networked box).
- **Vision model** — e.g. `qwen2.5vl:7b` (pull it first: `ollama pull qwen2.5vl:7b`).
- **Text model** — e.g. `qwen2.5:14b`.

> Local ad-removal uses the **Vision model** too. If you leave the Ollama host blank, the ad-scan step is skipped and the full reel is used.

### Voice & avatar (required for the video)
- **ElevenLabs key** — used for speech-to-text word timings (captions). Get one at https://elevenlabs.io.
- **HeyGen key** — renders your talking-head avatar. **Needs a paid HeyGen plan with API credits.** https://heygen.com.
- **Avatar ID** — the HeyGen avatar to use. List yours in HeyGen, or via the bundled helper (`node pipeline/heygen.mjs avatars` with `HEYGEN_API_KEY` set).
- **Voice ID** — the HeyGen voice the avatar speaks with (`node pipeline/heygen.mjs voices`).

### Advanced (optional)
Tool paths (ffmpeg/ffprobe/yt-dlp/Chrome), a custom **output folder**, and **rclone** + **remote name** if you want deliverables pushed to Google Drive automatically.

---

## Running from source

```bash
git clone https://github.com/bensblueprints/AutoClipperPro.git
cd AutoClipperPro
npm install
npm start
```

To build an installer:

```bash
npm run dist:win   # Windows  → release/AutoClipperPro Setup x.y.z.exe
npm run dist:mac   # macOS    → release/AutoClipperPro-x.y.z.dmg
```

---

## How it works (under the hood)

The Electron app (`main.js`) runs a sequential queue. For each link it calls `runPipeline()` in `pipeline.js`, which orchestrates the stage scripts in `pipeline/` by shelling out to `node` and `powershell`/`pwsh`, passing your settings in as environment variables. Stages:

`download → ad-scan → transcribe → frames → watch → write → avatar → captions → composite → publish`

Each run lands in its own folder (default `~/AutoClipperPro-output/<job-id>/`) containing the clip, frames, transcript, teardown, business plan, the rendered avatar, the final video, and the PDF.

---

## Notes & limits

- **HeyGen needs API credits**, not just a web subscription — you'll get an "insufficient credit" error until your API balance is topped up.
- **Accuracy over speed by design.** The ad-scan samples at 4fps and the pipeline favors quality; a reel typically takes 5–10 minutes end to end.
- **Your keys stay local.** They live in your OS user-data folder and are only sent to the providers you configured.
- **PowerShell** scripts are used for download/compositing. On macOS/Linux install PowerShell (`pwsh`) or adapt those steps.

## License

MIT — see [LICENSE](LICENSE).
