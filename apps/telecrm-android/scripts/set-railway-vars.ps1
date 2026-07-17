# 청소비서 전화(텔레CRM) Android — Railway Variables 일괄 설정
# 사전: npx @railway/cli login (또는 RAILWAY_TOKEN)
# 사용: .\scripts\set-railway-vars.ps1 -Target both -VersionCode 17 -VersionName "0.6.7-internal" -Sha256 "abc..."
#
# 변수 의미 (한 세트로 맞춤):
#   LATEST_VERSION_CODE/NAME + DOWNLOAD_URL + SHA256 + RELEASE_NOTES → 최신 APK
#   MIN_VERSION_CODE → 이 미만이면 필수 업데이트 (보통 LATEST와 동일 = 전원 강제)

param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [Parameter(Mandatory = $true)]
    [int]$VersionCode,
    [Parameter(Mandatory = $true)]
    [string]$VersionName,
    [int]$MinVersionCode = 0,
    [string]$DownloadUrl = '',
    [string]$Sha256 = '',
    [string]$ReleaseNotes = '',
    [string]$ServiceId = '171eccc8-17fa-49d0-b81b-c42df7b2138a'
)

$ErrorActionPreference = 'Stop'

if ($MinVersionCode -le 0) {
    $MinVersionCode = $VersionCode
}

if (-not $DownloadUrl) {
    $tag = "telecrm-v$VersionName"
    $ApkName = "telecrm-release-$VersionName.apk"
    $DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/$tag/$ApkName"
}

if (-not $ReleaseNotes) {
    $ReleaseNotes = "청소비서 전화 v$VersionName (versionCode $VersionCode)"
}

$ManifestProduction = 'https://www.cbiseo.com/api/public/telecrm-app/manifest'
$ManifestStaging = 'https://clean-solution-staging.up.railway.app/api/public/telecrm-app/manifest'

$Vars = @{
    TELECRM_APP_LATEST_VERSION_CODE = "$VersionCode"
    TELECRM_APP_LATEST_VERSION_NAME = $VersionName
    TELECRM_APP_MIN_VERSION_CODE    = "$MinVersionCode"
    TELECRM_APP_DOWNLOAD_URL        = $DownloadUrl
    TELECRM_APP_SHA256              = $Sha256
    TELECRM_APP_RELEASE_NOTES       = $ReleaseNotes
}

function Test-RailwayAuth {
    $out = npx @railway/cli@latest whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw @"
Railway에 로그인되어 있지 않습니다.
  npx @railway/cli login
"@
    }
    Write-Host "Railway: $out"
}

function Set-RailwayEnvVars([string]$Environment) {
    Write-Host "`n=== Railway environment: $Environment ===" -ForegroundColor Cyan
    foreach ($key in $Vars.Keys) {
        $val = $Vars[$key]
        Write-Host "  $key"
        npx @railway/cli@latest variable set "${key}=${val}" --environment $Environment --service $ServiceId
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

$targets = @()
if ($Target -eq 'both') { $targets = @('staging', 'production') } else { $targets = @($Target) }

foreach ($envName in $targets) {
    Set-RailwayEnvVars $envName
    Show-ManifestHint $envName
}

Write-Host "`nDone. GitHub Release APK URL·SHA256을 맞춘 뒤 상담사 폰에서 로그인 화면 업데이트를 확인하세요." -ForegroundColor Green
