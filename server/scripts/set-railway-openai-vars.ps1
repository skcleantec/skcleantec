# OpenAI 제품별 Railway Variables — staging · production
# server/.env 에서 키를 읽어 clean solution 서비스에 설정 후 redeploy
#
# 사용: cd server; .\scripts\set-railway-openai-vars.ps1

param(
    [ValidateSet('staging', 'production', 'both')]
    [string]$Target = 'both',
    [switch]$SkipRedeploy
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerRoot = Split-Path -Parent $ScriptDir
$ServerEnv = Join-Path $ServerRoot '.env'
$Service = 'clean solution'

function Get-ServerEnvValue([string]$Name) {
    if (-not (Test-Path $ServerEnv)) { return $null }
    foreach ($line in Get-Content $ServerEnv -Encoding UTF8) {
        $trim = $line.Trim()
        if (-not $trim -or $trim.StartsWith('#')) { continue }
        if ($trim -match "^\s*$([regex]::Escape($Name))\s*=\s*(.+)$") {
            return $Matches[1].Trim().Trim('"')
        }
    }
    return $null
}

function Test-RailwayAuth {
    $out = npx @railway/cli@latest whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Railway 로그인 필요: npx @railway/cli login"
    }
    Write-Host "Railway: $out"
}

$quickKey = Get-ServerEnvValue 'QUICK_PASTE_OPENAI_API_KEY'
if (-not $quickKey) { $quickKey = Get-ServerEnvValue 'OPENAI_API_KEY' }
$telecrmKey = Get-ServerEnvValue 'TELECRM_AI_OPENAI_API_KEY'
$quickModel = Get-ServerEnvValue 'QUICK_PASTE_AI_MODEL'
if (-not $quickModel) { $quickModel = 'gpt-4o-mini' }
$telecrmModel = Get-ServerEnvValue 'TELECRM_AI_MODEL'
if (-not $telecrmModel) { $telecrmModel = 'gpt-4o-mini' }
$monthlyLimit = Get-ServerEnvValue 'TELECRM_AI_MONTHLY_LIMIT'
if ($null -eq $monthlyLimit -or $monthlyLimit -eq '') { $monthlyLimit = '0' }

if (-not $quickKey) { throw 'server/.env 에 QUICK_PASTE_OPENAI_API_KEY 또는 OPENAI_API_KEY 가 필요합니다.' }
if (-not $telecrmKey) { throw 'server/.env 에 TELECRM_AI_OPENAI_API_KEY 가 필요합니다.' }

$Vars = [ordered]@{
    QUICK_PASTE_OPENAI_API_KEY = $quickKey
    TELECRM_AI_OPENAI_API_KEY  = $telecrmKey
    TELECRM_AI_MONTHLY_LIMIT   = $monthlyLimit
    QUICK_PASTE_AI_MODEL       = $quickModel
    TELECRM_AI_MODEL           = $telecrmModel
}

function Set-RailwayOpenAiVars([string]$Environment) {
    Write-Host "`n=== Railway $Environment — OpenAI variables ===" -ForegroundColor Cyan
    foreach ($key in $Vars.Keys) {
        Write-Host "  $key"
        npx @railway/cli@latest variable set "${key}=$($Vars[$key])" `
            --environment $Environment --service $Service --skip-deploys | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to set $key on $Environment"
        }
    }
}

function Invoke-RailwayRedeploy([string]$Environment) {
    Write-Host "`n=== Redeploy $Environment ===" -ForegroundColor Green
    npx @railway/cli@latest redeploy --environment $Environment --service $Service -y
    if ($LASTEXITCODE -ne 0) {
        throw "Redeploy failed on $Environment"
    }
}

Test-RailwayAuth

$targets = if ($Target -eq 'both') { @('staging', 'production') } else { @($Target) }
foreach ($envName in $targets) {
    Set-RailwayOpenAiVars $envName
}

if (-not $SkipRedeploy) {
    foreach ($envName in $targets) {
        Invoke-RailwayRedeploy $envName
    }
}

Write-Host "`n완료 — OpenAI Variables 설정됨 ($Target)." -ForegroundColor Green
