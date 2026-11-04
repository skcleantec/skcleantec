"""상태 창. 다른 스레드는 큐에만 넣고, 창은 메인 루프 pump()에서만 다룬다."""
from __future__ import annotations

import queue
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
    'locale_pending': '가상폰을 한국어로 바꾸는 중',
    'warming': '가상폰 준비 중',
    'phone_busy': '가상폰이 아직 바빠요, 잠시 뒤 다시 확인',
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
    elif stage == 'locale_pending':
        phone = '한국어로 바꾸는 중'
    elif stage == 'warming':
        phone = '준비 중'
    elif stage == 'phone_busy':
        phone = '아직 바쁨'
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
        self._guide: tk.StringVar | None = None
        self._lines: dict[str, tk.StringVar] = {}
        self._on_restart_phone: Callable[[], None] | None = None
        self._on_install: Callable[[], None] | None = None
        self._on_logs: Callable[[], None] | None = None
        self._requests: queue.Queue[tuple[str, dict | None]] = queue.Queue()
        self._last_fetch = 0.0
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
        self._requests.put(('show', None))

    def update_status(self, data: dict | None) -> None:
        self._requests.put(('status', data if isinstance(data, dict) else None))

    def _open(self) -> None:
        if self._root is not None:
            self._raise()
            return
        root = tk.Tk()
        self._root = root
        self._guide = tk.StringVar(master=root, value='상태를 확인하는 중입니다.')
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
            var = tk.StringVar(master=root, value=f'{title}: 확인 중')
            self._lines[key] = var
            tk.Label(frame, textvariable=var, anchor='w').pack(fill='x', pady=2)
        row = tk.Frame(frame)
        row.pack(fill='x', pady=16)
        tk.Button(row, text='가상폰 화면 보기', command=self._show_phone).pack(fill='x', pady=2)
        tk.Button(row, text='가상폰 다시 켜기', command=lambda: self._on_restart_phone and self._on_restart_phone()).pack(fill='x', pady=2)
        tk.Button(row, text='미소 설치 화면 열기', command=lambda: self._on_install and self._on_install()).pack(fill='x', pady=2)
        tk.Button(row, text='로그 보내기', command=lambda: self._on_logs and self._on_logs()).pack(fill='x', pady=2)
        root.protocol('WM_DELETE_WINDOW', root.withdraw)

    def _raise(self) -> None:
        if self._root is None:
            return
        self._root.deiconify()
        self._root.lift()

    def _show_phone(self) -> None:
        ok, message = bring_emulator_to_front()
        if not ok and self._guide is not None:
            self._guide.set(message)

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
        self.update_status(data)

    def _apply_status(self, data: dict | None) -> None:
        if self._root is None:
            self._latest = data
            return
        self._latest = data
        guide, phone, miso, login, crm = describe_status(data)
        if self._guide is None:
            return
        self._guide.set(guide)
        if self._lines:
            self._lines['phone'].set(phone)
            self._lines['miso'].set(miso)
            self._lines['login'].set(login)
            self._lines['crm'].set(crm)

    def _drain(self) -> None:
        while True:
            try:
                kind, payload = self._requests.get_nowait()
            except queue.Empty:
                return
            if kind == 'show':
                self._open()
            elif kind == 'status':
                self._apply_status(payload)

    def pump(self) -> None:
        self._drain()
        root = self._root
        if root is None:
            return
        now = time.monotonic()
        if now - self._last_fetch >= _POLL_SEC:
            self._last_fetch = now
            threading.Thread(target=self._fetch, daemon=True).start()
        try:
            root.update()
        except tk.TclError:
            self._root = None
