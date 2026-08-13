#Requires -Version 5.1
<#
  SoomgoAutomation ZIP 자동 업데이트 — 메인 EXE 종료 후 파일 교체·재시작
#>
param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$AppDir,
    [Parameter(Mandatory = $true)][string]$ExePath,
    [Parameter(Mandatory = $true)][int]$WaitPid
)

$ErrorActionPreference = 'Stop'

function Wait-ProcessExit([int]$Pid, [int]$TimeoutSec = 120) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $proc = Get-Process -Id $Pid -ErrorAction SilentlyContinue
        if (-not $proc) { return }
        Start-Sleep -Milliseconds 400
    }
    throw "PID $Pid 종료 대기 시간 초과"
}

function Stop-StaleAutomationProcesses([string]$Dir) {
    $needles = @($Dir)
    foreach ($name in @('chromedriver.exe')) {
        Get-CimInstance Win32_Process -Filter "name='$name'" -ErrorAction SilentlyContinue | ForEach-Object {
            $cmd = [string]$_.CommandLine
            if ($cmd -and ($needles | Where-Object { $cmd -like "*$_*" })) {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Wait-ProcessExit -Pid $WaitPid
Stop-StaleAutomationProcesses -Dir $AppDir

if (-not (Test-Path -LiteralPath $ZipPath)) {
    throw "ZIP 없음: $ZipPath"
}

$tempRoot = Join-Path $env:TEMP ("SoomgoAutomation-update-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $tempRoot -Force

    $payloadRoot = $tempRoot
    $children = Get-ChildItem -LiteralPath $tempRoot -Directory
    if ($children.Count -eq 1 -and -not (Test-Path (Join-Path $tempRoot 'SoomgoAutomation.exe'))) {
        $payloadRoot = $children[0].FullName
    }

    if (-not (Test-Path (Join-Path $payloadRoot 'SoomgoAutomation.exe'))) {
        throw 'ZIP 안에 SoomgoAutomation.exe 가 없습니다.'
    }

    & robocopy $payloadRoot $AppDir /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /R:2 /W:2 | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy 실패 (exit=$LASTEXITCODE)"
    }

    Start-Process -FilePath $ExePath -WorkingDirectory $AppDir
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
