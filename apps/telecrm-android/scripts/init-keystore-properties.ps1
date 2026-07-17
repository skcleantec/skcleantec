# keystore.properties 생성 — Android Studio에서 정한 비밀번호 입력
# 사용: .\scripts\init-keystore-properties.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'keystore.properties'
$Jks = Join-Path $Root 'keystore\telecrm-release.jks'

if (-not (Test-Path $Jks)) {
    throw "keystore 파일이 없습니다: $Jks`nAndroid Studio에서 Create new… 로 먼저 만드세요."
}

Write-Host "청소비서 전화 release keystore 설정" -ForegroundColor Cyan
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

# keytool로 비밀번호 검증
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
& $keytool -list -keystore $Jks -alias telecrm -storepass $storePlain -keypass $keyPlain 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "비밀번호 또는 alias(telecrm)가 맞지 않습니다. Android Studio에서 만든 값을 다시 확인하세요."
}

$content = @"
storeFile=keystore/telecrm-release.jks
storePassword=$storePlain
keyAlias=telecrm
keyPassword=$keyPlain
"@

Set-Content -Path $Out -Value $content -Encoding UTF8 -NoNewline
Write-Host "`n저장 완료: $Out" -ForegroundColor Green
Write-Host "Gradle release 빌드: .\gradlew.bat assembleRelease" -ForegroundColor DarkGray
