# 청소비서 숨고 연동 — Windows full Python (tkinter 포함) + pip 패키지
param(
    [string]$PythonVersion = '3.12.7',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuntimeDir = Join-Path $BridgeRoot 'runtime\python'
$MarkerFile = Join-Path $RuntimeDir '.runtime-ready'
$PythonExe = Join-Path $RuntimeDir 'python.exe'

function Test-RuntimeReady {
    if (-not (Test-Path $MarkerFile)) { return $false }
    if (-not (Test-Path $PythonExe)) { return $false }
    try {
        & $PythonExe -c "import tkinter; import selenium; import _tkinter" 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if ((Test-RuntimeReady) -and -not $Force) {
    Write-Host "Python runtime already built: $RuntimeDir"
    exit 0
}

if (Test-Path $RuntimeDir) {
    Remove-Item -Recurse -Force $RuntimeDir
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$FullInstaller = "python-$PythonVersion-amd64.exe"
$FullUrl = "https://www.python.org/ftp/python/$PythonVersion/$FullInstaller"
$FullPath = Join-Path $env:TEMP $FullInstaller

Write-Host "Download full Python $PythonVersion (tkinter included)..."
Invoke-WebRequest -Uri $FullUrl -OutFile $FullPath -UseBasicParsing

Write-Host "Silent install to $RuntimeDir ..."
$installArgs = @(
    '/quiet'
    'InstallAllUsers=0'
    'PrependPath=0'
    'Include_test=0'
    'Include_doc=0'
    'Include_debug=0'
    'Include_dev=0'
    'Include_launcher=0'
    "TargetDir=$RuntimeDir"
)
$proc = Start-Process -FilePath $FullPath -ArgumentList $installArgs -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    throw "Full Python install failed (exit $($proc.ExitCode))"
}
Remove-Item -Force $FullPath -ErrorAction SilentlyContinue

if (-not (Test-Path $PythonExe)) {
    throw "python.exe missing after install: $PythonExe"
}

# 설치본 app/python → 상위 app 루트(desktop·automation)를 import 경로에 추가
$SitePackages = Join-Path $RuntimeDir 'Lib\site-packages'
New-Item -ItemType Directory -Force -Path $SitePackages | Out-Null
$AppRootPth = Join-Path $SitePackages 'soomgo-bridge-app-root.pth'
Set-Content -Path $AppRootPth -Value '..\..\..' -Encoding ASCII

Write-Host "Install bridge dependencies (may take a minute)..."
$Req1 = Join-Path $BridgeRoot 'requirements.txt'
$Req2 = Join-Path $BridgeRoot 'requirements-desktop.txt'
& $PythonExe -m pip install -r $Req1 -r $Req2 --no-warn-script-location -q

Write-Host "Verify tkinter + selenium..."
& $PythonExe -c "import tkinter; import selenium; root = tkinter.Tk(); root.destroy(); print('runtime ok')"
if ($LASTEXITCODE -ne 0) {
    throw 'Runtime verification failed (tkinter/selenium)'
}

Set-Content -Path $MarkerFile -Value "python=$PythonVersion`nfull=1`ntkinter=1`nbuilt=$(Get-Date -Format o)" -Encoding UTF8
Write-Host "Runtime ready: $RuntimeDir"
