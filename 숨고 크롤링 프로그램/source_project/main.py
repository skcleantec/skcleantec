# Source Generated with Decompyle++
# File: main.pyc (Python 3.12)

'''
숨고(Soomgo) 채팅 자동화 GUI 프로그램
- 팝업 방식 설정 UI
- 깔끔한 메인 화면
- 기능 1: 재접촉
- 기능 2+3: 이모지/견적조회 통합
'''
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import threading
import logging
from datetime import datetime
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def get_base_path():
    '''
    실행 파일 또는 스크립트의 기본 경로 반환
    PyInstaller 빌드 후에도 실행파일 위치 기준으로 동작
    '''
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)
    # USB/폴더 복사 시 images가 source_project 바깥(상위)에 있는 경우
    if os.path.isdir(os.path.join(parent_dir, 'images')) and not os.path.isdir(
        os.path.join(script_dir, 'images')
    ):
        return parent_dir
    return script_dir

from config import load_config, save_config, save_credentials, get_credentials
from automation.browser import BrowserManager
from automation.login import login_to_soomgo, goto_chat_list, is_logged_in
from features.recontact import RecontactFeature, resolve_recontact_period
from features.combined_feature import CombinedFeature
from features.delete_left_chats import DeleteLeftChatsFeature
from features.leave_hired_other_chats import LeaveHiredOtherChatsFeature
from features.leave_stale_chats import LeaveStaleChatsFeature
logging.basicConfig(level = logging.INFO, format = '%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from gui_widgets import (
    TextEditorFrame,
    SendOrderFrame,
    RecontactSettingsDialog,
    CombinedSettingsDialog,
)
from version_info import APP_DISPLAY_NAME, APP_VERSION
from desktop.manifest_client import fetch_manifest, is_update_available, is_update_required, manifest_summary
from desktop.update_progress_ui import UpdateProgressDialog
from desktop.update_manager import (
    clear_failed_update_state,
    download_update_artifact,
    launch_update_handoff,
    read_failed_update_message,
    read_update_state,
)


