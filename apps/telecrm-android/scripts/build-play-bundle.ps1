# Google Play upload AAB build
# Usage: cd apps\telecrm-android ; .\scripts\build-play-bundle.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$keystoreProps = Join-Path $Root 'keystore.properties'
$jks = Join-Path $Root 'keystore\telecrm-release.jks'

if (-not (Test-Path $keystoreProps)) {
    Write-Host 'Missing keystore.properties — run: .\scripts\init-keystore-properties.ps1' -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path $jks)) {
    throw "Missing keystore: $jks"
}

$javaCandidates = @(
    "$env:JAVA_HOME",
    "$env:LOCALAPPDATA\Android\Sdk\jbr",
    "C:\Program Files\Android\Android Studio\jbr"
)
foreach ($c in $javaCandidates) {
    if ($c -and (Test-Path (Join-Path $c 'bin\java.exe'))) {
        $env:JAVA_HOME = $c
        break
    }
}
if (-not $env:JAVA_HOME) {
    throw 'JAVA_HOME not found. Install Android Studio or set JAVA_HOME.'
}

Write-Host 'Building Play AAB (bundlePlayRelease)...' -ForegroundColor Cyan
Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor DarkGray
Write-Host 'Tip: Close Android Studio if clean/build fails (file lock).' -ForegroundColor DarkGray
& .\gradlew.bat bundlePlayRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$src = (Join-Path $PSScriptRoot 'build-paths.ps1')
. $src
$src = Get-TelecrmPlayReleaseAabPath
if (-not (Test-Path $src)) {
    throw "AAB not found: $src"
}

$gradle = Get-Content (Join-Path $Root 'app\build.gradle.kts') -Raw
$versionName = if ($gradle -match 'versionName\s*=\s*"([^"]+)"') { $Matches[1] } else { 'unknown' }
$versionCode = if ($gradle -match 'versionCode\s*=\s*(\d+)') { $Matches[1] } else { '0' }

$dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$out = Join-Path $dist "telecrm-play-$versionName-$versionCode.aab"
Copy-Item $src $out -Force

$hash = (Get-FileHash -Path $out -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  AAB: $out"
Write-Host "  versionName: $versionName  versionCode: $versionCode"
Write-Host "  SHA256: $hash"
Write-Host ''
Write-Host 'Upload: Play Console > Testing > Internal testing > Create new release'
Write-Host 'Guide: docs/GOOGLE_PLAY_TELECRM.md'
