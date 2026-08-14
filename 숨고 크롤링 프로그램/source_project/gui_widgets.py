"""숨고 채팅 자동화 GUI 위젯 모듈"""

import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox

from automation.selectors import SYSTEM_MESSAGES
from features.recontact import PERIOD_CHOICES, PERIOD_LABEL_TO_DAYS


def _text_sort_key(key):
    try:
        return int(key.replace('텍스트', ''))
    except ValueError:
        return 0


def _resolve_get_base_path(get_base_path_fn=None):
    if get_base_path_fn is not None:
        return get_base_path_fn
    try:
        from main import get_base_path
        path = get_base_path()
        if path is not None:
            return get_base_path
    except ImportError:
        pass

    def _fallback():
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.abspath(__file__))

    return _fallback


class TextEditorFrame(ttk.Frame):
    """드롭다운으로 텍스트 선택 + 아래 편집하는 위젯"""

    def __init__(self, parent, on_texts_changed=None):
        super().__init__(parent)
        self.texts = {'텍스트1': '', '텍스트2': ''}
        self.current_key = '텍스트1'
        self.on_texts_changed = on_texts_changed
        self.create_widgets()

    def create_widgets(self):
        top_frame = ttk.Frame(self)
        top_frame.pack(fill='x', pady=(0, 5))

        ttk.Label(top_frame, text='텍스트 선택:').pack(side='left')

        self.text_var = tk.StringVar(value='텍스트1')
        self.text_combo = ttk.Combobox(
            top_frame,
            textvariable=self.text_var,
            values=list(self.texts.keys()),
            state='readonly',
            width=12,
        )
        self.text_combo.pack(side='left', padx=5)
        self.text_combo.bind('<<ComboboxSelected>>', self.on_select_change)

        ttk.Button(top_frame, text='+ 추가', command=self.add_text, width=8).pack(
            side='left', padx=2
        )
        ttk.Button(top_frame, text='- 삭제', command=self.delete_text, width=8).pack(
            side='left', padx=2
        )

        self.text_widget = tk.Text(self, height=9, width=70)
        self.text_widget.pack(fill='both', expand=True)

    def on_select_change(self, event=None):
        """드롭다운 변경 시 - 현재 내용 저장 후 새 텍스트 로드"""
        self.texts[self.current_key] = self.text_widget.get('1.0', tk.END).strip()
        self.current_key = self.text_var.get()
        self.text_widget.delete('1.0', tk.END)
        self.text_widget.insert('1.0', self.texts.get(self.current_key, ''))

    def add_text(self):
        """텍스트3, 텍스트4, ... 추가"""
        self.texts[self.current_key] = self.text_widget.get('1.0', tk.END).strip()

        existing_nums = []
        for key in self.texts.keys():
            try:
                num = int(key.replace('텍스트', ''))
                existing_nums.append(num)
            except ValueError:
                pass

        new_num = max(existing_nums) + 1 if existing_nums else 1
        new_key = f'텍스트{new_num}'

        self.texts[new_key] = ''
        self.update_combo()

        self.text_var.set(new_key)
        self.on_select_change()

        if self.on_texts_changed:
            self.on_texts_changed(list(self.texts.keys()))

    def delete_text(self):
        """현재 선택된 텍스트 삭제 (최소 1개는 유지)"""
        if len(self.texts) <= 1:
            messagebox.showwarning(
                '경고', '최소 1개의 텍스트는 필요합니다.', parent=self
            )
            return

        del self.texts[self.current_key]
        self.update_combo()

        first_key = sorted(self.texts.keys(), key=_text_sort_key)[0]
        self.current_key = first_key
        self.text_var.set(first_key)
        self.text_widget.delete('1.0', tk.END)
        self.text_widget.insert('1.0', self.texts.get(first_key, ''))

        if self.on_texts_changed:
            self.on_texts_changed(list(self.texts.keys()))

    def update_combo(self):
        """드롭다운 목록 업데이트"""
        keys = sorted(self.texts.keys(), key=_text_sort_key)
        self.text_combo['values'] = keys

    def get_all_texts(self) -> dict:
        """저장용 데이터 반환"""
        self.texts[self.current_key] = self.text_widget.get('1.0', tk.END).strip()
        return dict(self.texts)

    def get_text_keys(self) -> list:
        """텍스트 키 목록 반환"""
        return sorted(self.texts.keys(), key=_text_sort_key)

    def set_texts(self, texts: dict):
        """로드용"""
        if texts:
            self.texts = dict(texts)
        else:
            self.texts = {'텍스트1': '', '텍스트2': ''}

        self.update_combo()

        first_key = sorted(self.texts.keys(), key=_text_sort_key)[0]
        self.current_key = first_key
        self.text_var.set(first_key)
        self.text_widget.delete('1.0', tk.END)
        self.text_widget.insert('1.0', self.texts.get(first_key, ''))


