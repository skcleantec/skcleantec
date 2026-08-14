"""업데이트 진행 — 항상 위에 뜨는 모달 창."""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk


class UpdateProgressDialog:
    def __init__(self, root: tk.Misc, *, title: str = '업데이트'):
        self.root = root
        self.win = tk.Toplevel(root)
        self.win.title(title)
        self.win.geometry('440x190')
        self.win.resizable(False, False)
        self.win.transient(root)
        self.win.grab_set()
        try:
            self.win.attributes('-topmost', True)
        except tk.TclError:
            pass
        self.win.protocol('WM_DELETE_WINDOW', lambda: None)

        wrap = ttk.Frame(self.win, padding=20)
        wrap.pack(fill='both', expand=True)

        ttk.Label(wrap, text='업데이트 중…', font=('', 13, 'bold')).pack(anchor='w')
        self.status_var = tk.StringVar(value='준비 중…')
        ttk.Label(wrap, textvariable=self.status_var, font=('', 10)).pack(anchor='w', pady=(10, 4))
        self.percent_var = tk.StringVar(value='0%')
        ttk.Label(wrap, textvariable=self.percent_var, font=('', 10)).pack(anchor='e')

        self.bar = ttk.Progressbar(wrap, mode='determinate', maximum=100, length=380)
        self.bar.pack(fill='x', pady=(8, 0))

        self._indeterminate = False
        self._center()
        self.pump()

    def _center(self) -> None:
        self.win.update_idletasks()
        rx = self.root.winfo_rootx()
        ry = self.root.winfo_rooty()
        rw = self.root.winfo_width()
        rh = self.root.winfo_height()
        w = self.win.winfo_width()
        h = self.win.winfo_height()
        x = rx + max(0, (rw - w) // 2)
        y = ry + max(0, (rh - h) // 2)
        self.win.geometry(f'+{x}+{y}')

    def pump(self) -> None:
        try:
            self.win.update_idletasks()
            self.root.update_idletasks()
        except tk.TclError:
            pass

    def set_progress(self, downloaded: int, total: int | None, message: str) -> None:
        self.status_var.set(message)
        if total and total > 0:
            if self._indeterminate:
                try:
                    self.bar.stop()
                except tk.TclError:
                    pass
                self.bar.configure(mode='determinate', maximum=100)
                self._indeterminate = False
            pct = min(100, max(0, int(downloaded * 100 / total)))
            self.bar['value'] = pct
            self.percent_var.set(f'{pct}%')
        else:
            if not self._indeterminate:
                self.bar.configure(mode='indeterminate')
                self.bar.start(12)
                self._indeterminate = True
            self.percent_var.set('진행 중…')
        self.pump()

    def set_status(self, message: str, *, percent: int | None = None) -> None:
        self.status_var.set(message)
        if percent is not None:
            if self._indeterminate:
                try:
                    self.bar.stop()
                except tk.TclError:
                    pass
                self.bar.configure(mode='determinate', maximum=100)
                self._indeterminate = False
            self.bar['value'] = percent
            self.percent_var.set(f'{percent}%')
        self.pump()

    def close(self) -> None:
        try:
            if self._indeterminate:
                self.bar.stop()
            self.win.grab_release()
            self.win.destroy()
        except tk.TclError:
            pass
