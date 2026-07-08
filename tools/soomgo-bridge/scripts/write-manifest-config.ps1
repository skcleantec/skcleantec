# 상담사 PC — 매니페스트 URL을 config.json에 기록
param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestUrl
)

$ErrorActionPreference = 'Stop'
$AppData = Join-Path $env:LOCALAPPDATA 'SKCleantec\SoomgoBridge'
$ConfigPath = Join-Path $AppData 'config.json'

if (-not (Test-Path $AppData)) {
    New-Item -ItemType Directory -Force -Path $AppData | Out-Null
}

$payload = @{ manifestUrl = $ManifestUrl.Trim() } | ConvertTo-Json -Depth 3
Set-Content -Path $ConfigPath -Value $payload -Encoding UTF8
Write-Host "Wrote $ConfigPath"
Write-Host $payload
