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

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

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
            phase     = $Phase
            message   = $Message
            updatedAt = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
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

function New-UpdateProgressForm {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = '숨고 채팅 자동화 — 업데이트 중'
    $form.Size = New-Object System.Drawing.Size(460, 170)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.ShowInTaskbar = $true

    $title = New-Object System.Windows.Forms.Label
    $title.AutoSize = $true
    $title.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $title.Location = New-Object System.Drawing.Point(20, 16)
    $title.Text = '업데이트 적용 중…'
    $form.Controls.Add($title)

    $status = New-Object System.Windows.Forms.Label
    $status.AutoSize = $true
    $status.Location = New-Object System.Drawing.Point(20, 48)
    $status.Text = '프로그램 종료 대기…'
    $form.Controls.Add($status)

    $percent = New-Object System.Windows.Forms.Label
    $percent.AutoSize = $true
    $percent.Location = New-Object System.Drawing.Point(380, 48)
    $percent.Text = '10%'
    $form.Controls.Add($percent)

    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Location = New-Object System.Drawing.Point(20, 82)
    $bar.Size = New-Object System.Drawing.Size(410, 22)
    $bar.Style = 'Continuous'
    $bar.Minimum = 0
    $bar.Maximum = 100
    $bar.Value = 10
    $form.Controls.Add($bar)

    $form.Add_Shown({ $form.Activate() })
    $form.Show() | Out-Null
    [System.Windows.Forms.Application]::DoEvents()

    return @{
        Form    = $form
        Status  = $status
        Percent = $percent
        Bar     = $bar
    }
}

function Set-UpdateProgressUi($Ui, [int]$Value, [string]$Message) {
    if (-not $Ui) { return }
    $Ui.Status.Text = $Message
    $Ui.Percent.Text = "$Value%"
    $Ui.Bar.Value = [Math]::Max(0, [Math]::Min(100, $Value))
    [System.Windows.Forms.Application]::DoEvents()
}

function Close-UpdateProgressUi($Ui) {
    if (-not $Ui) { return }
    try { $Ui.Form.Close() } catch { }
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
            $procId = [int]$_.ProcessId
            if ($procId -eq $TargetProcessId) { return }
            if ($cmd -and ($cmd -like "*$Dir*")) {
                Write-UpdateLog "잔존 프로세스 종료: $name (PID $procId)"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Milliseconds 800
}

$ui = $null
try {
    $ui = New-UpdateProgressForm
    Set-UpdateProgressUi $ui 10 '프로그램 종료 대기…'
    Write-UpdateLog '=== 업데이트 시작 ==='
    Write-UpdateLog "ZipPath=$ZipPath AppDir=$AppDir ExePath=$ExePath TargetProcessId=$TargetProcessId"
    Write-UpdateState 'installing' '업데이트 파일 교체 중…'

    Wait-TargetProcessExit -ProcessId $TargetProcessId
    Set-UpdateProgressUi $ui 25 '브라우저·잔존 프로세스 정리…'
    Stop-StaleAutomationProcesses -Dir $AppDir

    if (-not (Test-Path -LiteralPath $ZipPath)) {
        throw "ZIP 없음: $ZipPath"
    }

    Set-UpdateProgressUi $ui 40 '업데이트 파일 압축 해제…'
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

        Set-UpdateProgressUi $ui 70 '프로그램 파일 교체 중…'
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

        Set-UpdateProgressUi $ui 95 '프로그램 다시 시작…'
        Write-UpdateState 'idle' '업데이트 완료 — 재시작'
        Write-UpdateLog "재시작: $ExePath"
        Start-Process -FilePath $ExePath -WorkingDirectory $AppDir
        Set-UpdateProgressUi $ui 100 '업데이트 완료!'
        Start-Sleep -Milliseconds 700
        Write-UpdateLog '=== 업데이트 성공 ==='
    }
    finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
catch {
    Close-UpdateProgressUi $ui
    Show-UpdateError ($_.Exception.Message)
    exit 1
}
finally {
    Close-UpdateProgressUi $ui
}
