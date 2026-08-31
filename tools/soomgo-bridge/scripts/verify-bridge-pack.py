"""브릿지 설치 패키 import 검증 — 빌드·런타임 공용."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BRIDGE_ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES: tuple[str, ...] = (
    'server.py',
    'bridge_status_extras.py',
    'automation/selectors.py',
    'automation/soomgo_display_name.py',
    'automation/soomgo_text_filters.py',
    'automation/customer_request.py',
    'automation/chat_room.py',
    'automation/chat_list_watcher.py',
    'automation/chat_list_enumerate.py',
    'automation/chat_room_leave.py',
    'automation/chat_room_opened_at.py',
    'automation/preferred_date_parser.py',
    'automation/stale_chat_cleanup.py',
    'automation/overlay_modals.py',
    'automation/navigation.py',
    'automation/browser.py',
    'automation/call_modal.py',
    'automation/login.py',
    'desktop/bridge_pack_integrity.py',
    'desktop/update_manager.py',
)


def missing_files(root: Path) -> list[str]:
    return [rel for rel in REQUIRED_FILES if not (root / rel).is_file()]


def verify_imports(root: Path) -> None:
    import py_compile

    for rel in REQUIRED_FILES:
        if not rel.endswith('.py'):
            continue
        py_compile.compile(str(root / rel), doraise=True)

    # CI·로컬 pre-ZIP 빌드에는 selenium이 없을 수 있음 — 가벼운 모듈만 import 검증.
    sys.path.insert(0, str(root))
    from automation.selectors import SOOMGO_DISPLAY_NAME_JS  # noqa: F401
    from automation.overlay_modals import dismiss_blocking_overlays  # noqa: F401
    from automation.preferred_date_parser import StaleChatVerdict, evaluate_stale_chat  # noqa: F401
    if not SOOMGO_DISPLAY_NAME_JS.strip():
        raise RuntimeError('SOOMGO_DISPLAY_NAME_JS is empty')
    _ = dismiss_blocking_overlays, StaleChatVerdict, evaluate_stale_chat


def main() -> int:
    parser = argparse.ArgumentParser(description='Verify Soomgo bridge pack files and imports')
    parser.add_argument('--root', type=Path, default=BRIDGE_ROOT)
    args = parser.parse_args()
    root = args.root.resolve()

    missing = missing_files(root)
    if missing:
        print('missing files:', ', '.join(missing), file=sys.stderr)
        return 1

    try:
        verify_imports(root)
    except Exception as exc:
        print(f'import verify failed: {exc}', file=sys.stderr)
        return 1

    print('bridge pack ok')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
