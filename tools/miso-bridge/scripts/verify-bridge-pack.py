"""미소 연동 설치 패키지 파일·문법 검증."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BRIDGE_ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES: tuple[str, ...] = (
    'server.py',
    'version_info.py',
    'bridge_config.py',
    'emulator-boot-helper.bat',
    'launch-desktop.vbs',
    'launch-desktop.cmd',
    'automation/emulator_launcher.py',
    'desktop/tray_app.py',
    'desktop/setup_wizard.py',
    'desktop/sdk_setup.py',
    'desktop/pc_check.py',
    'desktop/update_manager.py',
    'desktop/manifest_client.py',
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=BRIDGE_ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    missing = [rel for rel in REQUIRED_FILES if not (root / rel).is_file()]
    if missing:
        print('missing files:', ', '.join(missing), file=sys.stderr)
        return 1
    import py_compile

    for rel in REQUIRED_FILES:
        if rel.endswith('.py'):
            py_compile.compile(str(root / rel), doraise=True)
    sys.path.insert(0, str(root))
    from version_info import APP_DISPLAY_NAME, APP_VERSION  # noqa: F401

    if APP_DISPLAY_NAME != '청소비서 미소 연동' or not APP_VERSION:
        raise RuntimeError('version label mismatch')
    print('bridge pack ok')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
