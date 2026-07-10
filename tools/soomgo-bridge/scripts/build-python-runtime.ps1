# 청소비서 숨고 연동 — Windows embed Python + tkinter + pip 패키지 (Setup에 포함)
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
        & $PythonExe -c "import tkinter; import selenium" 2>$null | Out-Null
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

# embed Python: '.' = python 폴더, 'Lib' = tkinter, '..' = 설치 앱 루트(desktop·automation)
$PthLines = @(
    (Split-Path -Leaf $PthFile.Name).Replace('._pth', '.zip')
    '.'
    '..'
    'Lib'
    'Lib\site-packages'
    ''
    'import site'
)
Set-Content -Path $PthFile.FullName -Value ($PthLines -join "`r`n") -Encoding ASCII

function Install-TkinterBundle {
    param(
        [string]$TargetDir,
        [string]$Version
    )

    Write-Host "Bundle tkinter from full Python $Version (embed package excludes Tcl/Tk)..."
    $FullInstaller = "python-$Version-amd64.exe"
    $FullUrl = "https://www.python.org/ftp/python/$Version/$FullInstaller"
    $FullPath = Join-Path $env:TEMP $FullInstaller
    $FullExtract = Join-Path $env:TEMP "python-full-tk-$Version"

    if (Test-Path $FullExtract) {
        Remove-Item -Recurse -Force $FullExtract
    }
    New-Item -ItemType Directory -Force -Path $FullExtract | Out-Null

    Write-Host "Download full Python installer..."
    Invoke-WebRequest -Uri $FullUrl -OutFile $FullPath -UseBasicParsing

    Write-Host "Extract Tcl/Tk (silent install to temp)..."
    $installArgs = @(
        '/quiet'
        'InstallAllUsers=0'
        'PrependPath=0'
        'Include_test=0'
        'Include_doc=0'
        'Include_debug=0'
        'Include_dev=0'
        'Include_launcher=0'
        'Include_pip=0'
        "TargetDir=$FullExtract"
    )
    $proc = Start-Process -FilePath $FullPath -ArgumentList $installArgs -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
        throw "Full Python install failed (exit $($proc.ExitCode))"
    }

    $TkPyd = Join-Path $FullExtract 'DLLs\_tkinter.pyd'
    if (-not (Test-Path $TkPyd)) {
        throw "tkinter extension missing after full install: $TkPyd"
    }

    $DllsDir = Join-Path $TargetDir 'DLLs'
    New-Item -ItemType Directory -Force -Path $DllsDir | Out-Null
    Copy-Item -Path $TkPyd -Destination $DllsDir -Force

    $LibTkSrc = Join-Path $FullExtract 'Lib\tkinter'
    $LibDestRoot = Join-Path $TargetDir 'Lib'
    New-Item -ItemType Directory -Force -Path $LibDestRoot | Out-Null
    Copy-Item -Path $LibTkSrc -Destination (Join-Path $LibDestRoot 'tkinter') -Recurse -Force

    $TclSrc = Join-Path $FullExtract 'tcl'
    if (-not (Test-Path $TclSrc)) {
        throw "tcl folder missing in full Python: $TclSrc"
    }
    Copy-Item -Path $TclSrc -Destination (Join-Path $TargetDir 'tcl') -Recurse -Force

    Remove-Item -Recurse -Force $FullExtract -ErrorAction SilentlyContinue
    Remove-Item -Force $FullPath -ErrorAction SilentlyContinue
    Write-Host "tkinter files copied."
}

Install-TkinterBundle -TargetDir $RuntimeDir -Version $PythonVersion

$GetPip = Join-Path $env:TEMP 'get-pip.py'
Write-Host "Install pip..."
Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $GetPip -UseBasicParsing
& $PythonExe $GetPip --no-warn-script-location
Remove-Item -Force $GetPip

Write-Host "Install bridge dependencies (may take a minute)..."
$Req1 = Join-Path $BridgeRoot 'requirements.txt'
$Req2 = Join-Path $BridgeRoot 'requirements-desktop.txt'
& $PythonExe -m pip install -r $Req1 -r $Req2 --no-warn-script-location -q

Write-Host "Verify tkinter + selenium..."
& $PythonExe -c "import tkinter; import selenium; root = tkinter.Tk(); root.destroy(); print('runtime ok')"
if ($LASTEXITCODE -ne 0) {
    throw 'Runtime verification failed (tkinter/selenium)'
}

Set-Content -Path $MarkerFile -Value "python=$PythonVersion`ntkinter=1`nbuilt=$(Get-Date -Format o)" -Encoding UTF8
Write-Host "Runtime ready: $RuntimeDir"
