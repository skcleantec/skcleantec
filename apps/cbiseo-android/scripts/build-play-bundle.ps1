# Google Play upload AAB build — 청소비서 업무 앱 (com.cbiseo.app)
# 사전: app/google-services.json (FIREBASE_SETUP.md) · keystore.properties (Play 서명)
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not $env:JAVA_HOME -and (Test-Path $jbr)) {
    $env:JAVA_HOME = $jbr
}

if (-not (Test-Path 'local.properties')) {
    Write-Host 'Tip: copy local.properties.example -> local.properties (sdk.dir)' -ForegroundColor Yellow
}

$keystoreProps = Join-Path $Root 'keystore.properties'
$keystoreJks = Join-Path $Root 'keystore\cbiseo-release.jks'
if (-not (Test-Path $keystoreJks) -or -not (Test-Path $keystoreProps)) {
    Write-Host 'Missing keystore - run setup first:' -ForegroundColor Red
    Write-Host '  .\scripts\setup-play-release.ps1' -ForegroundColor Yellow
    Write-Host 'Or run separately:' -ForegroundColor DarkGray
    Write-Host '  .\scripts\create-release-keystore.ps1' -ForegroundColor Yellow
    Write-Host '  .\scripts\build-play-bundle.ps1' -ForegroundColor Yellow
    exit 1
}

if (-not $SkipBuild) {
    & .\gradlew.bat bundlePlayRelease
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$gradleFile = Join-Path $Root 'app\build.gradle.kts'
$content = Get-Content $gradleFile -Raw
if ($content -match 'versionName\s*=\s*"([^"]+)"') { $versionName = $Matches[1] } else { $versionName = 'unknown' }
if ($content -match 'versionCode\s*=\s*(\d+)') { $versionCode = $Matches[1] } else { $versionCode = '0' }

$dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
. (Join-Path $PSScriptRoot 'build-paths.ps1')
$src = Get-CbiseoPlayReleaseAabPath
$dest = Join-Path $dist "cbiseo-play-$versionName-$versionCode.aab"
if (Test-Path $src) {
    Copy-Item -Force $src $dest
    Write-Host "AAB: $dest"
} else {
    Write-Warning "AAB not found at $src"
    exit 1
}

$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path $keytool)) {
    $keytool = 'keytool'
}
$expectedSha1 = '0B:9B:50:76:45:E4:40:71:88:92:44:43:4A:B8:97:FB:C8:7C:64:93'
$aabSha1Line = & $keytool -printcert -jarfile $dest 2>&1 | Select-String 'SHA1:'
if ($aabSha1Line) {
    $aabSha1 = ($aabSha1Line -replace '\s*SHA1:\s*', '').Trim().ToUpperInvariant()
    Write-Host "Upload key SHA1: $aabSha1" -ForegroundColor Cyan
    if ($aabSha1 -ne $expectedSha1) {
        Write-Host 'ERROR: AAB signing key mismatch — Play expects cbiseo-release.jks (not telecrm-release.jks).' -ForegroundColor Red
        exit 1
    }
    Write-Host 'Signing key OK (com.cbiseo.app upload key)' -ForegroundColor Green
}

Write-Host 'Upload: Play Console > Testing > Internal testing > Create new release'
Write-Host 'Package: com.cbiseo.app | Display name: CBISEO staff app'
Write-Host 'Play icon: client\public\brand\clean-buddy-app-icon.png (512x512)' -ForegroundColor DarkGray
