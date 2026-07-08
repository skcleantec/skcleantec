# SK클린텍 숨고 브릿지 — 릴리스 빌드 (Setup.exe 권장 + ZIP 보조)
param(
    [string]$Version = '2.0.0',
    [switch]$SkipSetup
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$DistDir = Join-Path $BridgeRoot 'dist'
$ZipName = "SoomgoBridge-$Version.zip"
$ZipPath = Join-Path $DistDir $ZipName
$SetupName = "SoomgoBridge-Setup-$Version.exe"
$SetupPath = Join-Path $DistDir $SetupName
$EnvSnippetPath = Join-Path $DistDir "railway-env-$Version.txt"

# --- ZIP (자동 업데이트 ZIP 폴백·개발용) ---
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

Write-Host "ZIP: $ZipPath"

# --- Setup.exe (상담사 PC 기본) ---
$setupBuilt = $false
if (-not $SkipSetup) {
    try {
        & (Join-Path $PSScriptRoot 'build-installer.ps1') -Version $Version | Out-Null
        $setupBuilt = Test-Path $SetupPath
    } catch {
        Write-Warning $_.Exception.Message
    }
}

if ($setupBuilt) {
    $primaryName = $SetupName
    $primaryPath = $SetupPath
} else {
    $primaryName = $ZipName
    $primaryPath = $ZipPath
    Write-Warning "Setup.exe not built — Railway downloadUrl will point to ZIP."
}

$primaryHash = (Get-FileHash -Path $primaryPath -Algorithm SHA256).Hash.ToLower()

$snippet = @"
# Railway Variables (staging or production web service)
# Primary artifact: $primaryName (Setup.exe recommended for agents)

SOOMGO_BRIDGE_REQUIRED_VERSION=2
SOOMGO_BRIDGE_LATEST_VERSION=$Version
SOOMGO_BRIDGE_DOWNLOAD_URL=https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$primaryName
SOOMGO_BRIDGE_RELEASE_NOTES=Soomgo Bridge desktop v$Version
SOOMGO_BRIDGE_SHA256=$primaryHash

# Optional ZIP fallback URL (dev / manual update):
# https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$ZipName
"@

$Utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($EnvSnippetPath, $snippet, $Utf8Bom)

Write-Host "Primary: $primaryPath"
Write-Host "SHA256: $primaryHash"
Write-Host "Railway snippet: $EnvSnippetPath"
