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

function Import-RailwayEnvFromOs {
    foreach ($name in @('RAILWAY_API_TOKEN', 'RAILWAY_TOKEN', 'RAILWAY_SERVICE_NAME')) {
        if ([string]::IsNullOrWhiteSpace((Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue).Value)) {
            foreach ($scope in @('User', 'Machine')) {
                $val = [Environment]::GetEnvironmentVariable($name, $scope)
                if ($val) {
                    Set-Item -Path "Env:$name" -Value $val
                    break
                }
            }
        }
    }
}

function Initialize-RailwayAuth {
    Import-RailwayEnvFromFile
    Import-RailwayEnvFromOs

    if ($env:RAILWAY_API_TOKEN) {
        Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
        Write-Host 'Railway auth: RAILWAY_API_TOKEN (account — staging·production)' -ForegroundColor DarkGray
        return 'account'
    }
    if ($env:RAILWAY_TOKEN) {
        Write-Host 'Railway auth: RAILWAY_TOKEN (project — production only)' -ForegroundColor DarkGray
        return 'project'
    }

    $savedToken = $env:RAILWAY_TOKEN
    $env:RAILWAY_TOKEN = $null
    try {
        $out = npx @railway/cli@latest whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Railway auth: CLI login ($out)"
            return 'account'
        }
    } finally {
        if ($savedToken) { $env:RAILWAY_TOKEN = $savedToken } else { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
    }

    throw @"
Railway 인증 정보가 없습니다.

1) Railway 웹 → 우측 프로필 → Account Settings → Tokens → Create Token
2) server/.env 에 한 줄 추가 (git·채팅에 토큰 붙여넣기 금지):
   RAILWAY_API_TOKEN=여기에_토큰
   RAILWAY_SERVICE_NAME=clean solution
3) 이 스크립트 다시 실행

Windows '환경 변수'에만 넣었다면 Cursor/터미널을 완전히 재시작하거나, server/.env 를 쓰는 편이 에이전트·스크립트에 더 확실합니다.
"@
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

$authMode = Initialize-RailwayAuth
if (-not $Version) { $Version = Get-DefaultVersion }
if (-not $Sha256) { $Sha256 = Get-ZipSha256FromGitHub $Version }
if (-not $ServiceName) { $ServiceName = $env:RAILWAY_SERVICE_NAME; if (-not $ServiceName) { $ServiceName = $DefaultServiceName } }

$ZipName = "SoomgoAutomation-$Version.zip"
$DownloadUrl = "https://github.com/skcleantec/skcleantec/releases/download/soomgo-automation-v$Version/$ZipName"

$vars = @{
    SOOMGO_AUTOMATION_LATEST_VERSION     = $Version
    SOOMGO_AUTOMATION_DOWNLOAD_URL       = $DownloadUrl
    SOOMGO_AUTOMATION_SHA256             = $Sha256
    SOOMGO_AUTOMATION_RELEASE_NOTES      = "이모지/견적조회 마지막 텍스트 미전송 수정 — 긴 본문 전송 확인·이미지 전송 버튼 (v$Version)"
}

function Set-RailwayVars([string]$Environment) {
    Write-Host "Setting Railway variables ($Environment) ..."
    if ($authMode -eq 'project' -and $Environment -ne 'production') {
        Write-Host "  skip: RAILWAY_TOKEN(project)은 production 만. staging 은 RAILWAY_API_TOKEN 필요." -ForegroundColor Yellow
        return
    }

    $cliArgs = @('variable', 'set')
    if ($authMode -eq 'account') {
        Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
        $cliArgs += @('--environment', $Environment)
    }
    $cliArgs += @('--service', $ServiceName)

    foreach ($entry in $vars.GetEnumerator()) {
        & npx @railway/cli@latest @cliArgs "$($entry.Key)=$($entry.Value)"
        if ($LASTEXITCODE -ne 0) { throw "Railway variables set failed ($Environment): $($entry.Key)" }
    }
}

if ($Target -eq 'staging' -or $Target -eq 'both') { Set-RailwayVars 'staging' }
if ($Target -eq 'production' -or $Target -eq 'both') { Set-RailwayVars 'production' }

Write-Host 'Done.'
