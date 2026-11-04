"""설치 전 PC 점검. 가상화 켜기는 사용자가 버튼을 눌렀을 때만 관리자 권한을 쓴다."""
from __future__ import annotations

import ctypes
import shutil
import subprocess
from dataclasses import dataclass

_BIOS_HINTS: tuple[tuple[str, str, str, str], ...] = (
    ('dell', 'Dell', 'F2', 'Virtualization'),
    ('hewlett', 'HP', 'F10', 'Virtualization Technology'),
    ('hp', 'HP', 'F10', 'Virtualization Technology'),
    ('lenovo', 'Lenovo', 'F1', 'Intel Virtualization Technology 또는 SVM Mode'),
    ('asus', 'ASUS', 'F2', 'Intel Virtualization Technology'),
    ('acer', 'Acer', 'F2', 'Intel Virtualization Technology'),
    ('samsung', 'Samsung', 'F2', 'SVM Mode 또는 Intel Virtualization Technology'),
    ('msi', 'MSI', 'Delete', 'Intel Virtualization Technology 또는 SVM Mode'),
    ('gigabyte', 'Gigabyte', 'Delete', 'Intel Virtualization Technology 또는 SVM Mode'),
)


@dataclass
class PcCheck:
    ram_gb: float
    ram_ok: bool
    ram_recommended: bool
    disk_free_gb: float
    disk_ok: bool
    virtualization_on: bool | None
    hypervisor_on: bool | None
    hypervisor_present: bool | None
    accel_ok: bool | None
    verdict: str
    bios_message: str
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


def _parse_bool(text: str) -> bool | None:
    lowered = text.strip().lower()
    if lowered == 'true':
        return True
    if lowered == 'false':
        return False
    return None


def virtualization_enabled() -> bool | None:
    text = _powershell(
        '(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty VirtualizationFirmwareEnabled)'
    )
    return _parse_bool(text)


def hypervisor_present() -> bool | None:
    text = _powershell('(Get-CimInstance Win32_ComputerSystem).HypervisorPresent')
    return _parse_bool(text)


def hypervisor_platform_enabled() -> bool | None:
    text = _powershell(
        "(Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State"
    )
    if 'Enabled' in text:
        return True
    if 'Disabled' in text:
        return False
    return None


def pc_manufacturer() -> str:
    return _powershell('(Get-CimInstance Win32_ComputerSystem).Manufacturer')


def accel_check() -> bool | None:
    """emulator -accel-check. 실행 파일이 없으면 None."""
    try:
        from bridge_config import resolve_emulator
    except Exception:
        return None
    exe = resolve_emulator()
    if not exe.is_file():
        return None
    try:
        result = subprocess.run(
            [str(exe), '-accel-check'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=25,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    output = f'{result.stdout or ""}\n{result.stderr or ""}'.lower()
    if result.returncode == 0 or 'is installed and usable' in output:
        return True
    if result.returncode != 0:
        return False
    return None


def classify_virtualization(
    *,
    hypervisor_present_flag: bool | None,
    accel_ok: bool | None,
    platform_on: bool | None,
    firmware_on: bool | None,
) -> str:
    """ok | need_hypervisor | bios_off.

    HypervisorPresent 또는 accel-check 성공이면 통과한다.
    펌웨어 플래그만으로 바이오스 꺼짐이라고 하지 않는다.
    """
    if hypervisor_present_flag is True or accel_ok is True:
        return 'ok'
    if accel_ok is False and platform_on is False:
        return 'need_hypervisor'
    if accel_ok is None and platform_on is False:
        return 'need_hypervisor'
    if firmware_on is False and hypervisor_present_flag is False and accel_ok is not True:
        return 'bios_off'
    if accel_ok is False and hypervisor_present_flag is not True:
        return 'bios_off'
    return 'ok'


def bios_guidance(manufacturer: str) -> str:
    lowered = manufacturer.lower()
    maker, key, menu = 'PC', 'F2 또는 Delete', 'Virtualization Technology 또는 SVM Mode'
    for needle, label, entry_key, menu_name in _BIOS_HINTS:
        if needle in lowered:
            maker, key, menu = label, entry_key, menu_name
            break
    return (
        f'{maker}는 전원을 켠 직후 {key} 키로 바이오스에 들어가 「{menu}」를 켜 주세요.\n'
        '직접 바꾸기 어려우면 관리자에게 원격 지원을 요청해 주세요.\n'
        '설치는 이어서 진행할 수 있습니다.'
    )


def inspect_pc(disk_path: str) -> PcCheck:
    ram = _ram_gb()
    usage = shutil.disk_usage(disk_path)
    free_gb = usage.free / (1024 ** 3)
    present = hypervisor_present()
    platform_on = hypervisor_platform_enabled()
    firmware = virtualization_enabled()
    accel = None if present is True else accel_check()
    verdict = classify_virtualization(
        hypervisor_present_flag=present,
        accel_ok=accel,
        platform_on=platform_on,
        firmware_on=firmware,
    )
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
    guidance = ''
    if verdict == 'ok':
        lines.append('가상폰 가속이 준비되어 있습니다.')
    elif verdict == 'need_hypervisor':
        lines.append('Windows 하이퍼바이저 플랫폼이 꺼져 있습니다. 「켜기」를 누른 뒤 PC를 다시 시작해야 합니다.')
    else:
        guidance = bios_guidance(pc_manufacturer())
        lines.append('CPU 가상화가 바이오스에서 꺼져 있습니다.')
        lines.append(guidance)
    return PcCheck(
        ram_gb=ram,
        ram_ok=ram == 0 or ram >= 8,
        ram_recommended=ram >= 16,
        disk_free_gb=free_gb,
        disk_ok=free_gb >= 10,
        virtualization_on=True if verdict == 'ok' else firmware,
        hypervisor_on=platform_on,
        hypervisor_present=present,
        accel_ok=accel,
        verdict=verdict,
        bios_message=guidance,
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
