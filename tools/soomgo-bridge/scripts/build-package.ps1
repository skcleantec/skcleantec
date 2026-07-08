# (레거시) build-release.ps1 를 호출합니다.
param(
    [string]$Version = '2.0.0'
)
& (Join-Path $PSScriptRoot 'build-release.ps1') -Version $Version
