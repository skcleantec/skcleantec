# Play upload keystore 생성 — keytool (터미널 전용, Android Studio GUI 사용 안 함)
# 사용: cd apps\cbiseo-android ; .\scripts\create-release-keystore.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$KeystoreDir = Join-Path $Root 'keystore'
$Jks = Join-Path $KeystoreDir 'cbiseo-release.jks'
$Alias = 'cbiseo'

if (Test-Path $Jks) {
    throw "이미 keystore가 있습니다: $Jks`n재생성하면 Play 업로드 키가 바뀝니다. 의도적 교체가 아니면 중단하세요."
}

$keytool = $null
$candidates = @(
    "$env:JAVA_HOME\bin\keytool.exe",
    "$env:LOCALAPPDATA\Android\Sdk\jbr\bin\keytool.exe",
    "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe",
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr\bin\keytool.exe",
    'keytool'
)
foreach ($c in $candidates) {
    if ($c -eq 'keytool') { $keytool = 'keytool'; break }
    if (Test-Path $c) { $keytool = $c; break }
}
if (-not $keytool) {
    throw 'keytool을 찾을 수 없습니다. JDK 또는 Android Studio JBR 경로를 확인하세요.'
}

function ConvertFrom-SecureStringPlain([Security.SecureString]$Secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

Write-Host '청소비서(com.cbiseo.app) Play upload keystore 생성' -ForegroundColor Cyan
Write-Host "출력: $Jks`n"

$storePassword = Read-Host 'Keystore 비밀번호 (Store password, 6자 이상)' -AsSecureString
$keyPasswordSecure = Read-Host 'Key 비밀번호 (Enter = Store와 동일)' -AsSecureString
$storePlain = ConvertFrom-SecureStringPlain $storePassword
$keyPlain = if ($keyPasswordSecure.Length -eq 0) { $storePlain } else { ConvertFrom-SecureStringPlain $keyPasswordSecure }

New-Item -ItemType Directory -Force -Path $KeystoreDir | Out-Null

$dname = 'CN=Cbiseo Staff App, OU=Mobile, O=Service Bridges, L=Seoul, ST=Seoul, C=KR'
& $keytool -genkeypair `
    -v `
    -keystore $Jks `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $storePlain `
    -keypass $keyPlain `
    -dname $dname

if ($LASTEXITCODE -ne 0) { throw 'keytool -genkeypair 실패' }

$propsPath = Join-Path $Root 'keystore.properties'
$propsContent = @"
storeFile=keystore/cbiseo-release.jks
storePassword=$storePlain
keyAlias=$Alias
keyPassword=$keyPlain
"@
Set-Content -Path $propsPath -Value $propsContent -Encoding ASCII -NoNewline

Write-Host "`nkeystore 생성 완료: $Jks" -ForegroundColor Green
Write-Host "keystore.properties 저장: $propsPath" -ForegroundColor Green
Write-Host '다음: .\scripts\build-play-bundle.ps1' -ForegroundColor DarkGray
