# Android Studio Run before clean — Windows build folder locks
# Usage: close Android Studio completely, run this, reopen Studio, Run
param(
    [switch]$ThenOpenStudio
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'build-paths.ps1')
Set-Location (Join-Path $PSScriptRoot '..')

$jbr = "${env:ProgramFiles}\Android\Android Studio\jbr"
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }

Write-Host "Stopping Gradle daemons..." -ForegroundColor Cyan
& .\gradlew.bat --stop 2>&1 | Out-Null
Start-Sleep -Seconds 2

$paths = @(
    (Get-CbiseoAndroidBuildDir),
    (Join-Path $PWD 'app\build'),
    (Join-Path $PWD '.gradle\8.9\executionHistory'),
    (Join-Path $PWD '.gradle\8.9\fileHashes')
)
foreach ($p in $paths) {
    if (-not (Test-Path $p)) { continue }
    try {
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
        Write-Host "Removed: $p" -ForegroundColor Green
    } catch {
        Write-Host "FAILED (close Android Studio / terminals): $p" -ForegroundColor Yellow
        Write-Host $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Build output (Windows): $(Get-CbiseoAndroidBuildDir)" -ForegroundColor DarkGray
Write-Host "Next: Android Studio -> Sync -> phone only -> Run" -ForegroundColor Cyan

if ($ThenOpenStudio) {
    $studio = "${env:ProgramFiles}\Android\Android Studio\bin\studio64.exe"
    if (Test-Path $studio) { Start-Process $studio -ArgumentList $PWD }
}
