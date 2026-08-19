#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$SourceDir = Split-Path $ScriptDir -Parent
$ProjectRoot = Split-Path $SourceDir -Parent
$DistRoot = Join-Path $ProjectRoot "dist-release"
$ZipName = "SoomgoAutomation-$Version.zip"
$ZipPath = Join-Path $DistRoot $ZipName

function Get-FileSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

# version_info.py 동기화
$VersionFile = Join-Path $SourceDir 'version_info.py'
$content = Get-Content $VersionFile -Raw -Encoding UTF8
if ($content -match "APP_VERSION\s*=\s*'[^']+'") {
    $content = [regex]::Replace($content, "APP_VERSION\s*=\s*'[^']+'", "APP_VERSION = '$Version'")
    Set-Content -Path $VersionFile -Value $content -Encoding UTF8 -NoNewline
}

$RepoRoot = (Resolve-Path (Join-Path $SourceDir '..\..')).Path
$SharedTs = Join-Path $RepoRoot 'shared\soomgoAutomation.ts'
if (Test-Path $SharedTs) {
    $shared = Get-Content $SharedTs -Raw -Encoding UTF8
    $shared = [regex]::Replace($shared, "SOOMGO_AUTOMATION_APP_VERSION = '[^']+'", "SOOMGO_AUTOMATION_APP_VERSION = '$Version'")
    Set-Content -Path $SharedTs -Value $shared -Encoding UTF8 -NoNewline
}

$ServerManifest = Join-Path $RepoRoot 'server\src\modules\telecrm\soomgoAutomationManifest.ts'
if (Test-Path $ServerManifest) {
    $server = Get-Content $ServerManifest -Raw -Encoding UTF8
    $server = [regex]::Replace($server, "SOOMGO_AUTOMATION_APP_VERSION = '[^']+'", "SOOMGO_AUTOMATION_APP_VERSION = '$Version'")
    Set-Content -Path $ServerManifest -Value $server -Encoding UTF8 -NoNewline
}

Write-Host "Building SoomgoAutomation v$Version ..."
& (Join-Path $SourceDir 'build_exe.ps1')

$ExePath = Join-Path $ProjectRoot 'SoomgoAutomation.exe'
$InternalPath = Join-Path $ProjectRoot '_internal'
$HelperPath = Join-Path $ProjectRoot 'apply_zip_update.ps1'
$HelperSource = Join-Path $SourceDir 'scripts\apply_zip_update.ps1'

if (-not (Test-Path $ExePath)) { throw "EXE not found: $ExePath" }
if (-not (Test-Path $InternalPath)) { throw "_internal not found: $InternalPath" }
Copy-Item $HelperSource $HelperPath -Force

if (Test-Path $DistRoot) { Remove-Item $DistRoot -Recurse -Force }
New-Item -ItemType Directory -Path $DistRoot | Out-Null

$Stage = Join-Path $DistRoot 'stage'
New-Item -ItemType Directory -Path $Stage | Out-Null
Copy-Item $ExePath (Join-Path $Stage 'SoomgoAutomation.exe') -Force
Copy-Item $InternalPath (Join-Path $Stage '_internal') -Recurse -Force
Copy-Item $HelperPath (Join-Path $Stage 'apply_zip_update.ps1') -Force

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ZipPath -Force
$sha = Get-FileSha256 $ZipPath

$RailwayEnv = @"
SOOMGO_AUTOMATION_LATEST_VERSION=$Version
SOOMGO_AUTOMATION_DOWNLOAD_URL=https://github.com/skcleantec/skcleantec/releases/download/soomgo-automation-v$Version/$ZipName
SOOMGO_AUTOMATION_SHA256=$sha
SOOMGO_AUTOMATION_RELEASE_NOTES=이모지/견적조회 마지막 텍스트 미전송 수정 — 긴 본문 전송 확인·이미지 전송 버튼 (v$Version)
"@

$RailwayPath = Join-Path $DistRoot "railway-env-$Version.txt"
Set-Content -Path $RailwayPath -Value $RailwayEnv -Encoding UTF8

Write-Host ''
Write-Host "Release ZIP: $ZipPath"
Write-Host "SHA256: $sha"
Write-Host "Railway env: $RailwayPath"
