# 청소비서 숨고 연동 — Railway Variables 일괄 설정
# server/.env:
#   RAILWAY_TOKEN=        — production 환경 Project Token (Variables 갱신)
#   RAILWAY_API_TOKEN=    — (선택) Account Token → staging·production 둘 다
#   RAILWAY_SERVICE_NAME= — 기본: clean solution
#
# 사용:
#   .\set-railway-vars.ps1 -Target both
#   .\set-railway-vars.ps1 -Target production

param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [string]$Version = '',
    [string]$Sha256 = '',
    [string]$ServiceName = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BridgeRoot = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent (Split-Path -Parent $BridgeRoot)
$ServerEnv = Join-Path $RepoRoot 'server\.env'

$ManifestProduction = 'https://www.cbiseo.com/api/public/soomgo-bridge/manifest'
$ManifestStaging = 'https://clean-solution-staging.up.railway.app/api/public/soomgo-bridge/manifest'
$DefaultServiceName = 'clean solution'

function Import-RailwayEnvFromFile {
    if (-not (Test-Path $ServerEnv)) { return }
    foreach ($line in Get-Content $ServerEnv -Encoding UTF8) {
        $trim = $line.Trim()
        if (-not $trim -or $trim.StartsWith('#')) { continue }
        if ($trim -match '^\s*(RAILWAY_TOKEN|RAILWAY_API_TOKEN|RAILWAY_SERVICE_NAME)\s*=\s*"?([^"#]+)"?\s*$') {
            $name = $Matches[1]
            $val = $Matches[2].Trim()
            Set-Item -Path "Env:$name" -Value $val
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
        throw "Release $tag 에 SoomgoBridge-Setup-$ver.exe 가 없습니다."
    }
    if ([string]$setup.digest -match 'sha256:([a-f0-9]+)') {
        return $Matches[1]
    }
    throw "Setup.exe sha256 digest 를 GitHub Release에서 찾지 못했습니다."
}

function Test-RailwayAccountAuth {
    if (-not $env:RAILWAY_API_TOKEN) { return $false }
    $saved = $env:RAILWAY_TOKEN
    $env:RAILWAY_TOKEN = $null
    try {
        $out = npx @railway/cli@latest whoami 2>&1
        if ($LASTEXITCODE -ne 0) { return $false }
        Write-Host "Railway account: $out"
        return $true
    } finally {
        if ($saved) { $env:RAILWAY_TOKEN = $saved }
    }
}

function Set-RailwaySoomgoVars([string]$Environment, [string]$Svc) {
    Write-Host "`n=== Railway environment: $Environment (service: $Svc) ===" -ForegroundColor Cyan
    $useAccount = Test-RailwayAccountAuth
    if (-not $useAccount -and -not $env:RAILWAY_TOKEN) {
        throw "RAILWAY_TOKEN 또는 RAILWAY_API_TOKEN 이 server/.env 에 필요합니다."
    }
    if (-not $useAccount -and $Environment -ne 'production') {
        Write-Host "  skip: Project Token은 production 만. staging 은 RAILWAY_API_TOKEN 필요." -ForegroundColor Yellow
        return
    }

    $cliArgs = @('variable', 'set')
    if ($useAccount) {
        $env:RAILWAY_TOKEN = $null
        $cliArgs += @('--environment', $Environment)
    }
    $cliArgs += @('--service', $Svc, '--skip-deploys')

    foreach ($key in $Vars.Keys) {
        $pair = "${key}=$($Vars[$key])"
        Write-Host "  $pair"
        & npx @railway/cli@latest @cliArgs $pair
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to set $key on $Environment"
        }
    }
}

Import-RailwayEnvFromFile

if (-not $Version) { $Version = Get-DefaultBridgeVersion }
if (-not $Sha256) { $Sha256 = Get-SetupSha256FromGitHub $Version }
if (-not $ServiceName) {
    $ServiceName = if ($env:RAILWAY_SERVICE_NAME) { $env:RAILWAY_SERVICE_NAME } else { $DefaultServiceName }
}

$SetupExe = "SoomgoBridge-Setup-$Version.exe"
$DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v$Version/$SetupExe"

$Vars = [ordered]@{
    SOOMGO_BRIDGE_REQUIRED_VERSION = '2'
    SOOMGO_BRIDGE_LATEST_VERSION   = $Version
    SOOMGO_BRIDGE_DOWNLOAD_URL     = $DownloadUrl
    SOOMGO_BRIDGE_SHA256           = $Sha256
    SOOMGO_BRIDGE_RELEASE_NOTES    = "Soomgo Bridge Setup v$Version (cbiseo.com)"
}

Write-Host "Soomgo Bridge Railway vars — v$Version" -ForegroundColor Green
Write-Host "  SERVICE=$ServiceName"
Write-Host "  DOWNLOAD_URL=$DownloadUrl"
Write-Host "  SHA256=$Sha256"

$targets = if ($Target -eq 'both') { @('staging', 'production') } else { @($Target) }
foreach ($envName in $targets) {
    Set-RailwaySoomgoVars $envName $ServiceName
    $url = if ($envName -eq 'production') { $ManifestProduction } else { $ManifestStaging }
    Write-Host "Manifest check: $url"
}

Write-Host "`n완료." -ForegroundColor Green
