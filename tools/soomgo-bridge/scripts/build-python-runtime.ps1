# 청소비서 숨고 연동 — Windows embed Python + pip 패키지 (Setup에 포함)
param(
    [string]$PythonVersion = '3.12.7',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$RuntimeDir = Join-Path $BridgeRoot 'runtime\python'
$MarkerFile = Join-Path $RuntimeDir '.runtime-ready'
$PythonExe = Join-Path $RuntimeDir 'python.exe'

if ((Test-Path $MarkerFile) -and (Test-Path $PythonExe) -and -not $Force) {
    Write-Host "Python runtime already built: $RuntimeDir"
    exit 0
}

if (Test-Path $RuntimeDir) {
    Remove-Item -Recurse -Force $RuntimeDir
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$ZipName = "python-$PythonVersion-embed-amd64.zip"
$ZipUrl = "https://www.python.org/ftp/python/$PythonVersion/$ZipName"
$ZipPath = Join-Path $env:TEMP $ZipName

Write-Host "Download embed Python $PythonVersion..."
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
Expand-Archive -Path $ZipPath -DestinationPath $RuntimeDir -Force
Remove-Item -Force $ZipPath

$PthFile = Get-ChildItem -Path $RuntimeDir -Filter 'python*._pth' | Select-Object -First 1
if (-not $PthFile) {
    throw "python*._pth not found in $RuntimeDir"
}

$SitePackages = Join-Path $RuntimeDir 'Lib\site-packages'
New-Item -ItemType Directory -Force -Path $SitePackages | Out-Null

# embed Python: '.' 은 python.exe 폴더만 가리킴 — 상위(앱 루트)에 desktop·automation 패키지
$PthLines = @(
    (Split-Path -Leaf $PthFile.Name).Replace('._pth', '.zip')
    '.'
    '..'
    'Lib\site-packages'
    ''
    'import site'
)
Set-Content -Path $PthFile.FullName -Value ($PthLines -join "`r`n") -Encoding ASCII

$GetPip = Join-Path $env:TEMP 'get-pip.py'
Write-Host "Install pip..."
Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $GetPip -UseBasicParsing
& $PythonExe $GetPip --no-warn-script-location
Remove-Item -Force $GetPip

Write-Host "Install bridge dependencies (may take a minute)..."
$Req1 = Join-Path $BridgeRoot 'requirements.txt'
$Req2 = Join-Path $BridgeRoot 'requirements-desktop.txt'
& $PythonExe -m pip install -r $Req1 -r $Req2 --no-warn-script-location -q

Set-Content -Path $MarkerFile -Value "python=$PythonVersion`nbuilt=$(Get-Date -Format o)" -Encoding UTF8
Write-Host "Runtime ready: $RuntimeDir"
