$ErrorActionPreference = 'Stop'
$SourceDir = $PSScriptRoot
$ProjectRoot = Split-Path $SourceDir -Parent
$DistDir = Join-Path $SourceDir 'dist\SoomgoAutomation'
$BuildConfig = Join-Path $SourceDir 'build_bundle_config.json'
Copy-Item (Join-Path $SourceDir 'config.json.example') $BuildConfig -Force

Set-Location $SourceDir
Write-Host 'PyInstaller 빌드 시작...'

if (Test-Path (Join-Path $SourceDir 'build')) {
    Remove-Item (Join-Path $SourceDir 'build') -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path (Join-Path $SourceDir 'dist')) {
    Remove-Item (Join-Path $SourceDir 'dist') -Recurse -Force -ErrorAction SilentlyContinue
}

python -m PyInstaller --noconfirm --clean SoomgoAutomation.spec

if (-not (Test-Path (Join-Path $DistDir 'SoomgoAutomation.exe'))) {
    throw '빌드 실패: SoomgoAutomation.exe 를 찾을 수 없습니다.'
}

$InternalDist = Join-Path $DistDir '_internal'
$InternalTarget = Join-Path $ProjectRoot '_internal'
$ExeTarget = Join-Path $ProjectRoot 'SoomgoAutomation.exe'
$OldConfig = Join-Path $InternalTarget 'config.json'
$SavedConfig = Join-Path $env:TEMP 'soomgo_saved_config.json'

if (Test-Path $OldConfig) {
    Copy-Item $OldConfig $SavedConfig -Force
    Write-Host '기존 config.json 백업 완료'
}

$OldExe = Join-Path $ProjectRoot 'SoomgoAutomation.exe.old'
if (Test-Path $ExeTarget) {
    Copy-Item $ExeTarget $OldExe -Force
    Write-Host '기존 EXE -> SoomgoAutomation.exe.old 백업'
}

Copy-Item (Join-Path $DistDir 'SoomgoAutomation.exe') $ExeTarget -Force
Copy-Item (Join-Path $SourceDir 'scripts\apply_zip_update.ps1') (Join-Path $ProjectRoot 'apply_zip_update.ps1') -Force

if (-not (Test-Path $InternalTarget)) {
    New-Item -ItemType Directory -Path $InternalTarget | Out-Null
}
Copy-Item (Join-Path $InternalDist '*') $InternalTarget -Recurse -Force

$BundledConfig = Join-Path $InternalTarget 'build_bundle_config.json'
$TargetConfig = Join-Path $InternalTarget 'config.json'
if (Test-Path $SavedConfig) {
    Copy-Item $SavedConfig $TargetConfig -Force
    Write-Host '기존 config.json 복원'
} elseif (-not (Test-Path $TargetConfig)) {
    if (Test-Path $BundledConfig) {
        Move-Item $BundledConfig $TargetConfig -Force
    }
} elseif (Test-Path $BundledConfig) {
    Remove-Item $BundledConfig -Force
}

Write-Host ''
Write-Host '빌드 완료!'
Write-Host "EXE: $ExeTarget"
Write-Host "실행: $ExeTarget"

Remove-Item $BuildConfig -Force -ErrorAction SilentlyContinue
