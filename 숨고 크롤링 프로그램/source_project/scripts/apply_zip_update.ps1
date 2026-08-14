#Requires -Version 5.1
<#
  SoomgoAutomation ZIP 자동 업데이트 — 메인 EXE 종료 후 파일 교체·재시작
#>
param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [Parameter(Mandatory = $true)][string]$AppDir,
    [Parameter(Mandatory = $true)][string]$ExePath,
    [int]$TargetProcessId = 0,
    [int]$WaitPid = 0,
    [string]$StatePath = '',
    [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'

if ($TargetProcessId -le 0 -and $WaitPid -gt 0) {
    $TargetProcessId = $WaitPid
}
if ($TargetProcessId -le 0) {
    throw 'TargetProcessId(또는 WaitPid)가 필요합니다.'
}

Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

function Write-UpdateLog([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    if ($LogPath) {
        try {
            $dir = Split-Path -Parent $LogPath
            if ($dir -and -not (Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
        } catch { }
    }
}

function Write-UpdateState([string]$Phase, [string]$Message) {
    if (-not $StatePath) { return }
    try {
        $dir = Split-Path -Parent $StatePath
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        $payload = @{
            phase       = $Phase
            message     = $Message
            updatedAt   = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
        }
        ($payload | ConvertTo-Json -Compress) | Set-Content -LiteralPath $StatePath -Encoding UTF8
    } catch { }
}

function Show-UpdateError([string]$Message) {
    Write-UpdateLog "ERROR: $Message"
    Write-UpdateState 'failed' $Message
    try {
        [System.Windows.Forms.MessageBox]::Show(
            "$Message`n`n자세한 내용: $LogPath",
            '숨고 채팅 자동화 — 업데이트 실패',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    } catch {
        Write-Host $Message
    }
}

function Wait-TargetProcessExit([int]$ProcessId, [int]$TimeoutSec = 180) {
    Write-UpdateLog "PID $ProcessId 종료 대기 시작"
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $proc) {
            Write-UpdateLog "PID $ProcessId 종료 확인"
            return
        }
        Start-Sleep -Milliseconds 400
    }
    throw "PID $ProcessId 종료 대기 시간 초과 ($TimeoutSec 초)"
}

function Stop-StaleAutomationProcesses([string]$Dir) {
    foreach ($name in @('chromedriver.exe', 'SoomgoAutomation.exe')) {
        Get-CimInstance Win32_Process -Filter "name='$name'" -ErrorAction SilentlyContinue | ForEach-Object {
            $cmd = [string]$_.CommandLine
            $pid = [int]$_.ProcessId
            if ($pid -eq $TargetProcessId) { return }
            if ($cmd -and ($cmd -like "*$Dir*")) {
                Write-UpdateLog "잔존 프로세스 종료: $name (PID $pid)"
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Milliseconds 800
}

try {
    $host.UI.RawUI.WindowTitle = '숨고 채팅 자동화 — 업데이트 적용 중…'
    Write-UpdateLog "=== 업데이트 시작 ==="
    Write-UpdateLog "ZipPath=$ZipPath"
    Write-UpdateLog "AppDir=$AppDir"
    Write-UpdateLog "ExePath=$ExePath"
    Write-UpdateLog "TargetProcessId=$TargetProcessId"
    Write-UpdateState 'installing' '업데이트 파일 교체 중…'

    Wait-TargetProcessExit -ProcessId $TargetProcessId
    Stop-StaleAutomationProcesses -Dir $AppDir

    if (-not (Test-Path -LiteralPath $ZipPath)) {
        throw "ZIP 없음: $ZipPath"
    }

    $tempRoot = Join-Path $env:TEMP ("SoomgoAutomation-update-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    Write-UpdateLog "ZIP 압축 해제: $tempRoot"

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

        Write-UpdateLog 'robocopy 파일 교체 시작'
        & robocopy $payloadRoot $AppDir /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /R:3 /W:3 | Out-Null
        $rc = $LASTEXITCODE
        Write-UpdateLog "robocopy exit=$rc"
        if ($rc -ge 8) {
            throw "robocopy 실패 (exit=$rc)"
        }

        if (-not (Test-Path -LiteralPath $ExePath)) {
            throw "실행 파일 없음: $ExePath"
        }

        Write-UpdateState 'idle' '업데이트 완료 — 재시작'
        Write-UpdateLog "재시작: $ExePath"
        Start-Process -FilePath $ExePath -WorkingDirectory $AppDir
        Write-UpdateLog '=== 업데이트 성공 ==='
    }
    finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
catch {
    Show-UpdateError ($_.Exception.Message)
    exit 1
}
