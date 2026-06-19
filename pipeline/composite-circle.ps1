<#
  Placeholder version of the breakdown video for when HeyGen has no API credits:
  original reel full-screen (looped, muted) + a gold-ringed CIRCLE in the corner
  where the avatar will go + the VO as audio. Swap in composite.ps1 once credits exist.
  Usage: composite-circle.ps1 -Reel <reel> -Audio <vo.mp3> -Out <final.mp4>
         [-Corner bottom-left|bottom-right] [-WidthFrac 0.30] [-Margin 28]
#>
param(
  [Parameter(Mandatory)][string]$Reel,
  [Parameter(Mandatory)][string]$Audio,
  [Parameter(Mandatory)][string]$Out,
  [ValidateSet('bottom-left','bottom-right','top-left','top-right')][string]$Corner = 'bottom-left',
  [double]$WidthFrac = 0.30,
  [int]$Margin = 28
)
$ErrorActionPreference = 'Stop'
$ffmpeg  = if ($env:FFMPEG_PATH)  { $env:FFMPEG_PATH }  else { 'ffmpeg' }
$ffprobe = if ($env:FFPROBE_PATH) { $env:FFPROBE_PATH } else { 'ffprobe' }

$W = [int]((& $ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 $Reel) -replace '\D','')
if (-not $W) { $W = 1080 }
$D = [int]([math]::Round($W * $WidthFrac)); if ($D % 2) { $D++ }    # circle diameter
$c = $D / 2.0
$rOut = $c
$rIn  = $c - 7
$dur = [double]((& $ffprobe -v error -show_entries format=duration -of csv=p=0 $Audio) -replace '[^0-9.]','')

# 1) render the circle once as a transparent PNG (gold ring, dark fill)
$circle = Join-Path (Split-Path $Out) "_circle.png"
$geq = "format=rgba,geq=r='if(lte(hypot(X-$c\,Y-$c)\,$rIn)\,21\,212)':g='if(lte(hypot(X-$c\,Y-$c)\,$rIn)\,22\,175)':b='if(lte(hypot(X-$c\,Y-$c)\,$rIn)\,26\,55)':a='if(lte(hypot(X-$c\,Y-$c)\,$rOut)\,255\,0)'"
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=black:s=${D}x${D}" -vf $geq -frames:v 1 $circle

$pos = switch ($Corner) {
  'bottom-left'  { "${Margin}:H-h-${Margin}" }
  'bottom-right' { "W-w-${Margin}:H-h-${Margin}" }
  'top-left'     { "${Margin}:${Margin}" }
  'top-right'    { "W-w-${Margin}:${Margin}" }
}

# 2) reel (looped) + circle PNG overlay + VO audio
$fc = "[0:v]setsar=1[bg];[bg][1:v]overlay=${pos}:shortest=0[v]"
& $ffmpeg -y -hide_banner -loglevel error `
  -stream_loop -1 -i $Reel -loop 1 -i $circle -i $Audio `
  -filter_complex $fc -map "[v]" -map "2:a" -t $dur `
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 160k $Out
Remove-Item $circle -ErrorAction SilentlyContinue

Write-Output ("placeholder video -> {0}  (corner={1}, circle={2}px, dur={3:N1}s)" -f $Out, $Corner, $D, $dur)
