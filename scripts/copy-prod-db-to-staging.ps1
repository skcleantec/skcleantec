<#
.SYNOPSIS
  운영(또는 소스) PostgreSQL → 스테이징(또는 대상) PostgreSQL로 pg_dump / pg_restore.

.DESCRIPTION
  - 소스에서 custom 형식(-Fc) 덤프를 만든 뒤, 대상 DB에 --clean --if-exists 로 복원합니다.
  - Railway 등: 반드시 **로컬 PC에서 접속 가능한 공개 URL** (*.proxy.rlwy.net, sslmode=require) 을 사용하세요.
  - postgres.railway.internal 은 로컬에서 동작하지 않습니다.

.PREREQUISITES
  - 로컬 PATH 에 pg_dump / pg_restore 가 있거나,
  - Docker Desktop 으로 postgres:18 이미지를 끌어와 실행 가능해야 합니다.

.EXAMPLE
  .\scripts\copy-prod-db-to-staging.ps1 `
    -SourceDatabaseUrl 'postgresql://...운영...?sslmode=require' `
    -TargetDatabaseUrl 'postgresql://...스테이징...?sslmode=require'

.EXAMPLE
  $env:SKCT_SOURCE_DATABASE_URL = '<Railway production 공개 Proxy>'
  $env:SKCT_TARGET_DATABASE_URL = '<Railway staging 공개 Proxy>'
  .\scripts\copy-prod-db-to-staging.ps1 -SkipConfirm

.NOTES
  연결 문자열을 채팅·이슈·git에 넣지 마세요. 터미널 히스토리에도 남으므로 작업 후 필요 시 히스토리 정리하세요.

  환경변수 SKCT_SOURCE_DATABASE_URL / SKCT_TARGET_DATABASE_URL 로 URL 을 줄 수 있습니다 (히스토리 노출을 줄이려면 세션 전용 설정 권장).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false, HelpMessage = '소스 DB DATABASE_URL (공개 Proxy 권장). 비우면 $env:SKCT_SOURCE_DATABASE_URL')]
  [string] $SourceDatabaseUrl,

  [Parameter(Mandatory = $false, HelpMessage = '대상 DB DATABASE_URL — 기존 데이터가 덮어써질 수 있음. 비우면 $env:SKCT_TARGET_DATABASE_URL')]
  [string] $TargetDatabaseUrl,

  [switch] $SkipConfirm
)

$ErrorActionPreference = 'Stop'

if (-not $SourceDatabaseUrl -or [string]::IsNullOrWhiteSpace($SourceDatabaseUrl)) {
  $SourceDatabaseUrl = $env:SKCT_SOURCE_DATABASE_URL
}
if (-not $TargetDatabaseUrl -or [string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
  $TargetDatabaseUrl = $env:SKCT_TARGET_DATABASE_URL
}
if ([string]::IsNullOrWhiteSpace($SourceDatabaseUrl) -or [string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
  throw @"
소스·대상 DATABASE_URL 이 필요합니다.

  방법 1 — 파라미터:
    .\scripts\copy-prod-db-to-staging.ps1 -SourceDatabaseUrl '운영_URL' -TargetDatabaseUrl '스테이징_URL'

  방법 2 — 세션 환경변수 (Railway production / staging Postgres 의 공개 Proxy URL):
    `$env:SKCT_SOURCE_DATABASE_URL = '<운영>'
    `$env:SKCT_TARGET_DATABASE_URL = '<스테이징>'
    .\scripts\copy-prod-db-to-staging.ps1 -SkipConfirm

postgres.railway.internal 은 로컬에서 사용할 수 없습니다. *.proxy.rlwy.net 등 외부 접속 가능한 문자열만 사용하세요.
"@
}

function Test-PgTool {
  param([string] $Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-DockerPostgres18 {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    throw 'Docker 가 PATH 에 없습니다. Docker Desktop 을 설치·실행하거나 PostgreSQL 클라이언트를 설치하세요.'
  }
  & docker image inspect postgres:18 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[docker] postgres:18 이미지 없음 → docker pull postgres:18'
    & docker pull postgres:18
    if ($LASTEXITCODE -ne 0) { throw 'docker pull postgres:18 실패' }
  }
}

$haveLocalPg = (Test-PgTool -Name 'pg_dump') -and (Test-PgTool -Name 'pg_restore')
$useDocker = -not $haveLocalPg

if ($useDocker) {
  Write-Host '[info] 로컬 pg_dump 미설치 → Docker postgres:18 으로 덤프/복원합니다.' -ForegroundColor Cyan
  Ensure-DockerPostgres18
}

$dumpPath = Join-Path $env:TEMP ("skcleanteck-db-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".dump")
$dumpParent = Split-Path $dumpPath -Parent
$dumpLeaf = Split-Path $dumpPath -Leaf
$dumpVol = ($dumpParent -replace '\\', '/')

try {
  if (-not $SkipConfirm) {
    Write-Host ''
    Write-Host '>>> 대상 DB에 pg_restore --clean --if-exists 가 실행됩니다.' -ForegroundColor Yellow
    Write-Host '>>> 대상(스테이징)의 기존 스키마/데이터가 삭제·덮어쓰기 될 수 있습니다.' -ForegroundColor Yellow
    Write-Host '>>> 계속하려면 Enter, 취소하려면 Ctrl+C' -ForegroundColor Yellow
    Read-Host | Out-Null
  }

  Write-Host "[1/2] pg_dump (소스) -> $dumpPath"
  if (-not $useDocker) {
    & pg_dump --dbname=$SourceDatabaseUrl -Fc -f $dumpPath --no-owner --no-acl
    if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패 (exit $LASTEXITCODE)" }
  }
  else {
    & docker run --rm `
      -v "${dumpVol}:/dumpvol" `
      postgres:18 `
      pg_dump "--dbname=$SourceDatabaseUrl" -Fc -f "/dumpvol/$dumpLeaf" --no-owner --no-acl
    if ($LASTEXITCODE -ne 0) { throw "pg_dump (docker) 실패 (exit $LASTEXITCODE)" }
  }

  Write-Host '[2/2] pg_restore (대상)'
  if (-not $useDocker) {
    & pg_restore --clean --if-exists --dbname=$TargetDatabaseUrl --no-owner --no-acl $dumpPath
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "pg_restore 가 비 0으로 끝났습니다. 권한·소유자 경고는 있어도 데이터는 들어갔을 수 있습니다. 로그를 확인하세요. (exit $LASTEXITCODE)"
    }
  }
  else {
    & docker run --rm `
      -v "${dumpVol}:/dumpvol" `
      postgres:18 `
      pg_restore --clean --if-exists "--dbname=$TargetDatabaseUrl" --no-owner --no-acl "/dumpvol/$dumpLeaf"
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "pg_restore (docker) 가 비 0으로 끝났습니다. 권한·소유자 경고는 있어도 데이터는 들어갔을 수 있습니다. 로그를 확인하세요. (exit $LASTEXITCODE)"
    }
  }

  Write-Host "완료. 덤프 파일: $dumpPath (삭제해도 됨)" -ForegroundColor Green
}
finally {
  if (Test-Path $dumpPath) {
    Write-Host "덤프 유지: $dumpPath"
  }
}
