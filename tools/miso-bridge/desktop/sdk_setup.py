"""첫 실행 가상폰 준비. SDK 압축파일은 설치 프로그램에 넣지 않고 그때 받는다."""
from __future__ import annotations

import os
import shutil
import subprocess
import urllib.request
import zipfile
from collections.abc import Callable
from pathlib import Path

from desktop.config import (
    APP_DATA_DIR,
    AVD_NAME,
    CMDLINE_TOOLS_URL,
    JRE_DIR,
    SDK_DIR,
    SYSTEM_IMAGE,
    load_setup_state,
    save_setup_state,
)

Progress = Callable[[str, float], None]


def _state() -> dict:
    return load_setup_state()


def _mark(key: str) -> None:
    data = _state()
    data[key] = True
    save_setup_state(data)


def _sdkmanager() -> Path:
    return SDK_DIR / 'cmdline-tools' / 'latest' / 'bin' / 'sdkmanager.bat'


def _avdmanager() -> Path:
    return SDK_DIR / 'cmdline-tools' / 'latest' / 'bin' / 'avdmanager.bat'


def _download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={'User-Agent': 'CbiseoMisoBridge'})
    with urllib.request.urlopen(request, timeout=180) as response, dest.open('wb') as handle:
        shutil.copyfileobj(response, handle)


def _java_exe() -> Path | None:
    bundled = JRE_DIR / 'bin' / 'java.exe'
    if bundled.is_file():
        return bundled
    found = shutil.which('java')
    return Path(found) if found else None


def ensure_java(progress: Progress) -> None:
    if _java_exe():
        return
    progress('Android 도구 실행에 필요한 Java를 받는 중…', 0.04)
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = APP_DATA_DIR / 'jre.zip'
    _download(
        'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk',
        zip_path,
    )
    extract = APP_DATA_DIR / '_jre'
    if extract.exists():
        shutil.rmtree(extract, ignore_errors=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract)
    java = next(extract.rglob('java.exe'), None)
    if java is None:
        raise RuntimeError('Java를 준비하지 못했습니다.')
    home = java.parent.parent
    if JRE_DIR.exists():
        shutil.rmtree(JRE_DIR, ignore_errors=True)
    shutil.move(str(home), str(JRE_DIR))
    shutil.rmtree(extract, ignore_errors=True)
    zip_path.unlink(missing_ok=True)
    if not (JRE_DIR / 'bin' / 'java.exe').is_file():
        raise RuntimeError('Java를 준비하지 못했습니다.')


def _env() -> dict[str, str]:
    env = os.environ.copy()
    env['ANDROID_SDK_ROOT'] = str(SDK_DIR)
    env['ANDROID_HOME'] = str(SDK_DIR)
    java = _java_exe()
    if java is not None:
        env['JAVA_HOME'] = str(java.parent.parent)
        env['PATH'] = str(java.parent) + os.pathsep + env.get('PATH', '')
    return env


def _run(args: list[str], *, stdin: str | None = None, timeout: float = 3600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        input=stdin,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=timeout,
        env=_env(),
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )


def ensure_cmdline_tools(progress: Progress) -> None:
    if _state().get('sdk') and _sdkmanager().is_file():
        progress('Android 도구가 이미 있습니다.', 0.15)
        return
    ensure_java(progress)
    progress('Android 도구를 받는 중…', 0.05)
    SDK_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = SDK_DIR / 'commandlinetools.zip'
    _download(CMDLINE_TOOLS_URL, zip_path)
    progress('Android 도구를 푸는 중…', 0.12)
    extract = SDK_DIR / '_cmdline_extract'
    if extract.exists():
        shutil.rmtree(extract, ignore_errors=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract)
    latest = SDK_DIR / 'cmdline-tools' / 'latest'
    if latest.exists():
        shutil.rmtree(latest, ignore_errors=True)
    latest.parent.mkdir(parents=True, exist_ok=True)
    inner = extract / 'cmdline-tools'
    if not inner.is_dir():
        inner = extract
    shutil.move(str(inner), str(latest))
    shutil.rmtree(extract, ignore_errors=True)
    zip_path.unlink(missing_ok=True)
    if not _sdkmanager().is_file():
        raise RuntimeError('Android 도구를 준비하지 못했습니다.')
    _mark('sdk')
    progress('Android 도구 준비가 끝났습니다.', 0.18)


def license_text() -> str:
    ensure_java(lambda _text, _value: None)
    if not _sdkmanager().is_file():
        return ''
    result = _run([str(_sdkmanager()), f'--sdk_root={SDK_DIR}', '--licenses'], stdin='\n', timeout=60)
    text = (result.stdout or '') + '\n' + (result.stderr or '')
    return text.strip() or 'Android SDK 라이선스에 동의해야 가상폰 도구를 설치할 수 있습니다.'


