<#
.SYNOPSIS
  server/.env.staging 을 만들거나, 스테이징 DATABASE_URL을 server/.env.staging 에 반영합니다.

.DESCRIPTION
  팀 로컬 기본 DB는 Railway staging Postgres 공개 Proxy URL 입니다.
  server/src/env.ts 가 server/.env.staging 을 읽어 DATABASE_URL 을 덮어씁니다.

.EXAMPLE
  # Railway에서 복사한 URL을 직접 지정 (채팅·git에 URL 넣지 마세요)
  .\scripts\apply-local-staging-env.ps1 -DatabaseUrl 'postgresql://...?sslmode=require'

.EXAMPLE
  # 세션 환경변수 사용 (히스토리 노출 줄이기)
  $env:SKCT_TARGET_DATABASE_URL = '<Railway staging 공개 Proxy DATABASE_URL>'
  .\scripts\apply-local-staging-env.ps1
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string] $DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stagingPath = Join-Path $root 'server\.env.staging'
$templatePath = Join-Path $root 'server\env.staging.template'

if (-not $DatabaseUrl -or [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = $env:SKCT_TARGET_DATABASE_URL
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  if (-not (Test-Path $stagingPath)) {
    if (Test-Path $templatePath) {
      Copy-Item $templatePath $stagingPath
      Write-Host "server/.env.staging 템플릿을 생성했습니다."
      Write-Host "Railway staging Postgres 공개 Proxy URL을 DATABASE_URL= 에 넣은 뒤 다시 실행하세요."
      Write-Host "참고: STAGING_SETUP.md"
      notepad $stagingPath
      exit 1
    }
    throw 'DATABASE_URL이 필요합니다. -DatabaseUrl 또는 $env:SKCT_TARGET_DATABASE_URL'
  }

  $content = Get-Content $stagingPath -Raw
  if ($content -match 'HOST\.proxy\.rlwy\.net' -or $content -match 'USER:PASSWORD@') {
    Write-Host "server/.env.staging 에 아직 placeholder가 있습니다. Railway staging URL을 넣어 주세요."
    notepad $stagingPath
    exit 1
  }

  Write-Host "server/.env.staging 이 이미 있습니다. API를 재시작하면 반영됩니다."
  exit 0
}

if ($DatabaseUrl -match 'railway\.internal') {
  throw 'postgres.railway.internal 은 로컬 PC에서 사용할 수 없습니다. *.proxy.rlwy.net 공개 URL을 사용하세요.'
}

$base = @"
# Railway staging — apply-local-staging-env.ps1 로 생성/갱신 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))
DATABASE_URL="$DatabaseUrl"
JWT_SECRET="dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
"@

Set-Content -Path $stagingPath -Value $base -Encoding UTF8
Write-Host "server/.env.staging 을 저장했습니다. npm run dev (또는 dev.bat) 로 API를 재시작하세요."
