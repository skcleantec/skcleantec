# Google Play upload AAB build — 청소비서 업무 앱 (com.cbiseo.app)
# 사전: app/google-services.json (FIREBASE_SETUP.md) · keystore.properties (Play 서명)
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot + '\..'

if (-not (Test-Path 'local.properties')) {
    Write-Host 'Tip: copy local.properties.example -> local.properties (sdk.dir)' -ForegroundColor Yellow
}

if (-not $SkipBuild) {
    & .\gradlew.bat bundlePlayRelease
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$gradleFile = Join-Path $PSScriptRoot '..\app\build.gradle.kts'
$content = Get-Content $gradleFile -Raw
if ($content -match 'versionName\s*=\s*"([^"]+)"') { $versionName = $Matches[1] } else { $versionName = 'unknown' }
if ($content -match 'versionCode\s*=\s*(\d+)') { $versionCode = $Matches[1] } else { $versionCode = '0' }

$dist = Join-Path $PSScriptRoot '..\dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$src = Join-Path $PSScriptRoot "..\app\build\outputs\bundle\playRelease\app-play-release.aab"
$dest = Join-Path $dist "cbiseo-play-$versionName-$versionCode.aab"
if (Test-Path $src) {
    Copy-Item -Force $src $dest
    Write-Host "AAB: $dest"
} else {
    Write-Warning "AAB not found at $src"
}

Write-Host 'Upload: Play Console > Testing > Internal testing > Create new release'
Write-Host 'Package: com.cbiseo.app · Display name: 청소비서'