def accept_licenses(progress: Progress) -> None:
    ensure_java(progress)
    if _state().get('licenses'):
        progress('라이선스 동의가 이미 되어 있습니다.', 0.22)
        return
    progress('라이선스를 적용하는 중…', 0.22)
    yes = 'y\n' * 40
    result = _run([str(_sdkmanager()), f'--sdk_root={SDK_DIR}', '--licenses'], stdin=yes, timeout=180)
    if result.returncode not in (0, None) and 'Accept' in (result.stdout or ''):
        raise RuntimeError('라이선스 동의에 실패했습니다.')
    _mark('licenses')


def install_packages(progress: Progress) -> None:
    image_dir = SDK_DIR / 'system-images' / 'android-34' / 'google_apis_playstore' / 'x86_64'
    if _state().get('packages') and image_dir.is_dir() and (SDK_DIR / 'platform-tools' / 'adb.exe').is_file():
        progress('가상폰 구성 요소가 이미 있습니다.', 0.55)
        return
    if 'ps16k' in SYSTEM_IMAGE or '16kb' in SYSTEM_IMAGE.lower():
        raise RuntimeError('16KB 이미지는 사용하지 않습니다.')
    progress('가상폰 구성 요소를 받는 중… 몇 분 걸릴 수 있습니다.', 0.28)
    packages = ['platform-tools', 'emulator', SYSTEM_IMAGE]
    result = _run(
        [str(_sdkmanager()), f'--sdk_root={SDK_DIR}', *packages],
        stdin='y\n',
        timeout=3600,
    )
    if result.returncode != 0 or not image_dir.is_dir():
        tail = (result.stderr or result.stdout or '').strip().splitlines()
        hint = tail[-1] if tail else '받기 실패'
        raise RuntimeError(f'가상폰 구성 요소를 받지 못했습니다. {hint}')
    _mark('packages')
    progress('가상폰 구성 요소 받기가 끝났습니다.', 0.6)


def create_avd(progress: Progress) -> None:
    home = Path.home() / '.android' / 'avd' / f'{AVD_NAME}.avd' / 'config.ini'
    if _state().get('avd') and home.is_file():
        progress('가상폰이 이미 만들어져 있습니다.', 0.7)
        return
    progress('가상폰을 만드는 중…', 0.62)
    result = _run(
        [
            str(_avdmanager()),
            'create',
            'avd',
            '-n',
            AVD_NAME,
            '-k',
            SYSTEM_IMAGE,
            '-d',
            'pixel_7',
            '--force',
        ],
        stdin='no\n',
        timeout=180,
    )
    if result.returncode != 0 or not home.is_file():
        raise RuntimeError('가상폰을 만들지 못했습니다.')
    text = home.read_text(encoding='utf-8', errors='replace')
    updates = {
        'hw.ramSize': '4096',
        'disk.dataPartition.size': '8192M',
        'hw.keyboard': 'yes',
        'hw.gpu.enabled': 'yes',
        'hw.gpu.mode': 'swiftshader_indirect',
        'showDeviceFrame': 'no',
    }
    lines = text.splitlines()
    keys = set(updates)
    kept = [line for line in lines if line.split('=', 1)[0] not in keys]
    kept.extend(f'{key}={value}' for key, value in updates.items())
    home.write_text('\n'.join(kept) + '\n', encoding='utf-8')
    _mark('avd')
    progress('가상폰을 만들었습니다.', 0.72)


def run_first_boot(progress: Progress) -> None:
    if _state().get('boot'):
        progress('첫 부팅이 이미 끝났습니다.', 0.95)
        return
    from automation.emulator_launcher import start_emulator_detached
    from bridge_config import resolve_adb

    progress('가상폰을 처음 켜는 중…', 0.75)
    ok, message = start_emulator_detached()
    if not ok:
        raise RuntimeError(message)
    helper = Path(__file__).resolve().parents[1] / 'emulator-boot-helper.bat'
    progress('한국어와 화면 설정을 적용하는 중…', 0.82)
    result = subprocess.run(
        ['cmd', '/c', str(helper)],
        timeout=900,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )
    if result.returncode != 0:
        raise RuntimeError('가상폰 첫 설정을 끝내지 못했습니다. 다시 실행하면 이어서 진행합니다.')
    adb = resolve_adb()
    if adb.is_file():
        subprocess.run(
            [str(adb), 'shell', 'locksettings', 'set-disabled', 'true'],
            capture_output=True,
            timeout=30,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    _mark('boot')
    progress('가상폰 첫 설정이 끝났습니다.', 0.95)


def open_play_store_if_needed(progress: Progress) -> str:
    from automation.adb_client import first_online_emulator
    from automation.emulator_launcher import open_miso_install_screen
    from automation.adb_client import is_package_installed

    device = first_online_emulator()
    if device and is_package_installed(device.serial):
        progress('미소 앱이 설치되어 있습니다.', 1)
        return '미소 앱이 이미 설치되어 있습니다.'
    progress('미소 설치 화면을 여는 중…', 0.97)
    ok, message = open_miso_install_screen()
    if not ok:
        return message
    return '구글 로그인 후 「설치」를 눌러 주세요.'
