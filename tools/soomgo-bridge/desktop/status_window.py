"""실행 상태 패널 (tkinter)"""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import Any

from version_info import APP_VERSION, BRIDGE_API_VERSION


class StatusWindow:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title('SK클린텍 숨고 연동')
        self.root.geometry('420x320')
        self.root.minsize(360, 280)
        self.root.protocol('WM_DELETE_WINDOW', self.hide)

        header = ttk.Label(self.root, text='숨고 브릿지 실행 중', font=('Segoe UI', 12, 'bold'))
        header.pack(anchor='w', padx=12, pady=(12, 4))

        self.status_var = tk.StringVar(value='시작 중…')
        ttk.Label(self.root, textvariable=self.status_var, wraplength=380).pack(anchor='w', padx=12, pady=4)

        frame = ttk.Frame(self.root)
        frame.pack(fill='both', expand=True, padx=12, pady=8)

        self.rows: dict[str, tk.StringVar] = {}
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

        self.hint_var = tk.StringVar(
            value='텔레CRM에서 「숨고 연동」·「정보 갖고오기」를 사용하세요.'
        )
        ttk.Label(self.root, textvariable=self.hint_var, wraplength=380, foreground='#475569').pack(
            anchor='w', padx=12, pady=(4, 12)
        )

        self._visible = True

    def hide(self) -> None:
        self.root.withdraw()
        self._visible = False

    def show(self) -> None:
        self.root.deiconify()
        self.root.lift()
        self._visible = True

    def update_bridge_status(self, status: dict[str, Any] | None, *, update_hint: str | None = None) -> None:
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
        if update_hint:
            self.hint_var.set(update_hint)

    def run_tk_loop(self) -> None:
        self.root.mainloop()
