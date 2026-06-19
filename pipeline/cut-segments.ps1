<#
  Remove time segments (e.g. detected ads) from a video and concat the rest.
  Video-only output (the reel audio is muted in the composite anyway).
  Usage: cut-segments.ps1 -Reel <in> -Out <clean.mp4> -Segments "28.6-30.15,59-60.5"
#>
param(
  [Parameter(Mandatory)][string]$Reel,
  [Parameter(Mandatory)][string]$Out,
  [Parameter(Mandatory)][string]$Segments
)
$ErrorActionPreference = 'Continue'
$ffmpeg = if ($env:FFMPEG_PATH) { $env:FFMPEG_PATH } else { 'ffmpeg' }

$between = ($Segments -split ',' | ForEach-Object {
  $p = $_ -split '-'; "between(t,$($p[0].Trim()),$($p[1].Trim()))"
}) -join '+'

$vf = "select='not($between)',setpts=N/FRAME_RATE/TB"
& $ffmpeg -y -hide_banner -loglevel error -i $Reel -vf $vf -an -c:v libx264 -preset veryfast -pix_fmt yuv420p $Out
Write-Output "cut [$Segments] -> $Out"
