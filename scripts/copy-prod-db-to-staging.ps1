<#
.SYNOPSIS
  운영(또는 소스) PostgreSQL → 스테이징(또는 대상) PostgreSQL로 pg_dump / pg_restore.

.DESCRIPTION
  - 소스에서 custom 형식(-Fc) 덤프를 만든 뒤, 대상 DB에 --clean --if-exists 로 복원합니다.
  - Railway 등: 반드시 **로컬 PC에서 접속 가능한 공개 URL** (*.proxy.rlwy.net, sslmode=require) 을 사용하세요.
  - postgres.railway.internal 은 로컬에서 동작하지 않습니다.

.PREREQUISITES
  PATH에 pg_dump, pg_restore 가 있어야 합니다 (PostgreSQL 클라이언트 설치).

.EXAMPLE
  .\scripts\copy-prod-db-to-staging.ps1 `
    -SourceDatabaseUrl 'postgresql://...운영...?sslmode=require' `
    -TargetDatabaseUrl 'postgresql://...스테이징...?sslmode=require'

.NOTES
  연결 문자열을 채팅·이슈·git에 넣지 마세요. 터미널 히스토리에도 남으므로 작업 후 필요 시 히스토리 정리하세요.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, HelpMessage = '소스 DB DATABASE_URL (공개 Proxy 권장)')]
  [string] $SourceDatabaseUrl,

  [Parameter(Mandatory = $true, HelpMessage = '대상 DB DATABASE_URL — 기존 데이터가 덮어써질 수 있음')]
  [string] $TargetDatabaseUrl,

  [switch] $SkipConfirm
)

$ErrorActionPreference = 'Stop'

function Test-PgTool {
  param([string] $Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "PATH에서 '$Name' 을 찾을 수 없습니다. PostgreSQL 클라이언트(예: https://www.postgresql.org/download/windows/)를 설치하고 bin을 PATH에 추가하세요."
  }
}

Test-PgTool -Name 'pg_dump'
Test-PgTool -Name 'pg_restore'

$dumpPath = Join-Path $env:TEMP ("skcleanteck-db-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".dump")

try {
  if (-not $SkipConfirm) {
    Write-Host ""
    Write-Host ">>> 대상 DB에 pg_restore --clean --if-exists 가 실행됩니다." -ForegroundColor Yellow
    Write-Host ">>> 대상(스테이징)의 기존 스키마/데이터가 삭제·덮어쓰기 될 수 있습니다." -ForegroundColor Yellow
    Write-Host ">>> 계속하려면 Enter, 취소하려면 Ctrl+C" -ForegroundColor Yellow
    Read-Host | Out-Null
  }

  Write-Host "[1/2] pg_dump (소스) -> $dumpPath"
  & pg_dump --dbname=$SourceDatabaseUrl -Fc -f $dumpPath --no-owner --no-acl
  if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패 (exit $LASTEXITCODE)" }

  Write-Host "[2/2] pg_restore (대상)"
  & pg_restore --clean --if-exists --dbname=$TargetDatabaseUrl --no-owner --no-acl $dumpPath
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "pg_restore 가 비 0으로 끝났습니다. 권한·소유자 경고는 있어도 데이터는 들어갔을 수 있습니다. 로그를 확인하세요. (exit $LASTEXITCODE)"
  }

  Write-Host "완료. 덤프 파일: $dumpPath (삭제해도 됨)" -ForegroundColor Green
}
finally {
  if (Test-Path $dumpPath) {
    Write-Host "덤프 유지: $dumpPath"
  }
}
