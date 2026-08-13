"""Chrome / chromedriver 진단 — Chrome 업데이트 후 브라우저 시작 실패 점검용."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.browser import (  # noqa: E402
    BrowserManager,
    _find_chrome_binary,
    _invoke_selenium_manager,
    _read_chrome_version,
    _resolve_chromedriver_path,
    _selenium_cache_dir,
)


def main() -> int:
    print('=== 숨고 크롤링 Chrome 진단 ===')
    chrome = _find_chrome_binary()
    print(f'Chrome 경로: {chrome or "(없음)"}')
    info = _read_chrome_version()
    print(f'Chrome 버전: {info[1] if info else "(확인 실패)"}')
    print(f'selenium 캐시: {_selenium_cache_dir()}')

    driver = _resolve_chromedriver_path()
    print(f'chromedriver: {driver or "(없음)"}')
    if not driver:
        driver = _invoke_selenium_manager()
        print(f'selenium-manager 재시도: {driver or "(실패)"}')

    print('\n브라우저 시작 테스트...')
    browser = BrowserManager()
    ok = browser.start()
    print(f'결과: {"성공" if ok else "실패"}')
    if not ok:
        print(browser.last_start_error or '(오류 메시지 없음)')
        return 1
    browser.stop()
    print('정상 종료')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
