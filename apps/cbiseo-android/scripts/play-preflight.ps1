# Play 내부 테스트 업로드 전 점검
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not $env:JAVA_HOME -and (Test-Path $jbr)) {
    $env:JAVA_HOME = $jbr
    Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor DarkGray
}

$checks = @(
    @{ Name = 'local.properties'; Path = 'local.properties' }
    @{ Name = 'google-services.json (FCM)'; Path = 'app\google-services.json'; Optional = $true }
    @{ Name = 'keystore/cbiseo-release.jks'; Path = 'keystore\cbiseo-release.jks' }
    @{ Name = 'keystore.properties'; Path = 'keystore.properties' }
    @{ Name = 'Play 아이콘 512'; Path = (Join-Path (Split-Path $Root -Parent) 'client\public\brand\clean-buddy-app-icon.png'); Absolute = $true }
)

$ok = $true
foreach ($c in $checks) {
    $p = if ($c.Absolute) { $c.Path } else { Join-Path $Root $c.Path }
    $exists = Test-Path $p
    if ($exists) {
        Write-Host "[OK] $($c.Name)" -ForegroundColor Green
    } elseif ($c.Optional) {
        Write-Host "[--] $($c.Name) (선택)" -ForegroundColor Yellow
    } else {
        Write-Host "[!!] $($c.Name) — 없음: $p" -ForegroundColor Red
        $ok = $false
    }
}

Write-Host ''
if (-not $ok) {
    Write-Host '다음 순서 (터미널):' -ForegroundColor Cyan
    Write-Host '  cd apps\cbiseo-android'
    Write-Host '  .\scripts\setup-play-release.ps1'
    exit 1
}

Write-Host '준비 완료 → .\scripts\build-play-bundle.ps1' -ForegroundColor Green
