"""첫 실행 가상폰 준비. SDK 압축파일은 설치 프로그램에 넣지 않고 그때 받는다."""
from __future__ import annotations

import os
import re
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


def sdk_ready() -> bool:
    """자체 SDK와 CbiseoMiso만 본다. 다른 가상폰이 켜져 있는 것으로 완료하지 않는다."""
    image = SDK_DIR / 'system-images' / 'android-34' / 'google_apis_playstore' / 'x86_64'
    avd = Path.home() / '.android' / 'avd' / f'{AVD_NAME}.avd' / 'config.ini'
    return (
        (SDK_DIR / 'emulator' / 'emulator.exe').is_file()
        and (SDK_DIR / 'platform-tools' / 'adb.exe').is_file()
        and ((image / 'system.img').is_file() or (image / 'source.properties').is_file())
        and avd.is_file()
    )


def setup_needs_resume() -> bool:
    if sdk_ready() and _state().get('boot'):
        return False
    if _state():
        return True
    return SDK_DIR.is_dir() and any(SDK_DIR.iterdir())


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


_LICENSE_DROP = re.compile(
    r'^(?:Accept\?|Review licenses|All SDK package licenses|Warning:|Info:|Loading |Downloading )',
    re.IGNORECASE,
)
_PERCENT_RE = re.compile(r'(\d{1,3})\s*%')


def clean_license_text(raw: str) -> str:
    """콘솔 진행 문구를 빼고 약관 본문만 남긴다."""
    kept: list[str] = []
    for line in (raw or '').splitlines():
        stripped = line.strip()
        if not stripped or _LICENSE_DROP.match(stripped) or _PERCENT_RE.fullmatch(stripped):
            continue
        if stripped.endswith('%') and _PERCENT_RE.search(stripped) and len(stripped) < 40:
            continue
        kept.append(line.rstrip())
    text = '\n'.join(kept).strip()
    return text


def license_text() -> str:
    ensure_java(lambda _text, _value: None)
    if not _sdkmanager().is_file():
        return ''
    result = _run([str(_sdkmanager()), f'--sdk_root={SDK_DIR}', '--licenses'], stdin='\n', timeout=60)
    return clean_license_text((result.stdout or '') + '\n' + (result.stderr or ''))


def _run_watching_percent(
    args: list[str],
    *,
    stdin: str | None,
    timeout: float,
    progress: Progress,
    label: str,
    start: float,
    end: float,
) -> subprocess.CompletedProcess[str]:
    proc = subprocess.Popen(
        args,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=_env(),
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )
    if proc.stdin is not None:
        if stdin:
            proc.stdin.write(stdin)
        proc.stdin.close()
    chunks: list[str] = []
    assert proc.stdout is not None
    try:
        for line in proc.stdout:
            chunks.append(line)
            match = _PERCENT_RE.search(line)
            if not match:
                continue
            pct = max(0, min(100, int(match.group(1))))
            progress(label, start + (end - start) * (pct / 100))
        code = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        code = 1
    output = ''.join(chunks)
    return subprocess.CompletedProcess(args, code, output, '')


def accept_licenses(progress: Progress) -> None:
    ensure_java(progress)
    if _state().get('licenses'):
        progress('사용 약관 동의가 이미 되어 있습니다.', 0.22)
        return
    progress('사용 약관을 적용하는 중…', 0.2)
    yes = 'y\n' * 80
    result = _run_watching_percent(
        [str(_sdkmanager()), f'--sdk_root={SDK_DIR}', '--licenses'],
        stdin=yes,
        timeout=180,
        progress=progress,
        label='사용 약관을 적용하는 중…',
        start=0.2,
        end=0.26,
    )
    output = result.stdout or ''
    if result.returncode not in (0, None) and 'Accept' in output:
        from desktop.config import append_tray_event

        append_tray_event('사용 약관 적용 실패')
        raise RuntimeError('사용 약관 동의에 실패했습니다. 다시 실행하면 이어서 진행합니다.')
    _mark('licenses')
    progress('사용 약관 동의를 마쳤습니다.', 0.26)


def install_packages(progress: Progress) -> None:
    image_dir = SDK_DIR / 'system-images' / 'android-34' / 'google_apis_playstore' / 'x86_64'
    image_ready = (image_dir / 'system.img').is_file() or (image_dir / 'source.properties').is_file()
    if (
        (SDK_DIR / 'emulator' / 'emulator.exe').is_file()
        and (SDK_DIR / 'platform-tools' / 'adb.exe').is_file()
        and image_ready
    ):
        progress('가상폰 구성 요소가 이미 있습니다.', 0.55)
        return
    if 'ps16k' in SYSTEM_IMAGE or '16kb' in SYSTEM_IMAGE.lower():
        raise RuntimeError('16KB 이미지는 사용하지 않습니다.')
    progress('가상폰 구성 요소를 받는 중…', 0.28)
    packages = ['platform-tools', 'emulator', SYSTEM_IMAGE]
    result = _run_watching_percent(
        [str(_sdkmanager()), f'--sdk_root={SDK_DIR}', *packages],
        stdin='y\n',
        timeout=3600,
        progress=progress,
        label='가상폰 구성 요소를 받는 중…',
        start=0.28,
        end=0.58,
    )
    if result.returncode != 0 or not (
        (image_dir / 'system.img').is_file() or (image_dir / 'source.properties').is_file()
    ):
        from desktop.config import append_tray_event

        append_tray_event('가상폰 구성 요소를 받지 못했습니다.')
        raise RuntimeError('가상폰 구성 요소를 받지 못했습니다. 다시 실행하면 이어서 진행합니다.')
    _mark('packages')
    progress('가상폰 구성 요소 받기가 끝났습니다.', 0.6)


def create_avd(progress: Progress) -> None:
    home = Path.home() / '.android' / 'avd' / f'{AVD_NAME}.avd' / 'config.ini'
    if home.is_file() and sdk_ready():
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
    if _state().get('boot') and sdk_ready():
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