class SoomgoAutomationApp:
    '''숨고 채팅 자동화 GUI 애플리케이션'''
    
    def __init__(self, root):
        self.root = root
        self.root.title(f'{APP_DISPLAY_NAME} v{APP_VERSION}')
        self.root.resizable(True, True)
        self._apply_main_window_geometry()
        self.browser = BrowserManager()
        self.current_feature = None
        self.delete_feature = None
        self.leave_hired_other_feature = None
        self.leave_stale_feature = None
        self.feature_thread = None
        self.recontact_settings = { }
        self.combined_settings = { }
        self.config = load_config()
        self.login_in_progress = False
        self.is_logged_in = False
        self.update_manifest = None
        self.update_busy = False
        self.create_widgets()
        self.load_saved_credentials()
        self.root.protocol('WM_DELETE_WINDOW', self.on_closing)
        self.root.after(1500, self.check_update_in_background)
        self.root.after(800, self.show_failed_update_notice_if_any)

    
    def show_failed_update_notice_if_any(self):
        failed = read_failed_update_message()
        if not failed:
            return
        log_hint = ''
        try:
            from desktop.config import UPDATE_LOG_PATH
            if UPDATE_LOG_PATH.is_file():
                log_hint = f'\n\n로그: {UPDATE_LOG_PATH}'
        except Exception:
            pass
        if messagebox.askyesno(
            '업데이트 실패',
            f'{failed}{log_hint}\n\n업데이트를 다시 시도하시겠습니까?',
        ):
            clear_failed_update_state()
            self.run_apply_update(force=True)
        else:
            clear_failed_update_state()
    def _apply_main_window_geometry(self):
        '''메인 창 — 한눈에 보이는 크기·화면 중앙'''
        width, height = 1080, 920
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        width = min(width, max(880, sw - 48))
        height = min(height, max(780, sh - 48))
        x = max(0, (sw - width) // 2)
        y = max(0, (sh - height) // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
        self.root.minsize(880, 780)

    LOG_PANEL_WIDTH = 360

    def create_widgets(self):
        '''GUI 위젯 생성 — 좌측 컨트롤(넓게) / 우측 로그(고정 폭)'''
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        outer = ttk.Frame(self.root)
        outer.pack(fill=tk.BOTH, expand=True)
        outer.rowconfigure(0, weight=1)
        outer.columnconfigure(0, weight=1)
        outer.columnconfigure(1, weight=0, minsize=self.LOG_PANEL_WIDTH)

        left_wrap = ttk.Frame(outer)
        left_wrap.grid(row=0, column=0, sticky='nsew')
        left_wrap.rowconfigure(0, weight=1)
        left_wrap.columnconfigure(0, weight=1)

        self.main_canvas = tk.Canvas(left_wrap, highlightthickness=0)
        scrollbar = ttk.Scrollbar(
            left_wrap, orient='vertical', command=self.main_canvas.yview
        )
        main_frame = ttk.Frame(self.main_canvas, padding='12')
        self._main_scroll_window = self.main_canvas.create_window(
            (0, 0), window=main_frame, anchor='nw'
        )

        self.main_canvas.configure(yscrollcommand=scrollbar.set)
        self.main_canvas.grid(row=0, column=0, sticky='nsew')
        scrollbar.grid(row=0, column=1, sticky='ns')

        main_frame.bind('<Configure>', self._on_main_scroll_configure)
        self.main_canvas.bind('<Configure>', self._on_main_canvas_configure)
        self._bind_main_mousewheel(self.main_canvas)
        self._bind_main_mousewheel(main_frame)

        self.create_update_section(main_frame)
        ttk.Separator(main_frame, orient='horizontal').pack(fill='x', pady=8)
        self.create_login_section(main_frame)
        ttk.Separator(main_frame, orient='horizontal').pack(fill='x', pady=10)
        self.create_feature_cards(main_frame)

        log_wrap = ttk.Frame(outer, width=self.LOG_PANEL_WIDTH, padding='6')
        log_wrap.grid(row=0, column=1, sticky='ns')
        log_wrap.grid_propagate(False)
        log_wrap.columnconfigure(0, weight=1)
        log_wrap.rowconfigure(0, weight=1)
        self.create_log_section(log_wrap)

    def _on_main_scroll_configure(self, event=None):
        self.main_canvas.configure(scrollregion=self.main_canvas.bbox('all'))

    def _on_main_canvas_configure(self, event):
        self.main_canvas.itemconfig(self._main_scroll_window, width=event.width)

    def _bind_main_mousewheel(self, widget):
        def _on_mousewheel(event):
            if self.main_canvas.bbox('all') is None:
                return
            content_height = int(self.main_canvas.bbox('all')[3])
            canvas_height = self.main_canvas.winfo_height()
            if content_height <= canvas_height:
                return
            self.main_canvas.yview_scroll(int(-1 * (event.delta / 120)), 'units')

        widget.bind('<Enter>', lambda _e: widget.bind_all('<MouseWheel>', _on_mousewheel))
        widget.bind('<Leave>', lambda _e: widget.unbind_all('<MouseWheel>'))

    def create_update_section(self, parent):
        '''버전·자동 업데이트'''
        frame = ttk.Frame(parent)
        frame.pack(fill='x', pady=(0, 4))
        self.update_status_var = tk.StringVar(value=f'버전 v{APP_VERSION}')
        ttk.Label(frame, textvariable=self.update_status_var, font=('', 9)).pack(side='left')
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(side='right')
        self.update_check_btn = ttk.Button(
            btn_frame, text='업데이트 확인', command=self.run_check_update, width=12
        )
        self.update_check_btn.pack(side='left', padx=2)
        self.update_btn = ttk.Button(
            btn_frame, text='업데이트', command=self.run_apply_update, width=10, state='disabled'
        )
        self.update_btn.pack(side='left', padx=2)
        progress_wrap = ttk.Frame(parent)
        progress_wrap.pack(fill='x', pady=(0, 4))
        self.update_progress = ttk.Progressbar(progress_wrap, mode='determinate', maximum=100)
        self.update_progress.pack(fill='x')
        self.update_progress.pack_forget()

    def _show_update_progress(self, visible: bool):
        try:
            if visible:
                self.update_progress.pack(fill='x')
            else:
                try:
                    self.update_progress.stop()
                except tk.TclError:
                    pass
                self.update_progress.pack_forget()
                self.update_progress['value'] = 0
        except tk.TclError:
            pass

    def _set_update_progress(self, downloaded: int, total, message: str):
        try:
            if total and total > 0:
                try:
                    self.update_progress.stop()
                except tk.TclError:
                    pass
                self.update_progress.configure(mode='determinate', maximum=100)
                pct = min(100, int(downloaded * 100 / total))
                self.update_progress['value'] = pct
            else:
                if str(self.update_progress.cget('mode')) != 'indeterminate':
                    self.update_progress.configure(mode='indeterminate')
                    self.update_progress.start(12)
            self.update_status_var.set(message)
        except tk.TclError:
            pass

    def _set_update_ui_busy(self, busy: bool):
        self.update_busy = busy
        state = 'disabled' if busy else 'normal'
        try:
            self.update_check_btn.config(state=state)
            if busy:
                self.update_btn.config(state='disabled')
            else:
                self.refresh_update_button()
        except tk.TclError:
            pass

    def refresh_update_button(self):
        manifest = self.update_manifest
        if self.update_busy:
            return
        if manifest and (is_update_available(manifest) or is_update_required(manifest)):
            latest = str(manifest.get('latestVersion', '')).strip()
            self.update_btn.config(state='normal')
            self.update_status_var.set(f'버전 v{APP_VERSION} → v{latest} 사용 가능')
        else:
            self.update_btn.config(state='disabled')
            self.update_status_var.set(f'버전 v{APP_VERSION} (최신)')

    def check_update_in_background(self):
        if self.update_busy:
            return

        def worker():
            manifest = fetch_manifest()
            def on_done():
                self.update_manifest = manifest
                self.refresh_update_button()
                if manifest and is_update_required(manifest):
                    latest = str(manifest.get('latestVersion', '')).strip()
                    if messagebox.askyesno(
                        '필수 업데이트',
                        f'필수 업데이트(v{latest})가 있습니다.\n지금 업데이트하시겠습니까?',
                    ):
                        self.run_apply_update()
            self.root.after(0, on_done)

        threading.Thread(target=worker, daemon=True).start()

    def run_check_update(self):
        if self.update_busy:
            return
        self._set_update_ui_busy(True)
        self.log('업데이트 확인 중…')

        def worker():
            manifest = fetch_manifest()
            def on_done():
                self._set_update_ui_busy(False)
                self.update_manifest = manifest
                self.refresh_update_button()
                if not manifest:
                    self.log('업데이트 서버에 연결하지 못했습니다.')
                    messagebox.showwarning('업데이트', manifest_summary(None))
                    return
                self.log(manifest_summary(manifest).replace('\n', ' · '))
                if is_update_available(manifest) or is_update_required(manifest):
                    messagebox.showinfo('업데이트', manifest_summary(manifest))
                else:
                    messagebox.showinfo('업데이트', f'현재 v{APP_VERSION} 이(가) 최신입니다.')
            self.root.after(0, on_done)

        threading.Thread(target=worker, daemon=True).start()

    def _prepare_for_update_exit(self, progress: UpdateProgressDialog | None = None):
        if progress:
            progress.set_status('브라우저·설정 저장 중…', percent=85)
        if self.current_feature:
            self.current_feature.stop()
        if hasattr(self, 'delete_feature') and self.delete_feature:
            self.delete_feature.stop()
        if hasattr(self, 'leave_hired_other_feature') and self.leave_hired_other_feature:
            self.leave_hired_other_feature.stop()
        if hasattr(self, 'leave_stale_feature') and self.leave_stale_feature:
            self.leave_stale_feature.stop()
        if self.browser.is_running():
            stop_thread = threading.Thread(target=self.browser.stop, daemon=True)
            stop_thread.start()
            stop_thread.join(timeout=4.0)
        else:
            self.browser.stop()
        self.config['delay_seconds'] = self.get_delay()
        self.config['recontact'] = self.recontact_settings.copy() if self.recontact_settings else { }
        self.config['combined'] = self.combined_settings.copy() if self.combined_settings else { }
        self.config['leave_hired_other'] = {
            'detection_text': self.leave_hired_other_text_var.get().strip(),
            'max_scrolls': self.config.get('leave_hired_other', {}).get('max_scrolls', 100),
        }
        if hasattr(self, 'leave_stale_dry_run_var'):
            self.config['leave_stale'] = {
                'dry_run': bool(self.leave_stale_dry_run_var.get()),
                'max_scrolls': self.config.get('leave_stale', {}).get('max_scrolls', 100),
            }
        if self.save_credentials_var.get():
            self.config['save_credentials'] = True
            self.config['email'] = self.email_var.get().strip()
            self.config['password'] = self.password_var.get().strip()
        else:
            self.config['save_credentials'] = False
            self.config['email'] = ''
            self.config['password'] = ''
        save_config(self.config)

    def run_apply_update(self, force: bool = False):
        if self.update_busy:
            return
        if self.current_feature or getattr(self, 'delete_feature', None) or getattr(
            self, 'leave_hired_other_feature', None
        ) or getattr(self, 'leave_stale_feature', None):
            messagebox.showwarning('업데이트', '기능 실행 중에는 업데이트할 수 없습니다.')
            return

        manifest = self.update_manifest
        if not manifest:
            self.run_check_update()
            return
        if (
            not force
            and not is_update_available(manifest)
            and not is_update_required(manifest)
        ):
            messagebox.showinfo('업데이트', f'현재 v{APP_VERSION} 이(가) 최신입니다.')
            return

        latest = str(manifest.get('latestVersion', '')).strip()
        notes = str(manifest.get('releaseNotes', '')).strip()
        detail = f'v{APP_VERSION} → v{latest} 으로 업데이트합니다.'
        if notes:
            detail += f'\n\n{notes}'
        detail += '\n\n① 다운로드 진행률이 표시됩니다.'
        detail += '\n② 적용 단계에서 잠시 종료 후 자동으로 다시 시작됩니다.'
        detail += f'\n③ 설치 위치: {__import__("desktop.config", fromlist=["resolve_app_dir"]).resolve_app_dir()}'
        if not force and not messagebox.askyesno('업데이트', detail):
            return

        self._set_update_ui_busy(True)
        progress = UpdateProgressDialog(self.root, title='업데이트')
        progress.set_status(f'v{latest} 다운로드 준비…', percent=0)
        self.log(f'v{latest} 업데이트 시작…')

        def on_progress(downloaded: int, total, message: str):
            def ui():
                progress.set_progress(downloaded, total, message)
            self.root.after(0, ui)

        def worker():
            ok, msg = download_update_artifact(manifest, force=True, on_progress=on_progress)

            def on_downloaded():
                if not ok:
                    progress.close()
                    self._set_update_ui_busy(False)
                    self.log(msg)
                    messagebox.showerror('업데이트', msg)
                    return

                state = read_update_state()
                artifact = str(state.get('artifact', '')).strip()
                zip_path = __import__('pathlib').Path(artifact) if artifact else None
                if not zip_path or not zip_path.is_file():
                    progress.close()
                    self._set_update_ui_busy(False)
                    messagebox.showerror('업데이트', '설치 파일을 찾을 수 없습니다.')
                    return

                progress.set_status('업데이트 적용 중… 곧 자동 재시작됩니다.', percent=100)
                self.log('다운로드 완료 — 파일 교체·재시작 준비')
                try:
                    self._prepare_for_update_exit(progress)
                except Exception as e:
                    progress.close()
                    self._set_update_ui_busy(False)
                    self.log(f'업데이트 준비 실패: {e}')
                    messagebox.showerror('업데이트', f'업데이트 준비 실패: {e}')
                    return

                progress.set_status('업데이트 설치 프로그램 실행…', percent=100)
                for _ in range(8):
                    progress.pump()
                    self.root.update()
                    __import__('time').sleep(0.12)

                ok2, msg2 = launch_update_handoff(zip_path, latest)
                if ok2:
                    progress.set_status('잠시 후 자동으로 다시 시작됩니다…', percent=100)
                    for _ in range(6):
                        progress.pump()
                        self.root.update()
                        __import__('time').sleep(0.1)
                    __import__('os')._exit(0)

                progress.close()
                self._set_update_ui_busy(False)
                self.log(msg2)
                messagebox.showerror('업데이트', msg2)

            self.root.after(0, on_downloaded)

        threading.Thread(target=worker, daemon=True).start()

    
    def create_login_section(self, parent):
        '''로그인 섹션 생성'''
        frame = ttk.LabelFrame(parent, text = '로그인 정보', padding = '10')
        frame.pack(fill = 'x', pady = 5)
        row1 = ttk.Frame(frame)
        row1.pack(fill = 'x', pady = 2)
        ttk.Label(row1, text = '이메일:').pack(side = 'left')
        self.email_var = tk.StringVar()
        ttk.Entry(row1, textvariable = self.email_var, width = 25).pack(side = 'left', padx = 5)
        ttk.Label(row1, text = '비밀번호:').pack(side = 'left', padx = (10, 0))
        self.password_var = tk.StringVar()
        ttk.Entry(row1, textvariable = self.password_var, width = 25, show = '*').pack(side = 'left', padx = 5)
        self.save_credentials_var = tk.BooleanVar(value = True)
        ttk.Checkbutton(row1, text = '저장', variable = self.save_credentials_var).pack(side = 'left', padx = (10, 0))
        row2 = ttk.Frame(frame)
        row2.pack(fill = 'x', pady = 5)
        ttk.Label(row2, text = '딜레이(초):').pack(side = 'left')
        self.delay_var = tk.StringVar(value = '1.5')
        ttk.Spinbox(row2, from_ = 0.5, to = 5, increment = 0.5, textvariable = self.delay_var, width = 5).pack(side = 'left', padx = 5)

        btn_frame = ttk.Frame(row2)
        btn_frame.pack(side = 'right')
        self.login_status_var = tk.StringVar(value = '● 미로그인')
        self.login_status_label = ttk.Label(btn_frame, textvariable = self.login_status_var, foreground = 'gray')
        self.login_status_label.pack(side = 'left', padx = (0, 10))
        self.login_btn = ttk.Button(btn_frame, text = '로그인', command = self.run_login, width = 10)
        self.login_btn.pack(side = 'left', padx = 2)
        self.logout_btn = ttk.Button(btn_frame, text = '로그아웃', command = self.run_logout, width = 10)
        self.logout_btn.pack(side = 'left', padx = 2)

    
    def create_feature_cards(self, parent):
        '''기능 카드 생성'''
        cards_frame = ttk.Frame(parent)
        cards_frame.pack(fill = 'x', pady = 5)
        self.create_recontact_card(cards_frame)
        self.create_combined_card(cards_frame)
        self.create_leave_management_row(cards_frame)
        self.create_leave_stale_card(cards_frame)

    def create_leave_management_row(self, parent):
        '''나간 채팅 삭제 / 다른 고수 고용 방 나가기 - 좌우 한 줄 배치'''
        row = ttk.Frame(parent)
        row.pack(fill='x', pady=5)
        row.columnconfigure(0, weight=1, uniform='leave_mgmt')
        row.columnconfigure(1, weight=1, uniform='leave_mgmt')

        left_col = ttk.Frame(row)
        left_col.grid(row=0, column=0, sticky='nsew', padx=(0, 5))
        right_col = ttk.Frame(row)
        right_col.grid(row=0, column=1, sticky='nsew', padx=(5, 0))

        self.create_delete_card(left_col)
        self.create_leave_hired_other_card(right_col)

    
    def create_recontact_card(self, parent):
        '''재접촉 카드'''
        card = ttk.LabelFrame(parent, text = '재접촉', padding = '15')
        card.pack(fill = 'x', pady = 5)
        info_frame = ttk.Frame(card)
        info_frame.pack(fill = 'x', pady = (0, 10))
        self.f1_summary_var = tk.StringVar(value = '키워드: (미설정)  |  기간: 오늘')
        ttk.Label(info_frame, textvariable = self.f1_summary_var, font = ('', 9)).pack(side = 'left')
        btn_frame = ttk.Frame(card)
        btn_frame.pack(fill = 'x')
        ttk.Button(btn_frame, text = '설정', command = self.open_recontact_settings, width = 12).pack(side = 'left', padx = 5)
        self.f1_run_btn = ttk.Button(btn_frame, text = '실행', command = self.run_recontact, width = 12)
        self.f1_run_btn.pack(side = 'right', padx = 5)
        self.f1_stop_btn = ttk.Button(btn_frame, text = '중지', command = self.stop_recontact, width = 12, state = 'disabled')
        self.f1_stop_btn.pack(side = 'right', padx = 5)
        self.f1_resume_btn = ttk.Button(
            btn_frame, text='이어하기', command=self.run_recontact_resume, width=12, state='disabled'
        )
        self.f1_resume_btn.pack(side='right', padx=5)

    
    def create_combined_card(self, parent):
        '''이모지/견적조회 카드'''
        card = ttk.LabelFrame(parent, text = '이모지/견적조회', padding = '15')
        card.pack(fill = 'x', pady = 5)
        info_frame = ttk.Frame(card)
        info_frame.pack(fill = 'x', pady = (0, 5))
        self.f2_summary_var = tk.StringVar(value = '이모지: ✓ (미설정)  |  견적조회: ✓  |  주기: 1분')
        ttk.Label(info_frame, textvariable = self.f2_summary_var, font = ('', 9)).pack(side = 'left')
        stats_frame = ttk.Frame(card)
        stats_frame.pack(fill = 'x', pady = 5)
        ttk.Separator(stats_frame, orient = 'horizontal').pack(fill = 'x', pady = 5)
        stats_row = ttk.Frame(stats_frame)
        stats_row.pack(fill = 'x')
        self.f2_emoji_count_var = tk.StringVar(value = '이모지: 0개')
        ttk.Label(stats_row, textvariable = self.f2_emoji_count_var, width = 12).pack(side = 'left')
        self.f2_quote_count_var = tk.StringVar(value = '견적조회: 0개')
        ttk.Label(stats_row, textvariable = self.f2_quote_count_var, width = 14).pack(side = 'left')
        self.f2_total_count_var = tk.StringVar(value = '총: 0명')
        ttk.Label(stats_row, textvariable = self.f2_total_count_var, width = 10).pack(side = 'left')
        self.f2_status_var = tk.StringVar(value = '대기 중')
        self.f2_status_label = ttk.Label(stats_row, textvariable = self.f2_status_var, foreground = 'gray')
        self.f2_status_label.pack(side = 'left', padx = 10)
        ttk.Separator(stats_frame, orient = 'horizontal').pack(fill = 'x', pady = 5)
        btn_frame = ttk.Frame(card)
        btn_frame.pack(fill = 'x')
        ttk.Button(btn_frame, text = '설정', command = self.open_combined_settings, width = 12).pack(side = 'left', padx = 5)
        ttk.Button(btn_frame, text = '기록 초기화', command = self.clear_combined_records, width = 12).pack(side = 'left', padx = 5)
        self.test_mode_var = tk.BooleanVar(value = False)
        ttk.Checkbutton(btn_frame, text = '테스트 모드', variable = self.test_mode_var).pack(side = 'left', padx = 15)
        self.f2_run_btn = ttk.Button(btn_frame, text = '실행', command = self.run_combined, width = 12)
        self.f2_run_btn.pack(side = 'right', padx = 5)
        self.f2_stop_btn = ttk.Button(btn_frame, text = '중지', command = self.stop_feature, width = 12, state = 'disabled')
        self.f2_stop_btn.pack(side = 'right', padx = 5)
        self.f2_resume_btn = ttk.Button(
            btn_frame, text='이어하기', command=self.run_combined_resume, width=12, state='disabled'
        )
        self.f2_resume_btn.pack(side='right', padx=5)
        self.refresh_recontact_resume_button()
        self.refresh_combined_resume_button()

    
    def create_delete_card(self, parent):
        '''나간 채팅 삭제 카드'''
        card = ttk.LabelFrame(parent, text='나간 채팅 삭제', padding='12')
        card.pack(fill='both', expand=True)
        settings_frame = ttk.Frame(card)
        settings_frame.pack(fill='x', pady=(0, 8))
        ttk.Label(settings_frame, text='감지:').pack(side='left')
        self.delete_text_var = tk.StringVar(value='상대방이 채팅방을 나갔습니다')
        ttk.Entry(
            settings_frame, textvariable=self.delete_text_var, width=22
        ).pack(side='left', fill='x', expand=True, padx=5)
        stats_frame = ttk.Frame(card)
        stats_frame.pack(fill='x', pady=(0, 8))
        self.delete_status_var = tk.StringVar(value='대기 중')
        ttk.Label(
            stats_frame, textvariable=self.delete_status_var, foreground='gray'
        ).pack(side='left')
        self.delete_count_var = tk.StringVar(value='삭제: 0개')
        ttk.Label(stats_frame, textvariable=self.delete_count_var).pack(side='right')
        btn_frame = ttk.Frame(card)
        btn_frame.pack(fill='x')
        self.delete_stop_btn = ttk.Button(
            btn_frame, text='중지', command=self.stop_delete, width=10, state='disabled'
        )
        self.delete_stop_btn.pack(side='right', padx=(5, 0))
        self.delete_run_btn = ttk.Button(
            btn_frame, text='실행', command=self.run_delete, width=10
        )
        self.delete_run_btn.pack(side='right')

    def create_leave_hired_other_card(self, parent):
        '''다른 고수 고용 방 나가기 카드'''
        card = ttk.LabelFrame(parent, text='다른 고수 고용 방 나가기', padding='12')
        card.pack(fill='both', expand=True)
        settings_frame = ttk.Frame(card)
        settings_frame.pack(fill='x', pady=(0, 4))
        ttk.Label(settings_frame, text='감지:').pack(side='left')
        self.leave_hired_other_text_var = tk.StringVar(value='다른 고수를 고용함')
        ttk.Entry(
            settings_frame, textvariable=self.leave_hired_other_text_var, width=22
        ).pack(side='left', fill='x', expand=True, padx=5)
        ttk.Label(
            card,
            text='(목록 이름 옆 배지 문구)',
            font=('', 8),
        ).pack(anchor='w', pady=(0, 8))
        stats_frame = ttk.Frame(card)
        stats_frame.pack(fill='x', pady=(0, 8))
        self.leave_hired_other_status_var = tk.StringVar(value='대기 중')
        ttk.Label(
            stats_frame, textvariable=self.leave_hired_other_status_var, foreground='gray'
        ).pack(side='left')
        self.leave_hired_other_count_var = tk.StringVar(value='나감: 0개')
        ttk.Label(
            stats_frame, textvariable=self.leave_hired_other_count_var
        ).pack(side='right')
        btn_frame = ttk.Frame(card)
        btn_frame.pack(fill='x')
        self.leave_hired_other_stop_btn = ttk.Button(
            btn_frame,
            text='중지',
            command=self.stop_leave_hired_other,
            width=10,
            state='disabled',
        )
        self.leave_hired_other_stop_btn.pack(side='right', padx=(5, 0))
        self.leave_hired_other_run_btn = ttk.Button(
            btn_frame, text='실행', command=self.run_leave_hired_other, width=10
        )
        self.leave_hired_other_run_btn.pack(side='right')

    def create_leave_stale_card(self, parent):
        '''오래된 채팅 정리 (희망일·30일) 카드'''
        card = ttk.LabelFrame(parent, text='오래된 채팅 정리', padding='12')
        card.pack(fill='x', pady=5)
        ttk.Label(
            card,
            text='① 스크롤로 목록 수집 → ② 검색 입장·판정 (오래된 순) · 이어하기 지원',
            font=('', 8),
        ).pack(anchor='w', pady=(0, 6))
        leave_stale_cfg = self.config.get('leave_stale', {})
        self.leave_stale_dry_run_var = tk.BooleanVar(
            value=bool(leave_stale_cfg.get('dry_run', True))
        )
        ttk.Checkbutton(
            card,
            text='미리보기만 (실제로 나가지 않음)',
            variable=self.leave_stale_dry_run_var,
        ).pack(anchor='w', pady=(0, 6))
        stats_frame = ttk.Frame(card)
        stats_frame.pack(fill='x', pady=(0, 8))
        self.leave_stale_status_var = tk.StringVar(value='대기 중')
        ttk.Label(
            stats_frame, textvariable=self.leave_stale_status_var, foreground='gray'
        ).pack(side='left')
        self.leave_stale_count_var = tk.StringVar(value='예정: 0 · 유지: 0')
        ttk.Label(stats_frame, textvariable=self.leave_stale_count_var).pack(side='right')
        btn_frame = ttk.Frame(card)
        btn_frame.pack(fill='x')
        self.leave_stale_stop_btn = ttk.Button(
            btn_frame,
            text='중지',
            command=self.stop_leave_stale,
            width=10,
            state='disabled',
        )
        self.leave_stale_stop_btn.pack(side='right', padx=(5, 0))
        self.leave_stale_resume_btn = ttk.Button(
            btn_frame,
            text='이어하기',
            command=self.run_leave_stale_resume,
            width=10,
            state='disabled',
        )
        self.leave_stale_resume_btn.pack(side='right', padx=(5, 0))
        self.leave_stale_run_btn = ttk.Button(
            btn_frame, text='시작', command=self.run_leave_stale, width=10
        )
        self.leave_stale_run_btn.pack(side='right')
        self.refresh_leave_stale_resume_button()

    
    def create_log_section(self, parent):
        '''로그 섹션 생성 (우측 패널 전체 높이)'''
        frame = ttk.LabelFrame(parent, text='로그', padding='8')
        frame.grid(row=0, column=0, sticky='nsew')
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)

        self.log_text = scrolledtext.ScrolledText(
            frame, state='disabled', wrap=tk.WORD
        )
        self.log_text.grid(row=0, column=0, sticky='nsew')

        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=1, column=0, sticky='ew', pady=(6, 0))
        ttk.Button(btn_frame, text='로그 지우기', command=self.clear_log).pack(
            side='right'
        )

    
    def open_recontact_settings(self):
        '''재접촉 설정 팝업 열기'''
        dialog = RecontactSettingsDialog(
            self.root, self.recontact_settings, get_base_path_fn=get_base_path
        )
        self.root.wait_window(dialog)
        if dialog.result:
            self.recontact_settings = dialog.result
            self.update_recontact_summary()
            self.persist_app_config()
            self.log('재접촉 설정 저장됨')
            return None

    
    def open_combined_settings(self):
        '''이모지/견적조회 설정 팝업 열기'''
        dialog = CombinedSettingsDialog(self.root, self.combined_settings, get_base_path_fn=get_base_path)
        self.root.wait_window(dialog)
        if dialog.result:
            self.combined_settings = dialog.result
            self.update_combined_summary()
            self.persist_app_config()
            self.log('이모지/견적조회 설정 저장됨')
            return None

    def persist_app_config(self):
        '''설정 다이얼로그 저장 시 config.json 동기화'''
        try:
            self.config['delay_seconds'] = self.get_delay()
        except Exception:
            pass
        self.config['recontact'] = (
            self.recontact_settings.copy() if self.recontact_settings else {}
        )
        self.config['combined'] = (
            self.combined_settings.copy() if self.combined_settings else {}
        )
        save_config(self.config)

    
    def update_recontact_summary(self):
        '''재접촉 요약 정보 업데이트'''
        from features.content_sender import (
            normalize_hired_me_settings,
            normalize_hired_other_content,
        )

        keyword = self.recontact_settings.get('keyword', '')
        period = self.recontact_settings.get('period', '오늘')
        send_order = self.recontact_settings.get('send_order', [])
        _, hired_other_send_order, _, hired_other_enabled = normalize_hired_other_content(
            self.recontact_settings
        )
        hired_me_filter_text, hired_me_enabled = normalize_hired_me_settings(
            self.recontact_settings
        )
        if keyword:
            keywords = [kw.strip() for kw in keyword.replace('\n', ',').split(',') if kw.strip()]
            if len(keywords) > 1:
                keyword_display = f'{len(keywords)}개 키워드'
            elif keywords:
                first = keywords[0]
                keyword_display = f'"{first[:15]}..."' if len(first) > 15 else f'"{first}"'
            else:
                keyword_display = '(미설정)'
        else:
            keyword_display = '(미설정)'
        order_display = f'{len(send_order)}단계' if send_order else '순서미설정'
        hired_me_display = ''
        if hired_me_enabled:
            preview = (
                hired_me_filter_text
                if len(hired_me_filter_text) <= 8
                else hired_me_filter_text[:8] + '…'
            )
            hired_me_display = f'  |  내고용제외: ✓ ({preview})'
        else:
            hired_me_display = '  |  내고용제외: ✗'
        hired_display = ''
        if hired_other_enabled and hired_other_send_order:
            hired_display = f'  |  다른고수: {len(hired_other_send_order)}단계'
        self.f1_summary_var.set(
            f'키워드: {keyword_display}  |  기간: {period}  |  전송: {order_display}'
            f'{hired_me_display}{hired_display}'
        )

    
    def update_combined_summary(self):
        '''이모지/견적조회 요약 정보 업데이트'''
        emoji_enabled = self.combined_settings.get('emoji_enabled', True)
        emoji = self.combined_settings.get('emoji', '')
        quote_enabled = self.combined_settings.get('quote_enabled', True)
        max_count = self.combined_settings.get('max_count', 20)
        if emoji_enabled and emoji:
            emoji_status = f'✓ ({emoji})'
        elif emoji_enabled:
            emoji_status = '✓ (미설정)'
        else:
            emoji_status = '✗'
        quote_status = '✓' if quote_enabled else '✗'
        quote_msg = self.combined_settings.get(
            'quote_system_message', '고객님이 견적을 조회하였습니다'
        )
        if quote_enabled and quote_msg:
            preview = quote_msg if len(quote_msg) <= 18 else quote_msg[:18] + '…'
            quote_status = f'✓ ({preview})'
        self.f2_summary_var.set(
            f'이모지: {emoji_status}  |  견적조회: {quote_status}  |  검색: 상위 {max_count}개'
        )

    MAX_LOG_LINES = 500
    
    def log(self = None, message = None):
        '''로그 메시지 출력 (최대 라인 수 제한)'''
        timestamp = datetime.now().strftime('%H:%M:%S')
        log_message = f'''{timestamp} - {message}\n'''
        self.log_text.config(state = 'normal')
        self.log_text.insert(tk.END, log_message)
        current_lines = int(self.log_text.index('end-1c').split('.')[0])
        if current_lines > self.MAX_LOG_LINES:
            delete_lines = (current_lines - self.MAX_LOG_LINES) + 100
            self.log_text.delete('1.0', f'''{delete_lines}.0''')
        self.log_text.see(tk.END)
        self.log_text.config(state = 'disabled')
        logger.info(message)

    
    def clear_log(self):
        '''로그 지우기'''
        self.log_text.config(state = 'normal')
        self.log_text.delete(1, tk.END)
        self.log_text.config(state = 'disabled')

    
    def load_saved_credentials(self):
        '''저장된 로그인 정보 및 설정 로드'''
        (email, password) = get_credentials()
        if email:
            self.email_var.set(email)
        if password:
            self.password_var.set(password)
        delay = self.config.get('delay_seconds', 1.5)
        self.delay_var.set(str(delay))
        recontact = self.config.get('recontact', { })
        if (
            recontact.get('keyword')
            or recontact.get('message')
            or recontact.get('texts')
            or recontact.get('send_order')
        ):
            self.recontact_settings = recontact.copy()
            self.update_recontact_summary()
        combined = self.config.get('combined', { })
        if combined:
            self.combined_settings = combined.copy()
            self.update_combined_summary()
        leave_hired_other = self.config.get('leave_hired_other', {})
        detection_text = leave_hired_other.get('detection_text')
        if detection_text:
            self.leave_hired_other_text_var.set(detection_text)
        return None

    
    def get_delay(self = None):
        
        try:
            return float(self.delay_var.get())
        except ValueError:
            return 1.5


    
    def get_period_days(self = None, settings_type = None):
        """
        기간 설정을 일수로 변환

        Args:
            settings_type: 'recontact' 또는 'combined'

        Returns:
            int: 기간 일수
        """
        if settings_type == 'combined':
            period_days, _ = resolve_recontact_period(self.combined_settings)
            return period_days
        period_days, _ = resolve_recontact_period(self.recontact_settings)
        return period_days

    def update_login_status(self, logged_in: bool):
        '''로그인 상태 UI 업데이트'''
        self.is_logged_in = logged_in
        if logged_in:
            self.login_status_var.set('● 로그인됨')
            self.login_status_label.config(foreground = 'green')
            return None
        self.login_status_var.set('● 미로그인')
        self.login_status_label.config(foreground = 'gray')

    def _execute_login(self, force: bool = False):
        '''
        로그인 수행 (백그라운드 스레드에서 호출 가능)

        Returns:
            (success, reason): reason = empty | already | browser | auth | success
        '''
        email = self.email_var.get().strip()
        password = self.password_var.get().strip()
        if not email or not password:
            return False, 'empty'

        if not force and self.browser.is_running() and is_logged_in(self.browser.driver):
            return True, 'already'

        if self.browser.is_running():
            self.browser.stop()

        if not self.browser.start():
            return False, 'browser'

        delay = self.get_delay()

        def login_log(message: str) -> None:
            self.root.after(0, lambda m=message: self.log(m))

        self.root.after(0, lambda: self.log('Chrome 시작 완료 — 숨고 로그인 진행'))
        if not login_to_soomgo(self.browser.driver, email, password, delay, log=login_log):
            self.browser.stop()
            return False, 'auth'

        if self.save_credentials_var.get():
            save_credentials(email, password, True)
        return True, 'success'

    def run_login(self):
        '''로그인 버튼 - 먼저 로그인'''
        if self.login_in_progress:
            return None
        if not self.email_var.get().strip() or not self.password_var.get().strip():
            messagebox.showwarning('경고', '이메일과 비밀번호를 입력하세요.')
            return None

        self.login_in_progress = True
        self.login_btn.config(state = 'disabled')
        self.log('로그인 시도 중...')

        def login_thread():
            try:
                success, reason = self._execute_login(force = True)

                def on_done():
                    self.login_in_progress = False
                    self.login_btn.config(state = 'normal')
                    if reason == 'browser':
                        self.update_login_status(False)
                        detail = self.browser.last_start_error or 'Chrome 브라우저를 시작할 수 없습니다.'
                        self.log(f'브라우저 시작 실패 - {detail.splitlines()[0]}')
                        messagebox.showerror('오류', detail)
                        return None
                    if reason == 'auth':
                        self.update_login_status(False)
                        self.log('로그인 실패 - 이메일 또는 비밀번호를 확인하세요.')
                        messagebox.showerror(
                            '로그인 실패',
                            '이메일 또는 비밀번호가 올바르지 않습니다.\n로그인 정보를 확인한 후 다시 시도하세요.',
                        )
                        return None
                    if success:
                        self.update_login_status(True)
                        self.log('로그인 성공!')
                        messagebox.showinfo('로그인', '로그인에 성공했습니다.\n이제 기능을 실행할 수 있습니다.')

                self.root.after(0, on_done)
            except Exception as e:
                def on_error():
                    self.login_in_progress = False
                    self.login_btn.config(state = 'normal')
                    self.update_login_status(False)
                    self.log(f'로그인 오류: {e}')

                self.root.after(0, on_error)

        threading.Thread(target = login_thread, daemon = True).start()

    def run_logout(self):
        '''로그아웃 - 브라우저 종료'''
        if self.current_feature or getattr(self, 'delete_feature', None) or getattr(
            self, 'leave_hired_other_feature', None
        ) or getattr(self, 'leave_stale_feature', None):
            messagebox.showwarning('경고', '기능 실행 중에는 로그아웃할 수 없습니다.')
            return None
        self.browser.stop()
        self.update_login_status(False)
        self.log('로그아웃 완료 (브라우저 종료)')

    def check_login(self = None):
        '''로그인 상태 확인 - 미로그인 시 자동 로그인 시도'''
        if self.login_in_progress:
            messagebox.showwarning('경고', '로그인 진행 중입니다. 잠시 후 다시 시도하세요.')
            return False

        success, reason = self._execute_login(force = False)
        if reason == 'empty':
            messagebox.showwarning('경고', '이메일과 비밀번호를 입력하세요.')
            return False
        if reason == 'browser':
            detail = self.browser.last_start_error or 'Chrome 브라우저를 시작할 수 없습니다.'
            self.log(f'브라우저 시작 실패 - {detail.splitlines()[0]}')
            messagebox.showerror('오류', detail)
            self.update_login_status(False)
            return False
        if reason == 'auth':
            self.log('로그인 실패 - 이메일 또는 비밀번호를 확인하세요.')
            messagebox.showerror(
                '로그인 실패',
                '이메일 또는 비밀번호가 올바르지 않습니다.\n로그인 정보를 확인한 후 다시 시도하세요.',
            )
            self.update_login_status(False)
            return False

        self.update_login_status(True)
        if reason == 'success':
            self.log('로그인 성공!')
        return True

    
    def set_buttons_state(self = None, running = None):
        state = 'disabled' if running else 'normal'
        self.f1_run_btn.config(state = state)
        self.f1_stop_btn.config(state = 'normal' if running else 'disabled')
        self.f2_run_btn.config(state = state)
        if running:
            self.f2_stop_btn.config(state = 'normal')
            self.f1_resume_btn.config(state='disabled')
            self.f2_resume_btn.config(state='disabled')
            return None
        self.f2_stop_btn.config(state='disabled')
        self.refresh_recontact_resume_button()
        self.refresh_combined_resume_button()

    def refresh_recontact_resume_button(self):
        try:
            from features.feature_run_queue import (
                FEATURE_RECONTACT,
                get_queue_summary,
                has_resumable_queue,
            )

            if has_resumable_queue(FEATURE_RECONTACT):
                self.f1_resume_btn.config(state='normal')
            else:
                self.f1_resume_btn.config(state='disabled')
        except Exception:
            pass

    def refresh_combined_resume_button(self):
        try:
            from features.feature_run_queue import (
                FEATURE_COMBINED,
                get_queue_summary,
                has_resumable_queue,
            )

            if has_resumable_queue(FEATURE_COMBINED):
                self.f2_resume_btn.config(state='normal')
                summary = get_queue_summary(FEATURE_COMBINED)
                self.f2_status_var.set(f'이어하기 가능 · {summary}')
                self.f2_status_label.config(foreground='orange')
            else:
                self.f2_resume_btn.config(state='disabled')
        except Exception:
            pass

    def run_recontact(self, *, resume: bool = False):
        '''재접촉 기능 실행'''
        if not self.check_login():
            return
        if not self.recontact_settings:
            messagebox.showwarning('경고', '먼저 설정을 완료하세요.')
            return

        from features.content_sender import (
            has_sendable_content,
            normalize_hired_other_content,
            normalize_recontact_content,
        )

        keyword = self.recontact_settings.get('keyword', '')
        texts, send_order = normalize_recontact_content(self.recontact_settings)
        hired_other_texts, hired_other_send_order, _, hired_other_enabled = (
            normalize_hired_other_content(self.recontact_settings)
        )

        if not keyword:
            messagebox.showwarning('경고', '설정에서 키워드를 입력하세요.')
            return

        images_folder = os.path.join(get_base_path(), 'images')
        general_ready = bool(
            send_order and has_sendable_content(texts, send_order, images_folder)
        )
        hired_other_ready = bool(
            hired_other_enabled
            and hired_other_send_order
            and has_sendable_content(
                hired_other_texts, hired_other_send_order, images_folder
            )
        )

        if not general_ready and not hired_other_ready:
            messagebox.showwarning(
                '경고',
                '일반 재접촉 또는 다른 고수 고용 탭에서 '
                '전송할 텍스트 또는 이미지 폴더를 설정하세요.',
            )
            return

        self.set_buttons_state(True)
        keywords = [kw.strip() for kw in keyword.replace('\n', ',').split(',') if kw.strip()]
        if len(keywords) > 1:
            keyword_display = f'{len(keywords)}개 키워드'
        else:
            first = keywords[0] if keywords else keyword
            keyword_display = first[:20] + '...' if len(first) > 20 else first

        log_parts = [
            f"재접촉 시작 (키워드: {keyword_display}, "
            f"기간: {self.recontact_settings.get('period', '오늘')}"
        ]
        if general_ready:
            log_parts.append(f"일반순서: {' → '.join(send_order)}")
        if hired_other_ready:
            log_parts.append(
                f"다른고수순서: {' → '.join(hired_other_send_order)}"
            )
        self.log(', '.join(log_parts) + ')')

        if resume:
            from features.feature_run_queue import (
                FEATURE_RECONTACT,
                get_queue_summary,
                has_resumable_queue,
            )

            if not has_resumable_queue(FEATURE_RECONTACT):
                messagebox.showinfo('이어하기', '이어할 재접촉 작업이 없습니다.')
                self.set_buttons_state(False)
                self.refresh_recontact_resume_button()
                return
            if not messagebox.askyesno(
                '이어하기',
                f'저장된 재접촉 작업을 이어합니다.\n{get_queue_summary(FEATURE_RECONTACT)}\n\n'
                '현재 설정(텍스트·전송순서)이 적용됩니다.\n'
                '이미 잘못 보낸 말풍선은 숨고에서 수동 정리가 필요할 수 있습니다.\n\n'
                '계속하시겠습니까?',
            ):
                self.set_buttons_state(False)
                return
            self.log(f'재접촉 이어하기 — {get_queue_summary(FEATURE_RECONTACT)}')

        def feature_thread():
            try:
                delay = self.get_delay()
                feature = RecontactFeature(self.browser.driver, delay)
                feature.set_log_callback(lambda msg: self.root.after(0, lambda m=msg: self.log(m)))
                self.current_feature = feature
                count = feature.run(self.recontact_settings, resume=resume)
                label = '재접촉 이어하기 완료' if resume else '재접촉 완료'
                self.root.after(0, lambda: self.log(f'{label}: {count}건 처리'))
            except Exception as e:
                self.root.after(0, lambda: self.log(f'재접촉 오류: {e}'))
            finally:
                self.current_feature = None
                self.root.after(0, lambda: self.set_buttons_state(False))
                self.root.after(0, self.refresh_recontact_resume_button)

        self.feature_thread = threading.Thread(target=feature_thread, daemon=True)
        self.feature_thread.start()

    def run_recontact_resume(self):
        self.run_recontact(resume=True)

    def run_combined(self, *, resume: bool = False):
        '''이모지/견적조회 통합 기능 실행'''
        if not self.check_login():
            return
        if not self.combined_settings:
            messagebox.showwarning('경고', '먼저 설정을 완료하세요.')
            return
        emoji_enabled = self.combined_settings.get('emoji_enabled', True)
        quote_enabled = self.combined_settings.get('quote_enabled', True)
        if not emoji_enabled and not quote_enabled:
            messagebox.showwarning('경고', '최소 하나의 조건을 활성화하세요.')
            return
        emoji = self.combined_settings.get('emoji', '').strip()
        if emoji_enabled and not emoji:
            messagebox.showwarning('경고', '이모지를 설정하세요.')
            return
        max_count = self.combined_settings.get('max_count', 20)
        test_mode = self.test_mode_var.get()
        mode_text = '[테스트 모드] ' if test_mode else ''
        self.set_buttons_state(True)

        if resume:
            from features.feature_run_queue import (
                FEATURE_COMBINED,
                get_queue_summary,
                has_resumable_queue,
            )

            if not has_resumable_queue(FEATURE_COMBINED):
                messagebox.showinfo('이어하기', '이어할 이모지/견적조회 작업이 없습니다.')
                self.set_buttons_state(False)
                self.refresh_combined_resume_button()
                return
            if not messagebox.askyesno(
                '이어하기',
                f'저장된 작업을 이어합니다.\n{get_queue_summary(FEATURE_COMBINED)}\n\n'
                '현재 설정(텍스트·이미지 순서)이 적용됩니다.\n'
                '이미 잘못 보낸 말풍선은 숨고에서 수동 정리가 필요할 수 있습니다.\n\n'
                '계속하시겠습니까?',
            ):
                self.set_buttons_state(False)
                return
            self.log(f'{mode_text}이모지/견적조회 이어하기 — {get_queue_summary(FEATURE_COMBINED)}')
        else:
            self.log(f'{mode_text}이모지/견적조회 시작 (상위 {max_count}개 확인)')

        def feature_thread():
            try:
                delay = self.get_delay()
                feature = CombinedFeature(self.browser.driver, delay)
                feature.set_log_callback(lambda msg: self.root.after(0, lambda m=msg: self.log(m)))
                feature.set_stats_callback(lambda stats: self.root.after(0, lambda s=stats: self.update_combined_stats(s)))
                feature.test_mode = test_mode
                self.current_feature = feature
                feature.run(self.combined_settings, resume=resume)
            except Exception as e:
                self.root.after(0, lambda: self.log(f'통합 기능 오류: {e}'))
            finally:
                self.current_feature = None
                self.root.after(0, lambda: self.set_buttons_state(False))
                self.root.after(0, lambda: self.update_combined_stats({}))
                self.root.after(0, self.refresh_combined_resume_button)

        self.feature_thread = threading.Thread(target=feature_thread, daemon=True)
        self.feature_thread.start()

    def run_combined_resume(self):
        self.run_combined(resume=True)

    
    def stop_feature(self):
        '''현재 실행 중인 기능 중지'''
        if self.current_feature:
            self.current_feature.stop()
            self.log('기능 중지 요청됨')
            return None

    
    def stop_recontact(self):
        '''재접촉 기능 중지'''
        if self.current_feature:
            self.current_feature.stop()
            self.log('재접촉 중지 요청됨')
            return None

    
    def clear_combined_records(self):
        '''통합 기능 처리 기록 초기화'''
        if self.current_feature and hasattr(self.current_feature, 'clear_processed'):
            self.current_feature.clear_processed()
        try:
            from features.feature_run_queue import FEATURE_COMBINED, clear_feature_queue

            clear_feature_queue(FEATURE_COMBINED)
        except Exception:
            pass
        self.f2_emoji_count_var.set('이모지: 0개')
        self.f2_quote_count_var.set('견적조회: 0개')
        self.f2_total_count_var.set('총: 0명')
        self.refresh_combined_resume_button()
        self.log('처리 기록·이어하기 큐 초기화 완료')

    
    def update_combined_stats(self = None, stats = None):
        '''통합 기능 처리 현황 업데이트'''
        emoji_count = stats.get('emoji_count', 0)
        quote_count = stats.get('quote_count', 0)
        total_count = stats.get('total_count', 0)
        start_time = stats.get('start_time', '')
        self.f2_emoji_count_var.set(f'''이모지: {emoji_count}개''')
        self.f2_quote_count_var.set(f'''견적조회: {quote_count}개''')
        self.f2_total_count_var.set(f'''총: {total_count}명''')
        if start_time:
            self.f2_status_var.set(f'''실행 중 ({start_time}~)''')
            self.f2_status_label.config(foreground = 'green')
            return None
        self.f2_status_var.set('대기 중')
        self.f2_status_label.config(foreground = 'gray')

    
    def run_delete(self):
        '''나간 채팅 삭제 기능 실행'''
        if not self.check_login():
            return
        detection_text = self.delete_text_var.get().strip()
        if not detection_text:
            messagebox.showwarning('경고', '감지 텍스트를 입력하세요.')
            return
        self.set_delete_buttons_state(True)
        self.delete_status_var.set('삭제 중...')
        self.delete_count_var.set('삭제: 0개')
        self.log(f"나간 채팅 삭제 시작 (감지: '{detection_text}')")

        def delete_thread():
            try:
                delay = self.get_delay()
                feature = DeleteLeftChatsFeature(self.browser.driver, delay)
                feature.set_log_callback(lambda msg: self.root.after(0, lambda m=msg: self.log(m)))
                self.delete_feature = feature
                count = feature.run(detection_text)
                self.root.after(0, lambda: self.delete_count_var.set(f'삭제: {count}개'))
                self.root.after(0, lambda: self.delete_status_var.set('완료'))
                self.root.after(0, lambda: self.log(f'삭제 완료: {count}개'))
            except Exception as e:
                self.root.after(0, lambda: self.log(f'삭제 오류: {e}'))
                self.root.after(0, lambda: self.delete_status_var.set('오류'))
            finally:
                self.delete_feature = None
                self.root.after(0, lambda: self.set_delete_buttons_state(False))

        threading.Thread(target=delete_thread, daemon=True).start()

    
    def stop_delete(self):
        '''삭제 기능 중지'''
        if hasattr(self, 'delete_feature'):
            if self.delete_feature:
                self.delete_feature.stop()
                self.log('삭제 기능 중지 요청됨')
                return None
            return None

    
    def set_delete_buttons_state(self = None, running = None):
        '''삭제 버튼 상태 설정'''
        self.delete_run_btn.config(state = 'disabled' if running else 'normal')
        if running:
            self.delete_stop_btn.config(state = 'normal')
            return None
        self.delete_stop_btn.config(state='disabled')

    def run_leave_hired_other(self):
        '''다른 고수 고용 방 나가기 실행'''
        if not self.check_login():
            return
        detection_text = self.leave_hired_other_text_var.get().strip()
        if not detection_text:
            messagebox.showwarning('경고', '감지 문구를 입력하세요.')
            return

        self.set_leave_hired_other_buttons_state(True)
        self.leave_hired_other_status_var.set('실행 중...')
        self.leave_hired_other_count_var.set('나감: 0개')
        self.log(f"다른 고수 고용 방 나가기 시작 (감지: '{detection_text}')")

        settings = {
            'detection_text': detection_text,
            'max_scrolls': self.config.get('leave_hired_other', {}).get('max_scrolls', 100),
        }

        def leave_thread():
            try:
                delay = self.get_delay()
                feature = LeaveHiredOtherChatsFeature(self.browser.driver, delay)
                feature.set_log_callback(
                    lambda msg: self.root.after(0, lambda m=msg: self.log(m))
                )
                self.leave_hired_other_feature = feature
                count = feature.run(settings)
                self.root.after(
                    0, lambda: self.leave_hired_other_count_var.set(f'나감: {count}개')
                )
                self.root.after(0, lambda: self.leave_hired_other_status_var.set('완료'))
                self.root.after(0, lambda: self.log(f'나가기 완료: {count}개'))
            except Exception as e:
                self.root.after(0, lambda: self.log(f'나가기 오류: {e}'))
                self.root.after(0, lambda: self.leave_hired_other_status_var.set('오류'))
            finally:
                self.leave_hired_other_feature = None
                self.root.after(0, lambda: self.set_leave_hired_other_buttons_state(False))

        threading.Thread(target=leave_thread, daemon=True).start()

    def stop_leave_hired_other(self):
        '''다른 고수 고용 방 나가기 중지'''
        if getattr(self, 'leave_hired_other_feature', None):
            self.leave_hired_other_feature.stop()
            self.log('나가기 기능 중지 요청됨')

    def set_leave_hired_other_buttons_state(self, running: bool):
        '''나가기 버튼 상태 설정'''
        self.leave_hired_other_run_btn.config(state='disabled' if running else 'normal')
        self.leave_hired_other_stop_btn.config(
            state='normal' if running else 'disabled'
        )

    def refresh_leave_stale_resume_button(self):
        '''저장된 큐 pending 있으면 이어하기 활성화'''
        try:
            from features.stale_chat_queue import get_queue_summary, has_resumable_queue

            if has_resumable_queue():
                self.leave_stale_resume_btn.config(state='normal')
                if getattr(self, 'leave_stale_status_var', None):
                    current = self.leave_stale_status_var.get()
                    if current in ('대기 중', '완료', '오류', '중단'):
                        self.leave_stale_status_var.set(
                            f'이어하기 가능 · {get_queue_summary()}'
                        )
            else:
                self.leave_stale_resume_btn.config(state='disabled')
        except Exception:
            pass

    def run_leave_stale(self, *, resume: bool = False):
        '''오래된 채팅 정리 실행 (미리보기 또는 실제 나가기)'''
        if not self.check_login():
            return
        dry_run = bool(self.leave_stale_dry_run_var.get())
        if not dry_run:
            if not messagebox.askyesno(
                '확인',
                '실제로 채팅방을 나갑니다. 되돌릴 수 없습니다.\n계속하시겠습니까?',
            ):
                return

        mode_label = '미리보기' if dry_run else '실행'
        self.set_leave_stale_buttons_state(True)
        self.leave_stale_status_var.set(f'{mode_label} 중...' if not resume else '이어하기 중...')
        self.leave_stale_count_var.set('예정: 0 · 유지: 0')
        if resume:
            self.log(f'오래된 채팅 정리 {mode_label} — 이어하기')
        else:
            self.log(f'오래된 채팅 정리 {mode_label} 시작')

        settings = {
            'dry_run': dry_run,
            'max_scrolls': self.config.get('leave_stale', {}).get('max_scrolls', 100),
            'resume': resume,
            'fresh': not resume,
        }

        def stale_thread():
            try:
                delay = self.get_delay()
                feature = LeaveStaleChatsFeature(self.browser.driver, delay)
                feature.set_log_callback(
                    lambda msg: self.root.after(0, lambda m=msg: self.log(m))
                )
                self.leave_stale_feature = feature
                result = feature.run(settings)
                left = result.get('left', 0)
                would = result.get('would_leave', 0)
                skip = result.get('skip', 0)
                if dry_run:
                    count_text = f'예정: {would} · 유지: {skip}'
                else:
                    count_text = f'나감: {left} · 유지: {skip}'
                self.root.after(0, lambda: self.leave_stale_count_var.set(count_text))
                self.root.after(0, lambda: self.leave_stale_status_var.set('완료'))
                self.root.after(
                    0,
                    lambda: self.log(
                        f'오래된 채팅 정리 {mode_label} 완료 — {count_text}'
                    ),
                )
            except Exception as e:
                self.root.after(0, lambda: self.log(f'오래된 채팅 정리 오류: {e}'))
                self.root.after(0, lambda: self.leave_stale_status_var.set('오류'))
            finally:
                self.leave_stale_feature = None
                self.root.after(0, lambda: self.set_leave_stale_buttons_state(False))
                self.root.after(0, self.refresh_leave_stale_resume_button)

        threading.Thread(target=stale_thread, daemon=True).start()

    def run_leave_stale_resume(self):
        '''중단된 오래된 채팅 정리 이어하기'''
        if not self.check_login():
            return
        from features.stale_chat_queue import has_resumable_queue, get_queue_summary

        if not has_resumable_queue():
            messagebox.showinfo('이어하기', '이어할 작업이 없습니다.')
            self.refresh_leave_stale_resume_button()
            return
        if not messagebox.askyesno(
            '이어하기',
            f'저장된 작업을 이어합니다.\n{get_queue_summary()}\n\n계속하시겠습니까?',
        ):
            return
        self.run_leave_stale(resume=True)

    def stop_leave_stale(self):
        '''오래된 채팅 정리 중지'''
        if getattr(self, 'leave_stale_feature', None):
            self.leave_stale_feature.stop()
            self.log('오래된 채팅 정리 중지 요청됨')

    def set_leave_stale_buttons_state(self, running: bool):
        '''오래된 채팅 정리 버튼 상태'''
        self.leave_stale_run_btn.config(state='disabled' if running else 'normal')
        self.leave_stale_stop_btn.config(state='normal' if running else 'disabled')
        if running:
            self.leave_stale_resume_btn.config(state='disabled')
        else:
            self.refresh_leave_stale_resume_button()

    def on_closing(self):
        '''창 닫기 이벤트 처리'''
        if self.current_feature:
            self.current_feature.stop()
        if hasattr(self, 'delete_feature') and self.delete_feature:
            self.delete_feature.stop()
        if hasattr(self, 'leave_hired_other_feature') and self.leave_hired_other_feature:
            self.leave_hired_other_feature.stop()
        if hasattr(self, 'leave_stale_feature') and self.leave_stale_feature:
            self.leave_stale_feature.stop()
        self.browser.stop()
        self.config['delay_seconds'] = self.get_delay()
        self.config['recontact'] = self.recontact_settings.copy() if self.recontact_settings else { }
        self.config['combined'] = self.combined_settings.copy() if self.combined_settings else { }
        self.config['leave_hired_other'] = {
            'detection_text': self.leave_hired_other_text_var.get().strip(),
            'max_scrolls': self.config.get('leave_hired_other', {}).get('max_scrolls', 100),
        }
        self.config['leave_stale'] = {
            'dry_run': bool(getattr(self, 'leave_stale_dry_run_var', tk.BooleanVar(value=True)).get()),
            'max_scrolls': self.config.get('leave_stale', {}).get('max_scrolls', 100),
        }
        if self.save_credentials_var.get():
            self.config['save_credentials'] = True
            self.config['email'] = self.email_var.get().strip()
            self.config['password'] = self.password_var.get().strip()
        else:
            self.config['save_credentials'] = False
            self.config['email'] = ''
            self.config['password'] = ''
        save_config(self.config)
        self.root.destroy()



def _write_startup_crash_log(exc: BaseException) -> None:
    import traceback

    try:
        from desktop.config import APP_DATA_DIR, ensure_app_data

        ensure_app_data()
        log_path = APP_DATA_DIR / 'startup.log'
        log_path.write_text(
            traceback.format_exc(),
            encoding='utf-8',
        )
    except Exception:
        pass


def main():
    '''메인 함수'''
    try:
        root = tk.Tk()
        app = SoomgoAutomationApp(root)
        root.mainloop()
    except Exception as exc:
        _write_startup_crash_log(exc)
        raise


if __name__ == '__main__':
    main()