class SendOrderFrame(ttk.Frame):
    """전송 순서 설정 위젯"""

    SCROLL_HEIGHT = 220

    def __init__(self, parent, get_available_items):
        super().__init__(parent)
        self.get_available_items = get_available_items
        self.order_rows = []
        self.create_widgets()

    def create_widgets(self):
        title_frame = ttk.Frame(self)
        title_frame.pack(fill='x', pady=(0, 5))

        ttk.Label(title_frame, text='전송 순서:', font=('', 9, 'bold')).pack(side='left')
        ttk.Button(
            title_frame, text='+ 추가', command=self.add_order_item, width=8
        ).pack(side='right')

        scroll_container = ttk.Frame(self)
        scroll_container.pack(fill='both', expand=True)

        self.canvas = tk.Canvas(
            scroll_container,
            height=self.SCROLL_HEIGHT,
            highlightthickness=0,
        )
        scrollbar = ttk.Scrollbar(
            scroll_container, orient='vertical', command=self.canvas.yview
        )
        self.canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side='right', fill='y')
        self.canvas.pack(side='left', fill='both', expand=True)

        self.list_frame = ttk.Frame(self.canvas)
        self._list_window = self.canvas.create_window(
            (0, 0), window=self.list_frame, anchor='nw'
        )

        self.list_frame.bind('<Configure>', self._on_list_configure)
        self.canvas.bind('<Configure>', self._on_canvas_configure)
        self._bind_mousewheel(self.canvas)
        self._bind_mousewheel(self.list_frame)

    def _on_list_configure(self, event=None):
        self.canvas.configure(scrollregion=self.canvas.bbox('all'))

    def _on_canvas_configure(self, event):
        self.canvas.itemconfig(self._list_window, width=event.width)

    def _bind_mousewheel(self, widget):
        def _on_mousewheel(event):
            if self.canvas.bbox('all') is None:
                return
            canvas_height = self.canvas.winfo_height()
            content_height = self.list_frame.winfo_reqheight()
            if content_height <= canvas_height:
                return
            self.canvas.yview_scroll(int(-1 * (event.delta / 120)), 'units')

        widget.bind('<Enter>', lambda _e: widget.bind_all('<MouseWheel>', _on_mousewheel))
        widget.bind('<Leave>', lambda _e: widget.unbind_all('<MouseWheel>'))

    def _refresh_scroll(self):
        self.update_idletasks()
        self._on_list_configure()

    def add_order_item(self, default_value=None):
        """순서 항목 추가"""
        row_frame = ttk.Frame(self.list_frame)
        row_frame.pack(fill='x', pady=2)

        order_num = len(self.order_rows) + 1
        label = ttk.Label(row_frame, text=f'{order_num}.', width=3)
        label.pack(side='left')

        var = tk.StringVar()
        combo = ttk.Combobox(
            row_frame, textvariable=var, state='readonly', width=15
        )
        combo['values'] = self.get_available_items()
        combo.pack(side='left', padx=5)

        if default_value and default_value in combo['values']:
            var.set(default_value)
        elif combo['values']:
            var.set(combo['values'][0])

        delete_btn = ttk.Button(
            row_frame,
            text='X',
            width=3,
            command=lambda rf=row_frame: self.delete_order_item(rf),
        )
        delete_btn.pack(side='left', padx=2)

        self.order_rows.append((row_frame, combo, var, label))
        self._refresh_scroll()

    def delete_order_item(self, row_frame):
        """순서 항목 삭제"""
        if len(self.order_rows) <= 1:
            messagebox.showwarning(
                '경고', '최소 1개의 항목은 필요합니다.', parent=self
            )
            return

        for i, (frame, combo, var, label) in enumerate(self.order_rows):
            if frame is row_frame:
                frame.destroy()
                self.order_rows.pop(i)
                break

        self.renumber_items()
        self._refresh_scroll()

    def renumber_items(self):
        """순서 번호 재정렬"""
        for i, (frame, combo, var, label) in enumerate(self.order_rows):
            label.config(text=f'{i + 1}.')

    def update_available_items(self):
        """드롭다운 선택지 업데이트"""
        items = self.get_available_items()
        for frame, combo, var, label in self.order_rows:
            current = var.get()
            combo['values'] = items
            if current not in items and items:
                var.set(items[0])

    def get_order(self) -> list:
        """['이미지폴더1', '텍스트1', ...] 반환"""
        return [var.get() for frame, combo, var, label in self.order_rows if var.get()]

    def set_order(self, order: list):
        """로드용"""
        for frame, combo, var, label in self.order_rows:
            frame.destroy()
        self.order_rows.clear()

        if order:
            for item in order:
                self.add_order_item(default_value=item)
            self._refresh_scroll()
            return

        available = self.get_available_items()
        for item in available:
            self.add_order_item(default_value=item)
        self._refresh_scroll()

    def clear_and_set_default(self):
        """초기화하고 기본값 설정"""
        for frame, combo, var, label in self.order_rows:
            frame.destroy()
        self.order_rows.clear()

        available = self.get_available_items()
        for item in available:
            self.add_order_item(default_value=item)
        self._refresh_scroll()


