<#
  Build the "viral breakdown" video:
    reel (looped, muted) + blur/black BAR over original captions + OUR captions
    + a CIRCULAR avatar bubble (gold ring) placed clear of the captions + VO audio.
  Usage:
    composite.ps1 -Reel <reel> -Avatar <avatar.mp4> -Audio <vo.mp3> -Out <final.mp4>
                  [-Captions <captions.ass>] [-Corner bottom-right|bottom-left]
                  [-AvatarFrac 0.40] [-AvatarY <px>] [-Margin 24]
                  [-BandTop 1240] [-BandH 340] [-BarStyle blur|black|none]
#>
param(
  [Parameter(Mandatory)][string]$Reel,
  [Parameter(Mandatory)][string]$Avatar,
  [Parameter(Mandatory)][string]$Audio,
  [Parameter(Mandatory)][string]$Out,
  [string]$Captions = "",
  [ValidateSet('bottom-right','bottom-left')][string]$Corner = 'bottom-right',
  [double]$AvatarFrac = 0.40,
  [int]$AvatarY = 0,
  [int]$Margin = 24,
  [int]$BandTop = 1240,
  [int]$BandH = 340,
  [ValidateSet('blur','black','none')][string]$BarStyle = 'blur'
)
$ErrorActionPreference = 'Continue'
$ffmpeg  = if ($env:FFMPEG_PATH)  { $env:FFMPEG_PATH }  else { 'ffmpeg' }
$ffprobe = if ($env:FFPROBE_PATH) { $env:FFPROBE_PATH } else { 'ffprobe' }

$W = [int]((& $ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 $Reel) -replace '\D','')
$H = [int]((& $ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 $Reel) -replace '\D','')
if (-not $W) { $W = 1080 }; if (-not $H) { $H = 1920 }
$dur = [double]((& $ffprobe -v error -show_entries format=duration -of csv=p=0 $Audio) -replace '[^0-9.]','')

# circle diameter; sit it just below the caption text and clamp to the frame
$D = [int]([math]::Round($W * $AvatarFrac)); if ($D % 2) { $D++ }
if ($AvatarY -le 0) { $AvatarY = $BandTop + 240 }
if ($AvatarY + $D + $Margin -gt $H) { $AvatarY = $H - $D - $Margin }
$PX = if ($Corner -eq 'bottom-left') { $Margin } else { $W - $D - $Margin }

$work = Split-Path $Out
$mask = Join-Path $work '_mask.png'
$ring = Join-Path $work '_ring.png'
$c = $D / 2.0
# white-disc mask (for alphamerge) and gold ring (border)
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=black:s=${D}x${D}" -vf "format=gray,geq=lum='if(lte(hypot(X-$c\,Y-$c)\,$($c-2))\,255\,0)'" -frames:v 1 $mask
& $ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=black:s=${D}x${D}" -vf "format=rgba,geq=r=212:g=175:b=55:a='if(between(hypot(X-$c\,Y-$c)\,$($c-9)\,$c)\,255\,0)'" -frames:v 1 $ring

# caption bar over original captions
$bar = switch ($BarStyle) {
  'blur'  { "[0:v]setsar=1,split=2[base][bc];[bc]crop=${W}:${BandH}:0:${BandTop},boxblur=18:1,eq=brightness=-0.18:saturation=0.6[band];[base][band]overlay=0:${BandTop}[bg];" }
  'black' { "[0:v]setsar=1,drawbox=x=0:y=${BandTop}:w=${W}:h=${BandH}:color=black@0.8:t=fill[bg];" }
  'none'  { "[0:v]setsar=1[bg];" }
}

# circular avatar bubble: center-square crop -> scale -> disc alpha -> gold ring
$pip = "[1:v]crop=720:720:280:0,scale=${D}:${D},setsar=1,format=rgba[avs];[avs][2:v]alphamerge[avc];[avc][3:v]overlay=0:0[pip];[bg][pip]overlay=${PX}:${AvatarY}[wp]"

$popd = $false
if ($Captions -and (Test-Path $Captions)) {
  $capDir = Split-Path $Captions; $capLeaf = Split-Path $Captions -Leaf
  Push-Location $capDir; $popd = $true
  $fc = "$bar$pip;[wp]subtitles=${capLeaf}[v]"
} else { $fc = "$bar$pip;[wp]null[v]" }

& $ffmpeg -y -hide_banner -loglevel error `
  -stream_loop -1 -i $Reel -i $Avatar -loop 1 -i $mask -loop 1 -i $ring -i $Audio `
  -filter_complex $fc -map "[v]" -map "4:a" -t $dur `
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 160k $Out
if ($popd) { Pop-Location }
Remove-Item $mask, $ring -ErrorAction SilentlyContinue

Write-Output ("composited -> {0}  (circle D={1}px at {2},{3}, corner={4}, dur={5:N1}s)" -f $Out, $D, $PX, $AvatarY, $Corner, $dur)
