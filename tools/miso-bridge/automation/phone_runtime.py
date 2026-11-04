"""가상폰 시간대·그래픽·사양·부팅 직후 대기."""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

from automation.adb_client import list_devices, shell
from automation.device_locale import app_data_dir
from bridge_config import MISO_AVD

SEOUL = 'Asia/Seoul'
GPU_AUTO = 'auto'
GPU_SWIFT = 'swiftshader_indirect'
WARMUP_SEC = 5 * 60
ANR_BUSY_AFTER = 3
_ANR_WINDOW_SEC = 10 * 60


def _config_path() -> Path:
    return app_data_dir() / 'config.json'


def _load_config() -> dict:
    path = _config_path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_config(data: dict) -> None:
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def gpu_mode() -> str:
    mode = str(_load_config().get('gpuMode') or '').strip()
    if mode == GPU_SWIFT:
        return GPU_SWIFT
    return GPU_AUTO


def remember_gpu(mode: str, reason: str = '') -> None:
    data = _load_config()
    data['gpuMode'] = mode
    if reason:
        data['gpuFallbackReason'] = reason
    elif mode == GPU_AUTO:
        data.pop('gpuFallbackReason', None)
    _save_config(data)


def avd_config_path() -> Path:
    return Path.home() / '.android' / 'avd' / f'{MISO_AVD}.avd' / 'config.ini'


def patch_avd_spec() -> None:
    """이미 만든 가상폰에도 RAM·코어·빠른 부팅·그래픽을 반영한다."""
    path = avd_config_path()
    if not path.is_file():
        return
    text = path.read_text(encoding='utf-8', errors='replace')
    updates = {
        'hw.ramSize': '4096',
        'hw.cpu.ncore': '4',
        'hw.keyboard': 'yes',
        'hw.gpu.enabled': 'yes',
        'hw.gpu.mode': gpu_mode(),
        'fastboot.forceColdBoot': 'no',
        'fastboot.forceFastBoot': 'yes',
        'showDeviceFrame': 'no',
    }
    lines = text.splitlines()
    keys = set(updates)
    kept = [line for line in lines if line.split('=', 1)[0] not in keys]
    kept.extend(f'{key}={value}' for key, value in updates.items())
    path.write_text('\n'.join(kept) + '\n', encoding='utf-8')


def timezone_args() -> list[str]:
    return ['-timezone', SEOUL]


def gpu_args() -> list[str]:
    return ['-gpu', gpu_mode()]


def read_timezone(serial: str) -> str:
    try:
        return shell(serial, 'getprop persist.sys.timezone', timeout=8).strip()
    except (RuntimeError, OSError):
        return ''


def _clock_text(serial: str) -> str:
    try:
        return shell(serial, 'date', timeout=8)
    except (RuntimeError, OSError):
        return ''


def clock_is_seoul(serial: str) -> bool:
    if read_timezone(serial) != SEOUL:
        return False
    text = _clock_text(serial)
    return 'KST' in text or '+0900' in text or 'GMT+9' in text


def apply_timezone_now(serial: str) -> None:
    for cmd in (
        f'setprop persist.sys.timezone {SEOUL}',
        f'settings put global time_zone {SEOUL}',
        f'service call alarm 3 s16 {SEOUL}',
        f'cmd alarm set-time-zone {SEOUL}',
    ):
        try:
            shell(serial, cmd, timeout=8)
        except (RuntimeError, OSError):
            continue


def _warmup_path() -> Path:
    return app_data_dir() / 'warmup-until.txt'


def stamp_warmup() -> None:
    path = _warmup_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(time.time() + WARMUP_SEC), encoding='utf-8')


def in_warmup() -> bool:
    path = _warmup_path()
    if not path.is_file():
        return False
    try:
        until = float(path.read_text(encoding='utf-8').strip())
    except (OSError, ValueError):
        return False
    return time.time() < until


def _anr_path() -> Path:
    return app_data_dir() / 'anr-wait.json'


def note_anr_wait() -> int:
    now = time.time()
    path = _anr_path()
    count = 0
    last = 0.0
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            count = int(data.get('count') or 0)
            last = float(data.get('last') or 0)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            count = 0
    if now - last > _ANR_WINDOW_SEC:
        count = 1
    else:
        count += 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'count': count, 'last': now}), encoding='utf-8')
    return count


