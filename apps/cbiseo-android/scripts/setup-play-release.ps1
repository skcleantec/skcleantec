# Play internal test AAB - keystore (first run) + bundle + dist copy
# Usage: cd apps\cbiseo-android ; .\scripts\setup-play-release.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$jks = Join-Path $Root 'keystore\cbiseo-release.jks'
$props = Join-Path $Root 'keystore.properties'

if (-not (Test-Path $jks) -or -not (Test-Path $props)) {
    Write-Host '=== 1/2 Play upload keystore (first time, password prompt) ===' -ForegroundColor Cyan
    if (Test-Path $jks) {
        & (Join-Path $PSScriptRoot 'init-keystore-properties.ps1')
    } else {
        & (Join-Path $PSScriptRoot 'create-release-keystore.ps1')
    }
} else {
    Write-Host 'keystore OK - building AAB only' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host '=== 2/2 AAB build ===' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'build-play-bundle.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dist = Join-Path $Root 'dist'
$aab = Get-ChildItem $dist -Filter 'cbiseo-play-*.aab' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($aab) {
    Write-Host ''
    Write-Host "Done: $($aab.FullName)" -ForegroundColor Green
    Write-Host 'Play Console > Testing > Internal testing > Upload App Bundle' -ForegroundColor Cyan
} else {
    Write-Host 'No AAB in dist folder. Check build-play-bundle.ps1 output.' -ForegroundColor Red
    exit 1
}
