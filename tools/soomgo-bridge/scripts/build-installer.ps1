# 청소비서 숨고 연동 — Inno Setup 설치 파일(.exe) 빌드
param(
    [string]$Version = '2.0.0'
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$IssPath = Join-Path $BridgeRoot 'installer\soomgo-bridge.iss'
$DistDir = Join-Path $BridgeRoot 'dist'
$SetupName = "SoomgoBridge-Setup-$Version.exe"
$SetupPath = Join-Path $DistDir $SetupName

$IsccCandidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
)
$Iscc = $IsccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Iscc) {
    throw @"
Inno Setup 6이 설치되어 있지 않습니다.
- 다운로드: https://jrsoftware.org/isdl.php
- 설치 후 다시 실행: .\scripts\build-installer.ps1 -Version $Version
"@
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
if (Test-Path $SetupPath) { Remove-Item -Force $SetupPath }

Push-Location $BridgeRoot
try {
    & $Iscc "/DMyAppVersion=$Version" $IssPath
} finally {
    Pop-Location
}

if (-not (Test-Path $SetupPath)) {
    throw "Setup build failed: $SetupPath not found"
}

$hash = (Get-FileHash -Path $SetupPath -Algorithm SHA256).Hash.ToLower()
$sizeMb = [math]::Round((Get-Item $SetupPath).Length / 1MB, 2)

Write-Host "Built: $SetupPath ($sizeMb MB)"
Write-Host "SHA256: $hash"
Write-Output $hash
