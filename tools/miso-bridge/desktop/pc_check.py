"""설치 전 PC 점검. 가상화 켜기는 사용자가 버튼을 눌렀을 때만 관리자 권한을 쓴다."""
from __future__ import annotations

import ctypes
import shutil
import subprocess
from dataclasses import dataclass


@dataclass
class PcCheck:
    ram_gb: float
    ram_ok: bool
    ram_recommended: bool
    disk_free_gb: float
    disk_ok: bool
    virtualization_on: bool | None
    hypervisor_on: bool | None
    message: str


def _ram_gb() -> float:
    if not hasattr(ctypes, 'windll'):
        return 0
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ('dwLength', ctypes.c_ulong),
            ('dwMemoryLoad', ctypes.c_ulong),
            ('ullTotalPhys', ctypes.c_ulonglong),
            ('ullAvailPhys', ctypes.c_ulonglong),
            ('ullTotalPageFile', ctypes.c_ulonglong),
            ('ullAvailPageFile', ctypes.c_ulonglong),
            ('ullTotalVirtual', ctypes.c_ulonglong),
            ('ullAvailVirtual', ctypes.c_ulonglong),
            ('ullAvailExtendedVirtual', ctypes.c_ulonglong),
        ]

    stat = MEMORYSTATUSEX()
    stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
    return stat.ullTotalPhys / (1024 ** 3)


def _powershell(script: str) -> str:
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', script],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=40,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return ''
    return (result.stdout or '').strip()


def virtualization_enabled() -> bool | None:
    text = _powershell('(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty VirtualizationFirmwareEnabled)')
    lowered = text.lower()
    if lowered == 'true':
        return True
    if lowered == 'false':
        return False
    return None


def hypervisor_platform_enabled() -> bool | None:
    text = _powershell(
        "(Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State"
    )
    if 'Enabled' in text:
        return True
    if 'Disabled' in text:
        return False
    return None


def inspect_pc(disk_path: str) -> PcCheck:
    ram = _ram_gb()
    usage = shutil.disk_usage(disk_path)
    free_gb = usage.free / (1024 ** 3)
    virt = virtualization_enabled()
    hyper = hypervisor_platform_enabled()
    lines: list[str] = []
    if ram and ram < 8:
        lines.append(f'메모리가 {ram:.0f}GB입니다. 8GB 미만이면 가상폰이 느릴 수 있습니다. 16GB를 권장합니다.')
    elif ram and ram < 16:
        lines.append(f'메모리는 {ram:.0f}GB입니다. 가상폰은 16GB를 권장합니다.')
    else:
        lines.append(f'메모리 {ram:.0f}GB')
    if free_gb < 10:
        lines.append(f'디스크 여유 공간이 {free_gb:.1f}GB입니다. 10GB 이상이 필요합니다.')
    else:
        lines.append(f'디스크 여유 {free_gb:.1f}GB')
    if virt is False:
        lines.append('CPU 가상화가 꺼져 있습니다. PC 바이오스에서 가상화를 켠 뒤 다시 시작해 주세요.')
    elif virt is True:
        lines.append('CPU 가상화가 켜져 있습니다.')
    if hyper is False:
        lines.append('Windows 하이퍼바이저 플랫폼이 꺼져 있습니다. 「켜기」를 누른 뒤 PC를 다시 시작해야 합니다.')
    elif hyper is True:
        lines.append('Windows 하이퍼바이저 플랫폼이 켜져 있습니다.')
    return PcCheck(
        ram_gb=ram,
        ram_ok=ram == 0 or ram >= 8,
        ram_recommended=ram >= 16,
        disk_free_gb=free_gb,
        disk_ok=free_gb >= 10,
        virtualization_on=virt,
        hypervisor_on=hyper,
        message='\n'.join(lines),
    )


def enable_hypervisor_platform() -> tuple[bool, str]:
    """관리자 권한 창을 띄워 하이퍼바이저 플랫폼만 켠다."""
    from desktop.config import APP_DATA_DIR, ensure_app_data

    ensure_app_data()
    script_path = APP_DATA_DIR / 'enable-hypervisor.ps1'
    script_path.write_text(
        'Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart\n',
        encoding='utf-8',
    )
    command = (
        "Start-Process powershell -Verb RunAs -Wait -ArgumentList "
        f"'-NoProfile','-ExecutionPolicy','Bypass','-File','{script_path}'"
    )
    try:
        proc = subprocess.Popen(
            ['powershell', '-NoProfile', '-Command', command],
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        proc.wait(timeout=180)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f'가상화 기능을 켜지 못했습니다. ({exc})'
    if hypervisor_platform_enabled() is True:
        return True, '가상화 기능을 켰습니다. PC를 다시 시작한 뒤 이 프로그램을 다시 실행하면 이어서 진행합니다.'
    return False, '가상화 기능을 켜지 못했습니다. 관리자 권한 창에서 허용했는지 확인해 주세요.'
