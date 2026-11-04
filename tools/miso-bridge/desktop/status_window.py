"""상태 창. 다른 스레드는 큐에만 넣고, 창은 메인 루프 pump()에서만 다룬다."""
from __future__ import annotations

import queue
import threading
import time
import tkinter as tk
from collections.abc import Callable
from tkinter import scrolledtext, ttk

import requests

from desktop.config import BRIDGE_STATUS_URL
from desktop.emulator_window import bring_emulator_to_front

_POLL_SEC = 4.0

_GUIDE = {
    'no_emulator': '이 PC에서 가상폰을 찾지 못했습니다.',
    'emulator_off': '가상폰이 꺼져 있습니다.',
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
        self._log: scrolledtext.ScrolledText | None = None

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
        root.geometry('460x520')
        root.minsize(400, 420)
        header = ttk.Label(root, text='청소비서 미소 연동', font=('Segoe UI', 12, 'bold'))
        header.pack(anchor='w', padx=12, pady=(12, 4))
        ttk.Label(root, textvariable=self._guide, wraplength=420).pack(anchor='w', padx=12, pady=4)
        frame = ttk.Frame(root)
        frame.pack(fill='x', padx=12, pady=6)
        for key, title in (
            ('phone', '가상폰'),
            ('miso', '미소'),
            ('login', '로그인'),
            ('crm', 'CRM 연결'),
        ):
            row = ttk.Frame(frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=title, width=14).pack(side='left')
            var = tk.StringVar(master=root, value='확인 중')
            self._lines[key] = var
            ttk.Label(row, textvariable=var).pack(side='left', fill='x', expand=True)
        ttk.Label(root, text='실행 로그', font=('Segoe UI', 9, 'bold')).pack(anchor='w', padx=12, pady=(8, 2))
        self._log = scrolledtext.ScrolledText(
            root,
            height=10,
            wrap='word',
            font=('Consolas', 9),
            state='disabled',
            background='#f8fafc',
            foreground='#334155',
        )
        self._log.pack(fill='both', expand=True, padx=12, pady=(0, 6))
        self._log.tag_config('error', foreground='#b91c1c')
        self._log.tag_config('info', foreground='#334155')
        ttk.Label(
            root,
            text='창을 닫아도 프로그램은 계속 실행됩니다.',
            wraplength=420,
            foreground='#475569',
        ).pack(anchor='w', padx=12, pady=(0, 8))
        buttons = ttk.Frame(root)
        buttons.pack(fill='x', padx=12, pady=(0, 12))
        ttk.Button(buttons, text='가상폰 화면 보기', command=self._show_phone).pack(side='left', padx=(0, 6))
        ttk.Button(buttons, text='미소 설치 화면 열기', command=lambda: self._on_install and self._on_install()).pack(
            side='left', padx=(0, 6)
        )
        ttk.Button(buttons, text='로그 보내기', command=lambda: self._on_logs and self._on_logs()).pack(side='left')
        self._append_log('프로그램을 시작했습니다.')
        root.protocol('WM_DELETE_WINDOW', root.withdraw)
        root.deiconify()
        root.lift()

    def _raise(self) -> None:
        if self._root is None:
            return
        self._root.deiconify()
        self._root.lift()

    def note(self, message: str) -> None:
        self._requests.put(('log', {'text': message}))

    def _append_log(self, message: str) -> None:
        if self._log is None:
            return
        text = (message or '').rstrip()
        if not text:
            return
        tag = 'error' if '실패' in text or '오류' in text else 'info'
        self._log.configure(state='normal')
        self._log.insert('end', text + '\n', tag)
        self._log.see('end')
        self._log.configure(state='disabled')

    def _show_phone(self) -> None:
        ok, message = bring_emulator_to_front(self._root)
        self._append_log(message)
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
            self._lines['phone'].set(phone.removeprefix('가상폰: ').strip())
            self._lines['miso'].set(miso.removeprefix('미소: ').strip())
            self._lines['login'].set(login.removeprefix('로그인: ').strip())
            self._lines['crm'].set(crm.removeprefix('CRM 연결: ').strip())

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
            elif kind == 'log' and isinstance(payload, dict):
                if self._root is None:
                    self._open()
                self._append_log(str(payload.get('text') or ''))

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
