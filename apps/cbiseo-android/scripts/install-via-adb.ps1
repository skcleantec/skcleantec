# USB 실기기 sideload — Android Studio Run 대신 APK 직접 설치
# 사용: .\install-via-adb.ps1
#       .\install-via-adb.ps1 -BuildFirst

param(
    [switch]$BuildFirst,
    [string]$ApkPath = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'build-paths.ps1')
Set-Location (Join-Path $PSScriptRoot '..')

if (-not $ApkPath) { $ApkPath = Get-CbiseoPlayDebugApkPath }

if ($BuildFirst) {
    $jbr = "${env:ProgramFiles}\Android\Android Studio\jbr"
    if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
    Write-Host "Building playDebug APK..." -ForegroundColor Cyan
    & .\gradlew.bat --stop | Out-Null
    & .\gradlew.bat assemblePlayDebug
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $ApkPath = Get-CbiseoPlayDebugApkPath
}

if (-not (Test-Path -LiteralPath $ApkPath)) {
    throw "APK not found: $ApkPath — close Android Studio, then .\install-via-adb.ps1 -BuildFirst"
}

$resolved = Resolve-Path -LiteralPath $ApkPath
Write-Host "APK: $resolved" -ForegroundColor Cyan
Write-Host "Allow USB debugging on the phone when prompted.`n"

adb devices
if ($LASTEXITCODE -ne 0) {
    throw "adb not found. Add Android SDK platform-tools to PATH."
}

adb install -r $resolved.Path
if ($LASTEXITCODE -ne 0) {
    throw "adb install failed — check USB debugging, cable, driver, or signing conflict."
}

Write-Host "`nDone. Open app -> pyo account: select Staging -> allow notifications." -ForegroundColor Green
