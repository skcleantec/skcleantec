# 청소비서 숨고 연동 — Railway Variables 일괄 설정
# 사전 (한 번만): npx @railway/cli login  또는 server/.env 에 RAILWAY_TOKEN=
# 사용:
#   .\set-railway-vars.ps1 -Target both
#   .\set-railway-vars.ps1 -Target staging -Version 2.2.21
#   .\set-railway-vars.ps1 -Target production -Version 2.2.21 -Sha256 abc...

param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [string]$Version = '',
    [string]$Sha256 = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BridgeRoot = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent (Split-Path -Parent $BridgeRoot)
$ServerEnv = Join-Path $RepoRoot 'server\.env'

$ManifestProduction = 'https://www.cbiseo.com/api/public/soomgo-bridge/manifest'
$ManifestStaging = 'https://clean-solution-staging.up.railway.app/api/public/soomgo-bridge/manifest'

function Import-RailwayTokenFromEnvFile {
    if ($env:RAILWAY_TOKEN) { return }
    if (-not (Test-Path $ServerEnv)) { return }
    foreach ($line in Get-Content $ServerEnv -Encoding UTF8) {
        $trim = $line.Trim()
        if (-not $trim -or $trim.StartsWith('#')) { continue }
        if ($trim -match '^\s*RAILWAY_TOKEN\s*=\s*"?([^"#]+)"?\s*$') {
            $env:RAILWAY_TOKEN = $Matches[1].Trim()
            Write-Host 'Loaded RAILWAY_TOKEN from server/.env'
            return
        }
    }
}

function Get-DefaultBridgeVersion {
    $versionFile = Join-Path $BridgeRoot 'version_info.py'
    if (-not (Test-Path $versionFile)) { return '2.2.0' }
    $content = Get-Content $versionFile -Raw -Encoding UTF8
    if ($content -match "APP_VERSION\s*=\s*'([^']+)'") {
        return $Matches[1]
    }
    return '2.2.0'
}

function Get-SetupSha256FromGitHub([string]$ver) {
    $tag = "soomgo-bridge-v$ver"
    $api = "https://api.github.com/repos/skcleantec/skcleantec/releases/tags/$tag"
    Write-Host "Fetching release $tag ..."
    $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'skcleanteck-soomgo-bridge' }
    $setup = $release.assets | Where-Object { $_.name -eq "SoomgoBridge-Setup-$ver.exe" } | Select-Object -First 1
    if (-not $setup) {
        throw "Release $tag 에 SoomgoBridge-Setup-$ver.exe 가 없습니다. Actions 빌드 완료 후 다시 실행하세요."
    }
    $digest = [string]$setup.digest
    if ($digest -match 'sha256:([a-f0-9]+)') {
        return $Matches[1]
    }
    throw "Setup.exe sha256 digest 를 GitHub Release에서 찾지 못했습니다."
}

Import-RailwayTokenFromEnvFile

if (-not $Version) {
    $Version = Get-DefaultBridgeVersion
}
if (-not $Sha256) {
    $Sha256 = Get-SetupSha256FromGitHub $Version
}

$SetupExe = "SoomgoBridge-Setup-$Version.exe"
$DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$SetupExe"

$Vars = @{
    SOOMGO_BRIDGE_REQUIRED_VERSION = '2'
    SOOMGO_BRIDGE_LATEST_VERSION   = $Version
    SOOMGO_BRIDGE_DOWNLOAD_URL     = $DownloadUrl
    SOOMGO_BRIDGE_SHA256           = $Sha256
    SOOMGO_BRIDGE_RELEASE_NOTES    = "숨고 연동 Setup v$Version (cbiseo.com)"
}

function Test-RailwayAuth {
    $out = npx @railway/cli@latest whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw @"
Railway에 로그인되어 있지 않습니다.
  1) npx @railway/cli login
  2) 또는 server/.env 에 RAILWAY_TOKEN= (Railway 대시보드 → Account → Tokens)
"@
    }
    Write-Host "Railway: $out"
}

function Set-RailwayEnvVars([string]$Environment) {
    Write-Host "`n=== Railway environment: $Environment ===" -ForegroundColor Cyan
    foreach ($key in $Vars.Keys) {
        $val = $Vars[$key]
        Write-Host "  $key = $val"
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

Write-Host "Soomgo Bridge Railway vars — v$Version" -ForegroundColor Green
Write-Host "  DOWNLOAD_URL=$DownloadUrl"
Write-Host "  SHA256=$Sha256"

Test-RailwayAuth

$linked = Test-Path (Join-Path $env:USERPROFILE '.railway\config.json')
if (-not $linked) {
    Write-Host @"

프로젝트 연결이 필요합니다. 저장소 루트에서:
  cd $RepoRoot
  npx @railway/cli link

"@ -ForegroundColor Yellow
    Push-Location $RepoRoot
    npx @railway/cli link
    Pop-Location
}

$targets = @()
if ($Target -eq 'both') { $targets = @('staging', 'production') } else { $targets = @($Target) }

foreach ($envName in $targets) {
    Set-RailwayEnvVars $envName
    Show-ManifestHint $envName
}

Write-Host "`n완료 (staging + production)." -ForegroundColor Green
