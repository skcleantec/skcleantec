# 포트 3000 LISTEN 중인 프로세스 종료 (Express API)
$ErrorActionPreference = 'SilentlyContinue'
$pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
  $pids | ForEach-Object {
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }
  Write-Host '포트 3000 프로세스를 종료했습니다.'
} else {
  Write-Host '3000번 포트를 듣는 프로세스가 없습니다.'
}