class RecontactSettingsDialog(tk.Toplevel):
    """재접촉 설정 팝업 - 키워드·기간·텍스트·이미지 전송 순서"""

    def __init__(self, parent, current_settings: dict, get_base_path_fn=None):
        super().__init__(parent)
        self.title('재접촉 설정')
        self.geometry('750x900')
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()

        self.result = None
        self.current_settings = current_settings or {}
        self._get_base_path = _resolve_get_base_path(get_base_path_fn)
        self.images_folder = os.path.join(self._get_base_path(), 'images')

        self.create_widgets()
        self.load_settings()
        self.load_images_info()

        self.update_idletasks()
        x = (self.winfo_screenwidth() - self.winfo_width()) // 2
        y = (self.winfo_screenheight() - self.winfo_height()) // 2
        self.geometry(f'+{x}+{y}')

    def get_image_folders(self) -> list:
        folders = []
        if os.path.exists(self.images_folder):
            for name in os.listdir(self.images_folder):
                folder_path = os.path.join(self.images_folder, name)
                if os.path.isdir(folder_path) and name.isdigit():
                    folders.append(int(name))
        return sorted(folders)

    def get_general_available_items(self) -> list:
        items = [f'이미지폴더{n}' for n in self.get_image_folders()]
        items += self.general_text_editor.get_text_keys()
        return items

    def get_hired_other_available_items(self) -> list:
        items = [f'이미지폴더{n}' for n in self.get_image_folders()]
        items += self.hired_other_text_editor.get_text_keys()
        return items

    def on_general_texts_changed(self, text_keys: list):
        self.general_send_order.update_available_items()

    def on_hired_other_texts_changed(self, text_keys: list):
        self.hired_other_send_order.update_available_items()

    def load_images_info(self):
        info_parts = []
        for folder_num in self.get_image_folders():
            folder_path = os.path.join(self.images_folder, str(folder_num))
            files = [
                f
                for f in os.listdir(folder_path)
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))
            ]
            if files:
                info_parts.append(f'폴더{folder_num}: {len(files)}장')

        if info_parts:
            self.images_info_var.set(' | '.join(info_parts))
        else:
            self.images_info_var.set(
                '이미지 없음 (images/1,2,3,... 폴더에 이미지 추가)'
            )

        if hasattr(self, 'general_send_order'):
            self.general_send_order.update_available_items()
        if hasattr(self, 'hired_other_send_order'):
            self.hired_other_send_order.update_available_items()

    def create_widgets(self):
        main_frame = ttk.Frame(self, padding='15')
        main_frame.pack(fill=tk.BOTH, expand=True)

        keyword_label_frame = ttk.Frame(main_frame)
        keyword_label_frame.pack(fill='x', pady=(0, 5))
        ttk.Label(
            keyword_label_frame, text='찾을 키워드:', font=('', 10, 'bold')
        ).pack(side='left')
        ttk.Label(
            keyword_label_frame,
            text='(쉼표 또는 줄바꿈으로 여러 개 입력 가능)',
            font=('', 8),
        ).pack(side='left', padx=10)

        self.keyword_text = tk.Text(main_frame, height=3, width=80)
        self.keyword_text.pack(fill='x', pady=(0, 10))

        period_frame = ttk.Frame(main_frame)
        period_frame.pack(fill='x', pady=(0, 10))
        ttk.Label(period_frame, text='검색 기간:', font=('', 10, 'bold')).pack(
            side='left'
        )

        self.period_var = tk.StringVar(value='오늘')
        period_combo = ttk.Combobox(
            period_frame,
            textvariable=self.period_var,
            width=15,
            state='readonly',
        )
        period_combo['values'] = PERIOD_CHOICES
        period_combo.pack(side='left', padx=10)
        ttk.Label(
            period_frame,
            text='(오늘·N일전·전체 — 위에서부터 스크롤하며 기간 밖 채팅이 연속되면 종료)',
            font=('', 9),
        ).pack(side='left')

        img_frame = ttk.LabelFrame(main_frame, text='이미지 설정', padding='10')
        img_frame.pack(fill='x', pady=(0, 10))

        ttk.Label(
            img_frame,
            text='이미지 폴더: images/1, 2, 3, ... (숫자 폴더 자동 인식)',
            font=('', 9),
        ).pack(anchor='w')

        self.images_info_var = tk.StringVar(value='로딩 중...')
        ttk.Label(
            img_frame, textvariable=self.images_info_var, font=('', 9, 'bold')
        ).pack(anchor='w', pady=(5, 0))

        img_btn_frame = ttk.Frame(img_frame)
        img_btn_frame.pack(fill='x', pady=(10, 0))
        ttk.Button(
            img_btn_frame, text='이미지 폴더 열기', command=self.open_images_folder
        ).pack(side='left')
        ttk.Button(
            img_btn_frame, text='새로고침', command=self.load_images_info
        ).pack(side='left', padx=10)

        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill='both', expand=True, pady=(0, 10))

        general_tab = ttk.Frame(notebook, padding='10')
        notebook.add(general_tab, text='일반 재접촉')
        self._create_general_tab(general_tab)

        hired_me_tab = ttk.Frame(notebook, padding='10')
        notebook.add(hired_me_tab, text='내 고용 제외')
        self._create_hired_me_tab(hired_me_tab)

        hired_other_tab = ttk.Frame(notebook, padding='10')
        notebook.add(hired_other_tab, text='다른 고수 고용')
        self._create_hired_other_tab(hired_other_tab)

        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill='x', pady=(10, 0))
        ttk.Button(btn_frame, text='저장', command=self.save, width=15).pack(
            side='right', padx=5
        )
        ttk.Button(btn_frame, text='취소', command=self.cancel, width=15).pack(
            side='right', padx=5
        )

    def _create_general_tab(self, parent):
        text_frame = ttk.LabelFrame(parent, text='텍스트 설정', padding='10')
        text_frame.pack(fill='both', expand=True, pady=(0, 10))
        self.general_text_editor = TextEditorFrame(
            text_frame, on_texts_changed=self.on_general_texts_changed
        )
        self.general_text_editor.pack(fill='both', expand=True)

        order_frame = ttk.LabelFrame(parent, text='전송 순서 설정', padding='10')
        order_frame.pack(fill='x')
        self.general_send_order = SendOrderFrame(
            order_frame, get_available_items=self.get_general_available_items
        )
        self.general_send_order.pack(fill='x')

    def _create_hired_me_tab(self, parent):
        row1 = ttk.Frame(parent)
        row1.pack(fill='x', pady=(0, 10))

        self.hired_me_enabled_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            row1, text='활성화 (이미 고용된 고객 재접촉 제외)', variable=self.hired_me_enabled_var
        ).pack(side='left')

        sys_frame = ttk.LabelFrame(
            parent, text='배지 감지 (채팅 목록 행 텍스트)', padding='10'
        )
        sys_frame.pack(fill='x', pady=(0, 10))
        ttk.Label(sys_frame, text='감지 문구:').pack(anchor='w')
        self.hired_me_filter_text_var = tk.StringVar(value=SYSTEM_MESSAGES['HIRED_ME'])
        ttk.Entry(
            sys_frame, textvariable=self.hired_me_filter_text_var, width=60
        ).pack(fill='x', pady=(5, 0))
        ttk.Label(
            sys_frame,
            text='(이름 옆 "내 고용" 배지 등 — 띄어쓰기 무시, 문구 포함 시 재접촉 대상에서 제외)',
            font=('', 8),
        ).pack(anchor='w', pady=(5, 0))

        info_frame = ttk.LabelFrame(parent, text='동작 안내', padding='10')
        info_frame.pack(fill='both', expand=True)
        ttk.Label(
            info_frame,
            text=(
                '• 활성화 시 채팅 목록에 감지 문구가 있는 고객은 메시지를 보내지 않습니다.\n'
                '• "내 고용", "내고용"처럼 띄어쓰기가 달라도 동일하게 감지합니다.\n'
                '• 일반 재접촉·다른 고수 고용 분기 모두에 적용됩니다.'
            ),
            font=('', 9),
            justify='left',
        ).pack(anchor='w')

    def _create_hired_other_tab(self, parent):
        row1 = ttk.Frame(parent)
        row1.pack(fill='x', pady=(0, 10))

        self.hired_other_enabled_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            row1, text='활성화', variable=self.hired_other_enabled_var
        ).pack(side='left')

        sys_frame = ttk.LabelFrame(
            parent, text='배지 감지 (채팅 목록 행 텍스트)', padding='10'
        )
        sys_frame.pack(fill='x', pady=(0, 10))
        ttk.Label(sys_frame, text='감지 문구:').pack(anchor='w')
        self.hired_other_system_message_var = tk.StringVar(
            value=SYSTEM_MESSAGES['HIRED_OTHER']
        )
        ttk.Entry(
            sys_frame, textvariable=self.hired_other_system_message_var, width=60
        ).pack(fill='x', pady=(5, 0))
        ttk.Label(
            sys_frame,
            text='(채팅 목록에 "다른 고수를 고용함" 배지가 있을 때 이 탭의 내용을 전송)',
            font=('', 8),
        ).pack(anchor='w', pady=(5, 0))

        text_frame = ttk.LabelFrame(parent, text='텍스트 설정', padding='10')
        text_frame.pack(fill='both', expand=True, pady=(0, 10))
        self.hired_other_text_editor = TextEditorFrame(
            text_frame, on_texts_changed=self.on_hired_other_texts_changed
        )
        self.hired_other_text_editor.pack(fill='both', expand=True)

        order_frame = ttk.LabelFrame(parent, text='전송 순서 설정', padding='10')
        order_frame.pack(fill='x')
        self.hired_other_send_order = SendOrderFrame(
            order_frame, get_available_items=self.get_hired_other_available_items
        )
        self.hired_other_send_order.pack(fill='x')

    def open_images_folder(self):
        if not os.path.exists(self.images_folder):
            os.makedirs(self.images_folder, exist_ok=True)
        os.startfile(self.images_folder)

    def load_settings(self):
        if not self.current_settings:
            self.after(100, lambda: self.general_send_order.clear_and_set_default())
            self.after(100, lambda: self.hired_other_send_order.clear_and_set_default())
            return

        self.keyword_text.insert('1.0', self.current_settings.get('keyword', ''))
        saved_period = self.current_settings.get('period', '오늘')
        if saved_period not in PERIOD_LABEL_TO_DAYS:
            saved_period = '오늘'
        self.period_var.set(saved_period)

        if 'texts' in self.current_settings:
            self.general_text_editor.set_texts(self.current_settings['texts'])
        else:
            legacy_message = self.current_settings.get('message', '')
            self.general_text_editor.set_texts({'텍스트1': legacy_message})

        self.hired_other_enabled_var.set(
            bool(self.current_settings.get('hired_other_enabled', False))
        )
        self.hired_me_enabled_var.set(
            bool(self.current_settings.get('hired_me_enabled', True))
        )
        self.hired_me_filter_text_var.set(
            self.current_settings.get(
                'hired_me_filter_text', SYSTEM_MESSAGES['HIRED_ME']
            )
        )
        self.hired_other_system_message_var.set(
            self.current_settings.get(
                'hired_other_system_message', SYSTEM_MESSAGES['HIRED_OTHER']
            )
        )
        hired_other_texts = self.current_settings.get('hired_other_texts') or {'텍스트1': ''}
        self.hired_other_text_editor.set_texts(hired_other_texts)

        self.after(100, self._load_send_orders)

    def _load_send_orders(self):
        if 'send_order' in self.current_settings:
            self.general_send_order.set_order(self.current_settings['send_order'])
        else:
            self.general_send_order.clear_and_set_default()

        if 'hired_other_send_order' in self.current_settings:
            self.hired_other_send_order.set_order(
                self.current_settings['hired_other_send_order']
            )
        else:
            self.hired_other_send_order.clear_and_set_default()

    def _has_sendable(self, texts: dict, send_order: list) -> bool:
        has_text = any(text.strip() for text in texts.values())
        has_image = any(item.startswith('이미지폴더') for item in send_order)
        return bool(send_order) and (has_text or has_image)

    def save(self):
        keyword = self.keyword_text.get('1.0', tk.END).strip()
        texts = self.general_text_editor.get_all_texts()
        send_order = self.general_send_order.get_order()
        hired_other_enabled = self.hired_other_enabled_var.get()
        hired_me_enabled = self.hired_me_enabled_var.get()
        hired_me_filter_text = (
            self.hired_me_filter_text_var.get().strip() or SYSTEM_MESSAGES['HIRED_ME']
        )
        hired_other_system_message = (
            self.hired_other_system_message_var.get().strip()
            or SYSTEM_MESSAGES['HIRED_OTHER']
        )
        hired_other_texts = self.hired_other_text_editor.get_all_texts()
        hired_other_send_order = self.hired_other_send_order.get_order()

        if not keyword:
            messagebox.showwarning('경고', '키워드를 입력하세요.', parent=self)
            return

        if hired_me_enabled and not self.hired_me_filter_text_var.get().strip():
            messagebox.showwarning(
                '경고', '내 고용 제외 감지 문구를 입력하세요.', parent=self
            )
            return

        general_valid = self._has_sendable(texts, send_order)
        hired_other_valid = (
            hired_other_enabled
            and self._has_sendable(hired_other_texts, hired_other_send_order)
        )

        if not general_valid and not hired_other_valid:
            messagebox.showwarning(
                '경고',
                '일반 재접촉 또는 다른 고수 고용 탭에서 '
                '전송 순서와 텍스트/이미지를 설정하세요.',
                parent=self,
            )
            return

        legacy_message = texts.get('텍스트1', '').strip()
        if not legacy_message:
            for key in sorted(texts.keys(), key=_text_sort_key):
                if texts.get(key, '').strip():
                    legacy_message = texts[key].strip()
                    break

        self.result = {
            'keyword': keyword,
            'message': legacy_message,
            'period': self.period_var.get(),
            'texts': texts,
            'send_order': send_order,
            'hired_me_enabled': hired_me_enabled,
            'hired_me_filter_text': hired_me_filter_text,
            'hired_other_enabled': hired_other_enabled,
            'hired_other_system_message': hired_other_system_message,
            'hired_other_texts': hired_other_texts,
            'hired_other_send_order': hired_other_send_order,
        }
        self.destroy()

    def cancel(self):
        self.destroy()


