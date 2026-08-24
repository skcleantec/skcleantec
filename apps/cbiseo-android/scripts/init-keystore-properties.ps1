# keystore.properties 생성 — Android Studio에서 정한 비밀번호 입력
# 사용: .\scripts\init-keystore-properties.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'keystore.properties'
$Jks = Join-Path $Root 'keystore\cbiseo-release.jks'

if (-not (Test-Path $Jks)) {
    throw "keystore 파일이 없습니다: $Jks`n먼저 터미널에서: .\scripts\create-release-keystore.ps1"
}

Write-Host "청소비서(com.cbiseo.app) release keystore 설정" -ForegroundColor Cyan
Write-Host "파일: $Out`n"

$storePassword = Read-Host 'Keystore 비밀번호 (Store password)' -AsSecureString
$keyPasswordSecure = Read-Host 'Key 비밀번호 (Enter = Store와 동일)' -AsSecureString

function ConvertFrom-SecureStringPlain([Security.SecureString]$Secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$storePlain = ConvertFrom-SecureStringPlain $storePassword
$keyPlain = if ($keyPasswordSecure.Length -eq 0) { $storePlain } else { ConvertFrom-SecureStringPlain $keyPasswordSecure }

$keytool = $null
$candidates = @(
    "$env:JAVA_HOME\bin\keytool.exe",
    "$env:LOCALAPPDATA\Android\Sdk\jbr\bin\keytool.exe",
    'keytool'
)
foreach ($c in $candidates) {
    if ($c -eq 'keytool') { $keytool = 'keytool'; break }
    if (Test-Path $c) { $keytool = $c; break }
}

Write-Host "`n비밀번호 확인 중…" -ForegroundColor DarkGray
& $keytool -list -keystore $Jks -alias cbiseo -storepass $storePlain -keypass $keyPlain 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "비밀번호 또는 alias(cbiseo)가 맞지 않습니다. create-release-keystore.ps1 로 만든 값을 다시 확인하세요."
}

$content = @"
storeFile=keystore/cbiseo-release.jks
storePassword=$storePlain
keyAlias=cbiseo
keyPassword=$keyPlain
"@

Set-Content -Path $Out -Value $content -Encoding ASCII -NoNewline
Write-Host "`n저장 완료: $Out" -ForegroundColor Green
Write-Host "Play AAB: .\scripts\build-play-bundle.ps1" -ForegroundColor DarkGray
