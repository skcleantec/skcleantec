"""예외·네이티브 오류를 launch.log(UTF-8)에 남긴다."""
from __future__ import annotations

import faulthandler
import sys
import threading
import traceback

from desktop.config import APP_DATA_DIR, append_launch_log, ensure_app_data

_file = None


def install_fault_hooks() -> None:
    global _file
    ensure_app_data()
    path = APP_DATA_DIR / 'launch.log'
    _file = path.open('a', encoding='utf-8', errors='replace')
    faulthandler.enable(_file, all_threads=True)

    def _hook(exc_type, exc, tb) -> None:
        text = ''.join(traceback.format_exception(exc_type, exc, tb))
        append_launch_log('처리되지 않은 오류\n' + text)
        if _file is not None:
            _file.write(text)
            _file.flush()

    sys.excepthook = _hook

    def _thread_hook(args: threading.ExceptHookArgs) -> None:
        text = ''.join(
            traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback)
        )
        name = getattr(args.thread, 'name', '')
        append_launch_log(f'스레드 오류 ({name})\n' + text)
        if _file is not None:
            _file.write(text)
            _file.flush()

    threading.excepthook = _thread_hook


def log_exception(where: str) -> None:
    text = traceback.format_exc()
    append_launch_log(f'{where}\n{text}')
    if _file is not None:
        _file.write(text)
        _file.flush()