class CombinedSettingsDialog(tk.Toplevel):
    """이모지/견적조회 설정 팝업 (탭 방식) - 동적 텍스트 + 전송 순서 설정"""

    def __init__(self, parent, current_settings: dict, get_base_path_fn=None):
        super().__init__(parent)
        self.title('이모지/견적조회 설정')
        self.geometry('750x900')
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()

        self.result = None
        self.current_settings = current_settings
        self._get_base_path = _resolve_get_base_path(get_base_path_fn)
        self.images_folder = os.path.join(self._get_base_path(), 'images')

        self.create_widgets()
        self.load_settings()
        self.load_images_info()

        self.update_idletasks()
        x = (self.winfo_screenwidth() - self.winfo_width()) // 2
        y = (self.winfo_screenheight() - self.winfo_height()) // 2
        self.geometry(f'+{x}+{y}')

    def get_image_folders(self) -> list:
        """이미지 폴더 목록 반환 (숫자 폴더만)"""
        folders = []
        if os.path.exists(self.images_folder):
            for name in os.listdir(self.images_folder):
                folder_path = os.path.join(self.images_folder, name)
                if os.path.isdir(folder_path) and name.isdigit():
                    folders.append(int(name))
        return sorted(folders)

    def get_emoji_available_items(self) -> list:
        """이모지 탭용 - 이미지 폴더 + 텍스트 목록"""
        items = [f'이미지폴더{n}' for n in self.get_image_folders()]
        items += self.emoji_text_editor.get_text_keys()
        return items

    def get_quote_available_items(self) -> list:
        """견적조회 탭용 - 이미지 폴더 + 텍스트 목록"""
        items = [f'이미지폴더{n}' for n in self.get_image_folders()]
        items += self.quote_text_editor.get_text_keys()
        return items

    def on_emoji_texts_changed(self, text_keys: list):
        """이모지 텍스트 변경 시 전송 순서 업데이트"""
        self.emoji_send_order.update_available_items()

    def on_quote_texts_changed(self, text_keys: list):
        """견적조회 텍스트 변경 시 전송 순서 업데이트"""
        self.quote_send_order.update_available_items()

    def load_images_info(self):
        """images 폴더의 이미지 정보 로드"""
        info_parts = []
        for folder_num in self.get_image_folders():
            folder_path = os.path.join(self.images_folder, str(folder_num))
            files = [
                f
                for f in os.listdir(folder_path)
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))
            ]
            if files:
                info_parts.append(f'폴더{folder_num}: {len(files)}장')

        if info_parts:
            self.images_info_var.set(' | '.join(info_parts))
        else:
            self.images_info_var.set(
                '이미지 없음 (images/1,2,3,... 폴더에 이미지 추가)'
            )

        if hasattr(self, 'emoji_send_order'):
            self.emoji_send_order.update_available_items()
        if hasattr(self, 'quote_send_order'):
            self.quote_send_order.update_available_items()

    def create_widgets(self):
        main_frame = ttk.Frame(self, padding='15')
        main_frame.pack(fill=tk.BOTH, expand=True)

        img_frame = ttk.LabelFrame(main_frame, text='공통 이미지 설정', padding='10')
        img_frame.pack(fill='x', pady=(0, 10))

        ttk.Label(
            img_frame,
            text='이미지 폴더: images/1, 2, 3, ... (숫자 폴더 자동 인식)',
            font=('', 9),
        ).pack(anchor='w')

        self.images_info_var = tk.StringVar(value='로딩 중...')
        ttk.Label(
            img_frame, textvariable=self.images_info_var, font=('', 9, 'bold')
        ).pack(anchor='w', pady=(5, 0))

        img_btn_frame = ttk.Frame(img_frame)
        img_btn_frame.pack(fill='x', pady=(10, 0))
        ttk.Button(
            img_btn_frame, text='이미지 폴더 열기', command=self.open_images_folder
        ).pack(side='left')
        ttk.Button(
            img_btn_frame, text='새로고침', command=self.load_images_info
        ).pack(side='left', padx=10)

        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill='both', expand=True, pady=(0, 10))

        emoji_tab = ttk.Frame(notebook, padding='10')
        notebook.add(emoji_tab, text='이모지 조건')
        self.create_emoji_tab(emoji_tab)

        quote_tab = ttk.Frame(notebook, padding='10')
        notebook.add(quote_tab, text='견적조회 조건')
        self.create_quote_tab(quote_tab)

        common_frame = ttk.LabelFrame(main_frame, text='공통 설정', padding='10')
        common_frame.pack(fill='x', pady=(5, 10))

        count_row = ttk.Frame(common_frame)
        count_row.pack(fill='x', pady=5)
        ttk.Label(count_row, text='검색 개수:').pack(side='left')
        self.max_count_var = tk.StringVar(value='20')
        ttk.Spinbox(
            count_row,
            from_=5,
            to=100,
            increment=5,
            textvariable=self.max_count_var,
            width=8,
        ).pack(side='left', padx=10)
        ttk.Label(
            count_row,
            text='(상위 N개 채팅방만 확인 후 새로고침)',
            font=('', 8),
        ).pack(side='left')

        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill='x')
        ttk.Button(btn_frame, text='저장', command=self.save, width=15).pack(
            side='right', padx=5
        )
        ttk.Button(btn_frame, text='취소', command=self.cancel, width=15).pack(
            side='right', padx=5
        )

    def open_images_folder(self):
        """이미지 폴더 열기"""
        if not os.path.exists(self.images_folder):
            os.makedirs(self.images_folder, exist_ok=True)
        os.startfile(self.images_folder)

    def create_emoji_tab(self, parent):
        """이모지 조건 탭 생성"""
        row1 = ttk.Frame(parent)
        row1.pack(fill='x', pady=(0, 10))

        self.emoji_enabled_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(row1, text='활성화', variable=self.emoji_enabled_var).pack(
            side='left'
        )
        ttk.Label(row1, text='찾을 이모지:').pack(side='left', padx=(30, 5))
        self.emoji_var = tk.StringVar()
        ttk.Entry(row1, textvariable=self.emoji_var, width=15).pack(side='left')
        ttk.Label(row1, text='(내가 보낸 메시지 중)', font=('', 8)).pack(
            side='left', padx=10
        )

        text_frame = ttk.LabelFrame(parent, text='텍스트 설정', padding='10')
        text_frame.pack(fill='both', expand=True, pady=(0, 10))
        self.emoji_text_editor = TextEditorFrame(
            text_frame, on_texts_changed=self.on_emoji_texts_changed
        )
        self.emoji_text_editor.pack(fill='both', expand=True)

        order_frame = ttk.LabelFrame(parent, text='전송 순서 설정', padding='10')
        order_frame.pack(fill='x', pady=(0, 0))
        self.emoji_send_order = SendOrderFrame(
            order_frame, get_available_items=self.get_emoji_available_items
        )
        self.emoji_send_order.pack(fill='x')

    def create_quote_tab(self, parent):
        """견적조회 조건 탭 생성"""
        row1 = ttk.Frame(parent)
        row1.pack(fill='x', pady=(0, 10))

        self.quote_enabled_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(row1, text='활성화', variable=self.quote_enabled_var).pack(
            side='left'
        )

        sys_frame = ttk.LabelFrame(
            parent, text='시스템 메시지 감지 (견적조회 조건)', padding='10'
        )
        sys_frame.pack(fill='x', pady=(0, 10))
        ttk.Label(
            sys_frame,
            text='감지 문구:',
        ).pack(anchor='w')
        self.quote_system_message_var = tk.StringVar(
            value=SYSTEM_MESSAGES['QUOTE_VIEW']
        )
        ttk.Entry(
            sys_frame, textvariable=self.quote_system_message_var, width=60
        ).pack(fill='x', pady=(4, 4))
        ttk.Label(
            sys_frame,
            text='채팅 목록 미리보기에 위 문구가 포함되면 견적조회로 감지합니다. '
            '숨고 시스템 메시지가 바뀌면 여기를 수정하세요.',
            font=('', 8),
            foreground='gray',
        ).pack(anchor='w')

        text_frame = ttk.LabelFrame(parent, text='텍스트 설정', padding='10')
        text_frame.pack(fill='both', expand=True, pady=(0, 10))
        self.quote_text_editor = TextEditorFrame(
            text_frame, on_texts_changed=self.on_quote_texts_changed
        )
        self.quote_text_editor.pack(fill='both', expand=True)

        order_frame = ttk.LabelFrame(parent, text='전송 순서 설정', padding='10')
        order_frame.pack(fill='x', pady=(0, 0))
        self.quote_send_order = SendOrderFrame(
            order_frame, get_available_items=self.get_quote_available_items
        )
        self.quote_send_order.pack(fill='x')

    def load_settings(self):
        """설정 로드 (새 형식 + 하위 호환)"""
        if not self.current_settings:
            self.after(100, self._init_default_order)
            return

        self.emoji_enabled_var.set(
            self.current_settings.get('emoji_enabled', True)
        )
        self.emoji_var.set(self.current_settings.get('emoji', ''))

        if 'emoji_texts' in self.current_settings:
            self.emoji_text_editor.set_texts(self.current_settings['emoji_texts'])
        else:
            old_texts = {
                '텍스트1': self.current_settings.get('emoji_text1', ''),
                '텍스트2': self.current_settings.get('emoji_text2', ''),
            }
            self.emoji_text_editor.set_texts(old_texts)

        self.quote_enabled_var.set(
            self.current_settings.get('quote_enabled', True)
        )
        self.quote_system_message_var.set(
            self.current_settings.get(
                'quote_system_message', SYSTEM_MESSAGES['QUOTE_VIEW']
            )
        )

        if 'quote_texts' in self.current_settings:
            self.quote_text_editor.set_texts(self.current_settings['quote_texts'])
        else:
            old_texts = {
                '텍스트1': self.current_settings.get('quote_text1', ''),
                '텍스트2': self.current_settings.get('quote_text2', ''),
            }
            self.quote_text_editor.set_texts(old_texts)

        self.max_count_var.set(
            str(self.current_settings.get('max_count', 20))
        )

        self.after(100, self._load_send_order)

    def _init_default_order(self):
        """기본 전송 순서 초기화"""
        self.emoji_send_order.clear_and_set_default()
        self.quote_send_order.clear_and_set_default()

    def _load_send_order(self):
        """전송 순서 로드"""
        if 'emoji_send_order' in self.current_settings:
            self.emoji_send_order.set_order(self.current_settings['emoji_send_order'])
        else:
            self.emoji_send_order.clear_and_set_default()

        if 'quote_send_order' in self.current_settings:
            self.quote_send_order.set_order(self.current_settings['quote_send_order'])
        else:
            self.quote_send_order.clear_and_set_default()

    def save(self):
        """설정 저장"""
        emoji_enabled = self.emoji_enabled_var.get()
        quote_enabled = self.quote_enabled_var.get()

        if not emoji_enabled and not quote_enabled:
            messagebox.showwarning(
                '경고', '최소 하나의 조건을 활성화하세요.', parent=self
            )
            return

        emoji = self.emoji_var.get().strip()
        if emoji_enabled and not emoji:
            messagebox.showwarning('경고', '이모지를 입력하세요.', parent=self)
            return

        quote_system_message = self.quote_system_message_var.get().strip()
        if quote_enabled and not quote_system_message:
            messagebox.showwarning(
                '경고', '견적조회 시스템 메시지(감지 문구)를 입력하세요.', parent=self
            )
            return

        try:
            max_count = int(self.max_count_var.get())
        except ValueError:
            max_count = 20

        self.result = {
            'emoji_enabled': emoji_enabled,
            'emoji': emoji,
            'emoji_texts': self.emoji_text_editor.get_all_texts(),
            'emoji_send_order': self.emoji_send_order.get_order(),
            'quote_enabled': quote_enabled,
            'quote_system_message': quote_system_message,
            'quote_texts': self.quote_text_editor.get_all_texts(),
            'quote_send_order': self.quote_send_order.get_order(),
            'max_count': max_count,
        }
        self.destroy()

    def cancel(self):
        self.destroy()
