"""실행 상태 패널 (tkinter) — Windows: Tk는 전용 스레드에서만 생성·갱신"""
from __future__ import annotations

import queue
import threading
import tkinter as tk
from tkinter import ttk
from typing import Any, Callable

from version_info import APP_DISPLAY_NAME, APP_VERSION, BRIDGE_API_VERSION


class StatusWindow:
    def __init__(self) -> None:
        self._queue: queue.Queue[Callable[[], None]] = queue.Queue()
        self.root: tk.Tk | None = None
        self.status_var: tk.StringVar | None = None
        self.rows: dict[str, tk.StringVar] = {}
        self.hint_var: tk.StringVar | None = None
        self._visible = False
        self._ready = threading.Event()

    def wait_ready(self, timeout: float = 15.0) -> bool:
        return self._ready.wait(timeout=timeout)

    def run_on_ui(self, fn: Callable[[], None]) -> None:
        """Tk 스레드에서 fn 실행 (다른 스레드·pystray 메뉴에서 호출)."""
        if not self._ready.is_set():
            return
        self._queue.put(fn)

    def _process_queue(self) -> None:
        if self.root is None:
            return
        try:
            while True:
                fn = self._queue.get_nowait()
                try:
                    fn()
                except Exception:
                    pass
        except queue.Empty:
            pass
        self.root.after(80, self._process_queue)

    def _build_ui(self) -> None:
        root = tk.Tk()
        self.root = root
        root.title(APP_DISPLAY_NAME)
        root.geometry('420x320')
        root.minsize(360, 280)
        root.protocol('WM_DELETE_WINDOW', self.hide)

        header = ttk.Label(root, text='숨고 브릿지 실행 중', font=('Segoe UI', 12, 'bold'))
        header.pack(anchor='w', padx=12, pady=(12, 4))

        self.status_var = tk.StringVar(value='시작 중…')
        ttk.Label(root, textvariable=self.status_var, wraplength=380).pack(anchor='w', padx=12, pady=4)

        frame = ttk.Frame(root)
        frame.pack(fill='both', expand=True, padx=12, pady=8)

        self.rows = {}
        for key, label in [
            ('app', '프로그램 버전'),
            ('bridge', '브릿지 API'),
            ('browser', 'Chrome'),
            ('login', '숨고 로그인'),
            ('room', '채팅방'),
            ('customer', '고객명'),
        ]:
            row = ttk.Frame(frame)
            row.pack(fill='x', pady=2)
            ttk.Label(row, text=label, width=14).pack(side='left')
            var = tk.StringVar(value='—')
            self.rows[key] = var
            ttk.Label(row, textvariable=var).pack(side='left', fill='x', expand=True)

        self.hint_var = tk.StringVar(value='텔레CRM에서 「숨고 연동」·「정보 갖고오기」를 사용하세요.')
        ttk.Label(root, textvariable=self.hint_var, wraplength=380, foreground='#475569').pack(
            anchor='w', padx=12, pady=(4, 12)
        )

        root.after(80, self._process_queue)
        self._ready.set()

    def hide(self) -> None:
        if self.root:
            self.root.withdraw()
        self._visible = False

    def show(self) -> None:
        def _do() -> None:
            if self.root:
                self.root.deiconify()
                self.root.lift()
            self._visible = True

        self.run_on_ui(_do)

    def update_bridge_status(self, status: dict[str, Any] | None, *, update_hint: str | None = None) -> None:
        if not self.status_var:
            return
        self.rows['app'].set(f'v{APP_VERSION} (API {BRIDGE_API_VERSION})')
        self.rows['bridge'].set('연결됨 · 포트 17890' if status else '응답 없음')
        if not status:
            self.status_var.set('브릿지 엔진 기동 중…')
            return
        self.rows['browser'].set('실행 중' if status.get('browserRunning') else '대기')
        self.rows['login'].set('로그인됨' if status.get('loggedIn') else '미로그인')
        self.rows['room'].set('채팅방' if status.get('inChatRoom') else '목록/기타')
        nick = status.get('nickname')
        self.rows['customer'].set(str(nick) if nick else '—')
        if status.get('lastError'):
            self.status_var.set(str(status['lastError']))
        elif status.get('inChatRoom'):
            self.status_var.set('정상 · 채팅방 연결됨')
        elif status.get('loggedIn'):
            self.status_var.set('정상 · 숨고 로그인됨')
        else:
            self.status_var.set('실행 중 · CRM에서 숨고 연동을 열어 주세요')
        if update_hint and self.hint_var:
            self.hint_var.set(update_hint)

    def update_bridge_status_async(
        self,
        status: dict[str, Any] | None,
        *,
        update_hint: str | None = None,
    ) -> None:
        self.run_on_ui(lambda: self.update_bridge_status(status, update_hint=update_hint))

    def run_tk_loop(self) -> None:
        self._build_ui()
        if self.root:
            self.root.mainloop()

    def destroy(self) -> None:
        if self.root:
            try:
                self.root.quit()
                self.root.destroy()
            except Exception:
                pass
        self.root = None
        self._ready.clear()
