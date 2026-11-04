"""첫 실행 준비 창. 진행 막대와 한글 단계. 중간에 닫아도 다음 실행에서 이어간다."""
from __future__ import annotations

import queue
import threading
import tkinter as tk
from collections.abc import Callable
from tkinter import messagebox, scrolledtext, ttk

from automation.emulator_launcher import foreign_emulator_online
from desktop.config import APP_DATA_DIR, ensure_app_data, load_setup_state
from desktop.pc_check import enable_hypervisor_platform, inspect_pc
from desktop.sdk_setup import (
    accept_licenses,
    create_avd,
    ensure_cmdline_tools,
    install_packages,
    license_text,
    open_play_store_if_needed,
    run_first_boot,
    setup_needs_resume,
)


def run_setup_wizard() -> bool:
    root = tk.Tk()
    root.title('청소비서 미소 연동')
    root.geometry('520x360')
    root.resizable(False, False)
    done = {'ok': False}
    resuming = setup_needs_resume()
    status = tk.StringVar(
        master=root,
        value='가상폰 준비를 이어서 합니다 (약 10~20분)' if resuming else 'PC 상태를 확인하는 중…',
    )
    percent = tk.StringVar(master=root, value='0%')
    bar_row = tk.Frame(root)
    tk.Label(root, textvariable=status, justify='left', wraplength=480, anchor='w').pack(fill='x', padx=16, pady=(16, 8))
    bar_row.pack(fill='x', padx=16, pady=8)
    bar = ttk.Progressbar(bar_row, maximum=100, mode='determinate')
    bar.pack(side='left', fill='x', expand=True)
    tk.Label(bar_row, textvariable=percent, width=5, anchor='e').pack(side='right', padx=(8, 0))
    ui_queue: queue.Queue[Callable[[], object]] = queue.Queue()

    def poll_ui() -> None:
        while True:
            try:
                fn = ui_queue.get_nowait()
            except queue.Empty:
                break
            fn()
        try:
            root.after(50, poll_ui)
        except tk.TclError:
            pass

    def set_progress(text: str, value: float) -> None:
        pct = max(0, min(100, int(round(value * 100))))
        shown = text
        if resuming and not text.startswith('가상폰 준비를 이어서'):
            shown = f'가상폰 준비를 이어서 합니다 (약 10~20분)\n{text}'
        ui_queue.put(
            lambda text=shown, pct=pct, value=value: (
                status.set(text),
                percent.set(f'{pct}%'),
                bar.configure(value=pct),
            )
        )

    def on_main(fn: Callable[[], object]) -> object:
        finished = threading.Event()
        box: dict[str, object] = {}

        def wrapped() -> None:
            try:
                box['value'] = fn()
            finally:
                finished.set()

        ui_queue.put(wrapped)
        finished.wait()
        return box.get('value')

    def ask_enable(message: str) -> bool:
        dialog = tk.Toplevel(root)
        dialog.title('가상화 기능')
        dialog.geometry('460x220')
        choice = {'yes': False}
        tk.Label(dialog, text=message, justify='left', wraplength=420).pack(fill='both', expand=True, padx=16, pady=12)

        def agree() -> None:
            choice['yes'] = True
            dialog.destroy()

        row = tk.Frame(dialog)
        row.pack(fill='x', padx=16, pady=12)
        tk.Button(row, text='켜기', command=agree).pack(side='right')
        tk.Button(row, text='나중에', command=dialog.destroy).pack(side='right', padx=8)
        dialog.grab_set()
        root.wait_window(dialog)
        return choice['yes']

    def ask_license(preview: str) -> bool:
        dialog = tk.Toplevel(root)
        dialog.title('Android 도구 사용 동의')
        dialog.geometry('520x220')
        dialog.resizable(False, False)
        choice = {'yes': False}
        tk.Label(
            dialog,
            text='가상폰을 만들려면 구글 Android 도구 사용 약관에 동의해야 합니다.',
            justify='left',
            wraplength=480,
            anchor='w',
        ).pack(fill='x', padx=16, pady=(16, 8))
        body = tk.Frame(dialog)
        opened = {'on': False}

        def toggle() -> None:
            if opened['on']:
                body.pack_forget()
                dialog.geometry('520x220')
                opened['on'] = False
                return
            body.pack(fill='both', expand=True, padx=16, pady=(0, 8))
            dialog.geometry('520x460')
            opened['on'] = True

        tk.Button(dialog, text='약관 원문 보기', command=toggle).pack(anchor='w', padx=16, pady=(0, 8))
        text = scrolledtext.ScrolledText(body, wrap='word', height=12)
        text.insert('1.0', preview.strip() or '약관 원문을 불러오지 못했습니다.')
        text.configure(state='disabled')
        text.pack(fill='both', expand=True)

        def agree() -> None:
            choice['yes'] = True
            dialog.destroy()

        row = tk.Frame(dialog)
        row.pack(fill='x', padx=16, pady=12)
        tk.Button(row, text='동의하고 계속', command=agree).pack(side='right')
        tk.Button(row, text='취소', command=dialog.destroy).pack(side='right', padx=8)
        dialog.grab_set()
        root.wait_window(dialog)
        return choice['yes']

    def work() -> None:
        try:
            ensure_app_data()
            check = inspect_pc(str(APP_DATA_DIR))
            set_progress(check.message, 0.02)
            if not check.disk_ok:
                on_main(lambda: messagebox.showwarning('PC 점검', check.message, parent=root))
                return
            if check.verdict == 'bios_off':
                on_main(lambda: messagebox.showinfo('바이오스', check.message, parent=root))
            if check.verdict == 'need_hypervisor':
                if not on_main(lambda: ask_enable(check.message)):
                    return
                ok, message = enable_hypervisor_platform()
                on_main(lambda: messagebox.showinfo('다시 시작', message, parent=root))
                return
            if check.ram_gb and check.ram_gb < 8:
                on_main(lambda: messagebox.showwarning('메모리', check.message, parent=root))
            if foreign_emulator_online():
                on_main(lambda: messagebox.showinfo('가상폰', '다른 가상폰이 켜져 있어요. 닫고 계속', parent=root))
            ensure_cmdline_tools(set_progress)
            if not load_setup_state().get('licenses'):
                set_progress('사용 약관을 확인하는 중…', 0.19)
                preview = license_text()
                if not on_main(lambda: ask_license(preview)):
                    set_progress('동의가 없으면 가상폰을 준비할 수 없습니다.', 0.2)
                    return
            accept_licenses(set_progress)
            install_packages(set_progress)
            create_avd(set_progress)
            run_first_boot(set_progress)
            notice = open_play_store_if_needed(set_progress)
            done['ok'] = True
            on_main(lambda: messagebox.showinfo('미소 설치', notice, parent=root))
        except Exception as exc:
            text = str(exc)
            if text == '다른 가상폰이 켜져 있어요. 닫고 계속':
                on_main(lambda: messagebox.showinfo('가상폰', text, parent=root))
            else:
                on_main(lambda message=text: messagebox.showerror('준비 실패', message, parent=root))
        finally:
            ui_queue.put(root.destroy)

    root.after(50, poll_ui)
    threading.Thread(target=work, daemon=True).start()
    root.mainloop()
    return done['ok']
