# SK클린텍 숨고 브릿지 — 배포 ZIP 패키지 (스테이징·GitHub Releases용)
param(
    [string]$Version = '2.0.0'
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$DistDir = Join-Path $BridgeRoot 'dist'
$ZipName = "SoomgoBridge-$Version.zip"
$ZipPath = Join-Path $DistDir $ZipName
$EnvSnippetPath = Join-Path $DistDir "railway-env-$Version.txt"

$ExcludeDirs = @('__pycache__', 'dist', 'installer', '.git')
$ExcludeFiles = @('*.pyc', '*.pyo')

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }

$Staging = Join-Path $env:TEMP "soomgo-bridge-pack-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

function Should-SkipPath([string]$RelativePath) {
    $parts = $RelativePath -split '[\\/]'
    foreach ($part in $parts) {
        if ($ExcludeDirs -contains $part) { return $true }
    }
    foreach ($pattern in $ExcludeFiles) {
        if ($RelativePath -like $pattern) { return $true }
    }
    return $false
}

Get-ChildItem -Path $BridgeRoot -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($BridgeRoot.Path.Length + 1)
    if (Should-SkipPath $rel) { return }
    $dest = Join-Path $Staging $rel
    $destParent = Split-Path -Parent $dest
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Force -Path $destParent | Out-Null
    }
    Copy-Item -Path $_.FullName -Destination $dest -Force
}

Compress-Archive -Path (Join-Path $Staging '*') -DestinationPath $ZipPath -Force
Remove-Item -Recurse -Force $Staging

$hash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLower()
$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)

$snippet = @"
# Railway Variables (staging or production web service)
# Upload ZIP to GitHub Releases, then set downloadUrl.

SOOMGO_BRIDGE_REQUIRED_VERSION=2
SOOMGO_BRIDGE_LATEST_VERSION=$Version
SOOMGO_BRIDGE_DOWNLOAD_URL=https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$ZipName
SOOMGO_BRIDGE_RELEASE_NOTES=Soomgo Bridge desktop v$Version
SOOMGO_BRIDGE_SHA256=$hash

# Agent PC config.json manifestUrl (replace with your staging URL):
# https://YOUR-STAGING.up.railway.app/api/public/soomgo-bridge/manifest
"@

$Utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($EnvSnippetPath, $snippet, $Utf8Bom)

Write-Host "Built: $ZipPath ($sizeMb MB)"
Write-Host "SHA256: $hash"
Write-Host "Railway snippet: $EnvSnippetPath"
