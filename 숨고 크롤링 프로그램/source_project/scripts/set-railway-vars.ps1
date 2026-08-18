# 숨고 크롤링 자동화 — Railway Variables 일괄 설정
param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [string]$Version = '',
    [string]$Sha256 = '',
    [string]$ServiceName = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Split-Path -Parent $ScriptDir
$RepoRoot = (Resolve-Path (Join-Path $SourceDir '..\..')).Path
$ServerEnv = Join-Path $RepoRoot 'server\.env'
$DefaultServiceName = 'clean solution'

function Import-RailwayEnvFromFile {
    if (-not (Test-Path $ServerEnv)) { return }
    foreach ($line in Get-Content $ServerEnv -Encoding UTF8) {
        $trim = $line.Trim()
        if (-not $trim -or $trim.StartsWith('#')) { continue }
        if ($trim -match '^\s*(RAILWAY_TOKEN|RAILWAY_API_TOKEN|RAILWAY_SERVICE_NAME)\s*=\s*"?([^"#]+)"?\s*$') {
            Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim()
        }
    }
}

function Get-DefaultVersion {
    $versionFile = Join-Path $SourceDir 'version_info.py'
    $content = Get-Content $versionFile -Raw -Encoding UTF8
    if ($content -match "APP_VERSION\s*=\s*'([^']+)'") { return $Matches[1] }
    return '1.0.0'
}

function Get-ZipSha256FromGitHub([string]$ver) {
    $tag = "soomgo-automation-v$ver"
    $zipName = "SoomgoAutomation-$ver.zip"
    $api = "https://api.github.com/repos/skcleantec/skcleantec/releases/tags/$tag"
    Write-Host "Fetching release $tag ..."
    $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'skcleantec-soomgo-automation' }
    $asset = $release.assets | Where-Object { $_.name -eq $zipName } | Select-Object -First 1
    if (-not $asset) { throw "Release $tag 에 $zipName 가 없습니다." }
    if ([string]$asset.digest -match 'sha256:([a-f0-9]+)') { return $Matches[1] }
    throw 'ZIP sha256 digest 를 GitHub Release에서 찾지 못했습니다.'
}

Import-RailwayEnvFromFile
if (-not $Version) { $Version = Get-DefaultVersion }
if (-not $Sha256) { $Sha256 = Get-ZipSha256FromGitHub $Version }
if (-not $ServiceName) { $ServiceName = $env:RAILWAY_SERVICE_NAME; if (-not $ServiceName) { $ServiceName = $DefaultServiceName } }

$ZipName = "SoomgoAutomation-$Version.zip"
$DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/soomgo-automation-v$Version/$ZipName"

$vars = @{
    SOOMGO_AUTOMATION_LATEST_VERSION     = $Version
    SOOMGO_AUTOMATION_DOWNLOAD_URL       = $DownloadUrl
    SOOMGO_AUTOMATION_SHA256             = $Sha256
    SOOMGO_AUTOMATION_RELEASE_NOTES      = "오래된 채팅 정리·탈퇴/상대방 나감 처리·희망일 판정·나가기 팝업 속도 (v$Version)"
}

function Set-RailwayVars([string]$Environment) {
    Write-Host "Setting Railway variables ($Environment) ..."
    foreach ($entry in $vars.GetEnumerator()) {
        npx @railway/cli@latest variables set "$($entry.Key)=$($entry.Value)" --service $ServiceName --environment $Environment
        if ($LASTEXITCODE -ne 0) { throw "Railway variables set failed ($Environment): $($entry.Key)" }
    }
}

if ($Target -eq 'staging' -or $Target -eq 'both') { Set-RailwayVars 'staging' }
if ($Target -eq 'production' -or $Target -eq 'both') { Set-RailwayVars 'production' }

Write-Host 'Done.'
