"""상태 창. 가상폰·미소·로그인·CRM 연결과 세 가지 동작."""
from __future__ import annotations

import tkinter as tk
from collections.abc import Callable


class StatusWindow:
    def __init__(self) -> None:
        self._root: tk.Tk | None = None
        self._lines: dict[str, tk.StringVar] = {}
        self._on_restart_phone: Callable[[], None] | None = None
        self._on_install: Callable[[], None] | None = None
        self._on_logs: Callable[[], None] | None = None

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

    def show(self) -> None:
        if self._root is not None:
            try:
                self._root.after(0, lambda: (self._root.deiconify(), self._root.lift()))
                return
            except tk.TclError:
                self._root = None
        root = tk.Tk()
        self._root = root
        root.title('청소비서 미소 연동')
        root.geometry('420x280')
        frame = tk.Frame(root, padx=16, pady=12)
        frame.pack(fill='both', expand=True)
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
        tk.Button(row, text='가상폰 다시 켜기', command=lambda: self._on_restart_phone and self._on_restart_phone()).pack(fill='x', pady=2)
        tk.Button(row, text='미소 설치 화면 열기', command=lambda: self._on_install and self._on_install()).pack(fill='x', pady=2)
        tk.Button(row, text='로그 보내기', command=lambda: self._on_logs and self._on_logs()).pack(fill='x', pady=2)
        root.protocol('WM_DELETE_WINDOW', root.withdraw)

    def update_status(self, *, phone: str, miso: str, login: str, crm: str) -> None:
        if self._root is None:
            return
        mapping = {'phone': phone, 'miso': miso, 'login': login, 'crm': crm}
        for key, text in mapping.items():
            var = self._lines.get(key)
            if var is not None:
                self._root.after(0, lambda variable=var, value=text: variable.set(value))

    def pump(self) -> None:
        if self._root is None:
            return
        try:
            self._root.update()
        except tk.TclError:
            self._root = None
