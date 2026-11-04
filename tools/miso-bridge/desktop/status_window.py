"""상태 창. /status는 백그라운드에서만 읽고, 글자는 메인 루프 after()에서 바꾼다."""
from __future__ import annotations

import threading
import time
import tkinter as tk
from collections.abc import Callable

import requests

from desktop.config import BRIDGE_STATUS_URL
from desktop.emulator_window import bring_emulator_to_front

_POLL_SEC = 4.0

_GUIDE = {
    'no_emulator': '이 PC에서 가상폰을 찾지 못했습니다 → 「가상폰 다시 켜기」',
    'emulator_off': '가상폰이 꺼져 있습니다 → 「가상폰 다시 켜기」',
    'booting': '가상폰이 켜지는 중입니다. 잠시만 기다려 주세요.',
    'no_miso': '가상폰에 미소를 설치해 주세요 → 「미소 설치 화면 열기」',
    'miso_logged_out': '미소에 로그인해 주세요 → 「가상폰 화면 보기」',
    'ready': '미소 연동이 준비되었습니다.',
}


def describe_status(data: dict | None) -> tuple[str, str, str, str, str]:
    if not isinstance(data, dict):
        return (
            '연동 프로그램 상태를 읽지 못했습니다.',
            '가상폰: 확인 안 됨',
            '미소: 확인 안 됨',
            '로그인: 확인 전',
            'CRM 연결: CRM 창을 열어 주세요',
        )
    stage = str(data.get('setupStage') or '')
    if stage == 'booting':
        phone = '켜지는 중'
    elif stage in ('no_miso', 'miso_logged_out', 'ready') or data.get('emulatorReady') is True:
        phone = '준비됨' if stage != 'emulator_off' else '꺼짐'
    elif stage == 'no_emulator':
        phone = '없음'
    else:
        phone = '꺼짐'
    if stage == 'emulator_off':
        phone = '꺼짐'
    if stage in ('miso_logged_out', 'ready') or data.get('misoInstalled') is True:
        miso = '설치됨'
    elif stage == 'no_miso' or data.get('misoInstalled') is False:
        miso = '미설치'
    else:
        miso = '확인 안 됨'
    if data.get('misoLoggedIn') is True or stage == 'ready':
        login = '로그인됨'
    elif data.get('misoLoggedIn') is False or stage == 'miso_logged_out':
        login = '로그인 필요'
    else:
        login = '확인 전'
    crm = '연결됨' if data.get('crmConnected') else 'CRM 창을 열어 주세요'
    guide = _GUIDE.get(stage, '상태를 확인하는 중입니다.')
    return guide, f'가상폰: {phone}', f'미소: {miso}', f'로그인: {login}', f'CRM 연결: {crm}'


class StatusWindow:
    def __init__(self) -> None:
        self._root: tk.Tk | None = None
        self._guide = tk.StringVar(value='상태를 확인하는 중입니다.')
        self._lines: dict[str, tk.StringVar] = {}
        self._on_restart_phone: Callable[[], None] | None = None
        self._on_install: Callable[[], None] | None = None
        self._on_logs: Callable[[], None] | None = None
        self._lock = threading.Lock()
        self._pending: dict | None = None
        self._pending_ready = False
        self._last_fetch = 0.0
        self._polling = False
        self._latest: dict | None = None

    def bind_actions(
        self,
        *,
        on_restart_phone: Callable[[], None],
        on_install: Callable[[], None],
        on_logs: Callable[[], None],
    ) -> None:
        self._on_restart_phone = on_restart_phone
        self._on_install = on_install
        self._on_logs = on_logs

    def latest_status(self) -> dict | None:
        return self._latest

    def show(self) -> None:
        if self._root is not None:
            try:
                self._root.after(0, self._raise)
                return
            except tk.TclError:
                self._root = None
                self._polling = False
        root = tk.Tk()
        self._root = root
        root.title('청소비서 미소 연동')
        root.geometry('460x390')
        frame = tk.Frame(root, padx=16, pady=12)
        frame.pack(fill='both', expand=True)
        tk.Label(frame, textvariable=self._guide, justify='left', wraplength=420, anchor='w').pack(fill='x', pady=(0, 8))
        for key, title in (
            ('phone', '가상폰'),
            ('miso', '미소'),
            ('login', '로그인'),
            ('crm', 'CRM 연결'),
        ):
            var = tk.StringVar(value=f'{title}: 확인 중')
            self._lines[key] = var
            tk.Label(frame, textvariable=var, anchor='w').pack(fill='x', pady=2)
        row = tk.Frame(frame)
        row.pack(fill='x', pady=16)
        tk.Button(row, text='가상폰 화면 보기', command=self._show_phone).pack(fill='x', pady=2)
        tk.Button(row, text='가상폰 다시 켜기', command=lambda: self._on_restart_phone and self._on_restart_phone()).pack(fill='x', pady=2)
        tk.Button(row, text='미소 설치 화면 열기', command=lambda: self._on_install and self._on_install()).pack(fill='x', pady=2)
        tk.Button(row, text='로그 보내기', command=lambda: self._on_logs and self._on_logs()).pack(fill='x', pady=2)
        root.protocol('WM_DELETE_WINDOW', root.withdraw)
        self._arm()

    def _raise(self) -> None:
        if self._root is None:
            return
        self._root.deiconify()
        self._root.lift()

    def _show_phone(self) -> None:
        ok, message = bring_emulator_to_front()
        if not ok:
            self._guide.set(message)

    def _arm(self) -> None:
        if self._polling or self._root is None:
            return
        self._polling = True
        self._last_fetch = 0.0
        self._root.after(200, self._tick)

    def _tick(self) -> None:
        root = self._root
        if root is None:
            self._polling = False
            return
        self._apply_pending()
        now = time.monotonic()
        if now - self._last_fetch >= _POLL_SEC:
            self._last_fetch = now
            threading.Thread(target=self._fetch, daemon=True).start()
        try:
            root.after(250, self._tick)
        except tk.TclError:
            self._root = None
            self._polling = False

    def _fetch(self) -> None:
        data: dict | None
        try:
            response = requests.get(
                f'{BRIDGE_STATUS_URL}?lite=1',
                timeout=4,
                headers={'X-Cbiseo-Client': 'tray'},
            )
            body = response.json()
            data = body if isinstance(body, dict) and response.ok else None
        except Exception:
            data = None
        with self._lock:
            self._pending = data
            self._pending_ready = True

    def _apply_pending(self) -> None:
        with self._lock:
            if not self._pending_ready:
                return
            data = self._pending
            self._pending_ready = False
        self._latest = data if isinstance(data, dict) else None
        guide, phone, miso, login, crm = describe_status(data if isinstance(data, dict) else None)
        self._guide.set(guide)
        self._lines['phone'].set(phone)
        self._lines['miso'].set(miso)
        self._lines['login'].set(login)
        self._lines['crm'].set(crm)

    def pump(self) -> None:
        if self._root is None:
            return
        try:
            self._root.update()
        except tk.TclError:
            self._root = None
            self._polling = False
