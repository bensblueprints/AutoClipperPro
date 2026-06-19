<#
  clip-grab — download highest-quality social video(s) and open the folder.
  Usage:  powershell -ExecutionPolicy Bypass -File grab.ps1 <url> [<url> ...]
  Env:    CLIP_GRAB_DIR  (output folder; default D:\jarvis-downloads\clips)
          YT_DLP_PATH    (yt-dlp binary; default 'yt-dlp')
          CLIP_GRAB_NOOPEN=1  (don't pop Explorer)
  Supports: YouTube (incl. Shorts), Instagram, TikTok, Facebook Reels.
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Urls)

$ErrorActionPreference = 'Continue'
$out = if ($env:CLIP_GRAB_DIR) { $env:CLIP_GRAB_DIR } else { 'D:\jarvis-downloads\clips' }
New-Item -ItemType Directory -Force -Path $out | Out-Null
$ytdlp = if ($env:YT_DLP_PATH) { $env:YT_DLP_PATH } else { 'yt-dlp' }
$tmpl = Join-Path $out '%(uploader)s - %(title).80s [%(id)s].%(ext)s'

# Common args: best video+audio merged to a clean mp4, safe filenames, no playlists.
$common = @(
  '--no-playlist', '--no-warnings', '--no-progress', '--restrict-filenames',
  '-f', 'bv*+ba/b', '--merge-output-format', 'mp4',
  '--no-simulate', '--print', 'after_move:filepath', '-o', $tmpl
)
if ($env:YT_DLP_COOKIES) { $common += @('--cookies', $env:YT_DLP_COOKIES) }

function Invoke-YtDlp([string]$url) {
  # Primary: the configured yt-dlp binary. Fallback: the pip module (avoids the
  # winget onefile's occasional PyInstaller self-extraction failures on Windows).
  $fp = & $ytdlp @common $url 2>$null
  if ($LASTEXITCODE -eq 0 -and $fp) { return ($fp | Select-Object -Last 1) }
  $fp = & py -m yt_dlp @common $url 2>$null
  if ($LASTEXITCODE -eq 0 -and $fp) { return ($fp | Select-Object -Last 1) }
  return $null
}

if (-not $Urls -or $Urls.Count -eq 0) { Write-Host 'No URLs given.'; exit 1 }

$saved = @()
$failed = @()
foreach ($u in $Urls) {
  $u = $u.Trim()
  if (-not $u) { continue }
  Write-Host "downloading: $u"
  $file = Invoke-YtDlp $u
  if ($file) { $saved += $file; Write-Host "  saved: $file" }
  else { $failed += $u; Write-Host "  FAILED: $u" }
}

Write-Host ""
Write-Host ("{0} downloaded, {1} failed -> {2}" -f $saved.Count, $failed.Count, $out)
$saved | ForEach-Object { Write-Host "  * $_" }
if ($failed.Count) { Write-Host "Failed:"; $failed | ForEach-Object { Write-Host "  ! $_" } }

if ($saved.Count -gt 0 -and -not $env:CLIP_GRAB_NOOPEN) { Start-Process explorer.exe $out }
exit ([int]($failed.Count -gt 0))