def anr_wait_count() -> int:
    path = _anr_path()
    if not path.is_file():
        return 0
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        last = float(data.get('last') or 0)
        if time.time() - last > _ANR_WINDOW_SEC:
            return 0
        return int(data.get('count') or 0)
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return 0


def phone_is_busy() -> bool:
    return anr_wait_count() > ANR_BUSY_AFTER


def install_screen_blocked_message() -> str | None:
    if phone_is_busy():
        return '가상폰이 아직 바빠요, 잠시 뒤 다시 확인'
    if in_warmup():
        return '가상폰 준비 중'
    return None


def _emulator_cmdline() -> str:
    try:
        proc = subprocess.run(
            [
                'powershell',
                '-NoProfile',
                '-Command',
                "Get-CimInstance Win32_Process -Filter \"Name='emulator.exe'\" | Select-Object -ExpandProperty CommandLine",
            ],
            capture_output=True,
            text=True,
            timeout=15,
            encoding='utf-8',
            errors='replace',
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return ''
    return proc.stdout or ''


def cmdline_gpu(text: str | None = None) -> str:
    raw = text if text is not None else _emulator_cmdline()
    parts = raw.replace('\r', ' ').replace('\n', ' ').split()
    if '-gpu' not in parts:
        return ''
    index = parts.index('-gpu')
    if index + 1 >= len(parts):
        return ''
    return parts[index + 1]


def _relaunched_path() -> Path:
    return app_data_dir() / 'runtime-relaunch.tried'


def _mark_relaunched() -> None:
    path = _relaunched_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('1', encoding='utf-8')


def _already_relaunched() -> bool:
    return _relaunched_path().is_file()


def _clear_relaunched() -> None:
    try:
        _relaunched_path().unlink(missing_ok=True)
    except OSError:
        pass


def _our_online_serial() -> str | None:
    from automation.emulator_launcher import our_emulator_serial

    return our_emulator_serial()


def _wait_online(timeout: float) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        serial = _our_online_serial()
        if serial:
            try:
                if shell(serial, 'getprop sys.boot_completed', timeout=8).strip() == '1':
                    return serial
            except (RuntimeError, OSError):
                pass
        time.sleep(3)
    return None


def _offline_streak(samples: int = 3) -> bool:
    streak = 0
    for _ in range(samples):
        states = [
            device.state
            for device in list_devices()
            if device.serial.startswith('emulator-')
        ]
        if states and all(state == 'offline' for state in states):
            streak += 1
        else:
            streak = 0
        if streak >= samples:
            return True
        time.sleep(3)
    return False


def _profile_matches(serial: str) -> bool:
    gpu = cmdline_gpu()
    if gpu and gpu != gpu_mode():
        return False
    return clock_is_seoul(serial)


def ensure_clock_and_gpu() -> None:
    """시간대가 한국이 아니거나 그래픽이 기록과 다르면 한 번만 다시 켠다."""
    try:
        from automation.chat_list import is_automation_active

        if is_automation_active():
            return
    except Exception:
        pass
    serial = _our_online_serial() or _wait_online(20)
    if serial:
        apply_timezone_now(serial)
        if _profile_matches(serial):
            if gpu_mode() == GPU_AUTO:
                remember_gpu(GPU_AUTO)
            _clear_relaunched()
            return
    if not serial and _emulator_cmdline() and not _offline_streak():
        return
    if _already_relaunched():
        if serial:
            apply_timezone_now(serial)
        return
    from automation.emulator_launcher import launch_our_emulator

    _mark_relaunched()
    patch_avd_spec()
    if serial:
        from automation.locale_apply import _kill_our_emulator

        if not _kill_our_emulator(serial):
            return
    if not launch_our_emulator():
        return
    serial = _wait_online(150)
    if not serial and gpu_mode() == GPU_AUTO:
        remember_gpu(GPU_SWIFT, 'adb offline')
        patch_avd_spec()
        launch_our_emulator()
        serial = _wait_online(120)
    elif serial and gpu_mode() == GPU_AUTO:
        remember_gpu(GPU_AUTO)
    if serial:
        apply_timezone_now(serial)
        if clock_is_seoul(serial):
            _clear_relaunched()
