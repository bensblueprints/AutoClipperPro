<#
  Publish step for /bbb: render the business plan to a TITLED PDF, give the reel a
  TITLED name, and upload both to Google Drive (rclone) under a titled folder.
  Files are named "<Business> - Business Plan.pdf" / "<Business> - Breakdown.mp4"
  so they're easy to find locally and in Drive.
  Usage: publish.ps1 -Folder <projectFolder> -Slug <slug> -Title <Business>
                     [-Remote gdrive] [-DriveBase BBB]
#>
param(
  [Parameter(Mandatory)][string]$Folder,
  [Parameter(Mandatory)][string]$Slug,
  [Parameter(Mandatory)][string]$Title,
  [string]$Remote = "gdrive",
  [string]$DriveBase = "BBB"
)
# Native tools (chrome/rclone) write progress to stderr — don't treat that as fatal.
$ErrorActionPreference = 'Continue'
$rclone = if ($env:RCLONE_PATH) { $env:RCLONE_PATH } else { 'rclone' }
$skill  = Split-Path $MyInvocation.MyCommand.Path

# filename-safe title
$safe = ($Title -replace '[<>:"/\\|?*]', '').Trim()
$plan = Join-Path $Folder 'business-plan.md'
$pdf  = Join-Path $Folder "$safe - Business Plan.pdf"
$reel = Join-Path $Folder 'final.mp4'
$vid  = Join-Path $Folder "$safe - Breakdown.mp4"

# 1) titled PDF (always)
node (Join-Path $skill 'makepdf.mjs') $plan $pdf $Title 2>$null | Out-Null
if (-not (Test-Path $pdf)) { Write-Error "PDF not generated"; exit 1 }

# 2) give the finished reel a titled name
if (Test-Path $reel) { Move-Item $reel $vid -Force }

# 3) upload both to a titled Drive folder
$dest = "${Remote}:${DriveBase}/${safe}"
& $rclone copy $pdf $dest --progress
if (Test-Path $vid) { & $rclone copy $vid $dest --progress }

Write-Output "PDF:   $pdf"
Write-Output "VIDEO: $vid"
Write-Output "DRIVE: ${DriveBase}/${safe}/"
& $rclone link $dest 2>$null
