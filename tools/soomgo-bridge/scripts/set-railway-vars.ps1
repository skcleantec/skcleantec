# 청소비서 숨고 연동 — Railway Variables 일괄 설정
# 사전: npx @railway/cli login (또는 RAILWAY_TOKEN 환경변수)
# 사용: .\set-railway-vars.ps1 -Target production
#       .\set-railway-vars.ps1 -Target staging
#       .\set-railway-vars.ps1 -Target both

param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [string]$Version = '2.1.1',
    [string]$Sha256 = ''
)

$ErrorActionPreference = 'Stop'

$SetupExe = "SoomgoBridge-Setup-$Version.exe"
$DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$SetupExe"
$ManifestProduction = 'https://www.cbiseo.com/api/public/soomgo-bridge/manifest'
$ManifestStaging = 'https://clean-solution-staging.up.railway.app/api/public/soomgo-bridge/manifest'

$Vars = @{
    SOOMGO_BRIDGE_REQUIRED_VERSION     = '2'
    SOOMGO_BRIDGE_LATEST_VERSION       = $Version
    SOOMGO_BRIDGE_DOWNLOAD_URL         = $DownloadUrl
    SOOMGO_BRIDGE_SHA256               = $Sha256
    SOOMGO_BRIDGE_RELEASE_NOTES        = "숨고 연동 Setup v$Version (cbiseo.com)"
}

function Test-RailwayAuth {
    $out = npx @railway/cli@latest whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw @"
Railway에 로그인되어 있지 않습니다.
  npx @railway/cli login
또는 RAILWAY_TOKEN 환경변수를 설정한 뒤 다시 실행하세요.
"@
    }
    Write-Host "Railway: $out"
}

function Set-RailwayEnvVars([string]$Environment) {
    Write-Host "`n=== Railway environment: $Environment ===" -ForegroundColor Cyan
    foreach ($key in $Vars.Keys) {
        $val = $Vars[$key]
        Write-Host "  $key"
        npx @railway/cli@latest variables --set "${key}=${val}" --environment $Environment
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to set $key on $Environment"
        }
    }
}

function Show-ManifestHint([string]$Environment) {
    $url = if ($Environment -eq 'production') { $ManifestProduction } else { $ManifestStaging }
    Write-Host "Manifest check: $url"
}

Test-RailwayAuth

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host 'Using npx @railway/cli'
}

$linked = Test-Path (Join-Path $env:USERPROFILE '.railway\config.json')
if (-not $linked) {
    Write-Host @"

프로젝트 연결이 필요합니다. 저장소 루트에서:
  npx @railway/cli link
(Cbiseo Railway 프로젝트 · cbiseo.com 웹 서비스가 있는 프로젝트)

"@ -ForegroundColor Yellow
    npx @railway/cli link
}

$targets = @()
if ($Target -eq 'both') { $targets = @('staging', 'production') } else { $targets = @($Target) }

foreach ($envName in $targets) {
    Set-RailwayEnvVars $envName
    Show-ManifestHint $envName
}

Write-Host "`n완료. 상담사 PC Setup 설치 시 매니페스트 URL:" -ForegroundColor Green
Write-Host "  $ManifestProduction"
Write-Host "`n스테이징 검증용:" -ForegroundColor Green
Write-Host "  $ManifestStaging"
