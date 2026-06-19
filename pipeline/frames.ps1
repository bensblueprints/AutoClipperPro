<#
  Extract ~N evenly-spaced keyframes from a video as JPGs (for Claude to "watch").
  Usage: powershell -ExecutionPolicy Bypass -File frames.ps1 <video> <outDir> [count]
  Requires ffmpeg + ffprobe on PATH (set FFMPEG_PATH / FFPROBE_PATH to override).
#>
param(
  [Parameter(Mandatory = $true)][string]$Video,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Count = 15
)
$ErrorActionPreference = 'Stop'
$ffmpeg  = if ($env:FFMPEG_PATH)  { $env:FFMPEG_PATH }  else { 'ffmpeg' }
$ffprobe = if ($env:FFPROBE_PATH) { $env:FFPROBE_PATH } else { 'ffprobe' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Duration in seconds
$dur = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $Video 2>$null
$dur = [double]($dur -replace '[^0-9.]', '')
if (-not $dur -or $dur -le 0) { $dur = 60 }

# frames-per-second needed to land ~$Count frames across the clip
$fps = [math]::Max(0.05, [math]::Round($Count / $dur, 4))

& $ffmpeg -hide_banner -loglevel error -i $Video -vf "fps=$fps" -q:v 3 (Join-Path $OutDir 'frame_%03d.jpg') 2>$null

$made = Get-ChildItem $OutDir -Filter 'frame_*.jpg' -ErrorAction SilentlyContinue
Write-Output ("extracted {0} frames from {1:N1}s clip (fps={2}) -> {3}" -f $made.Count, $dur, $fps, $OutDir)
