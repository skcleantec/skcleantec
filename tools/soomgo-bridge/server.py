"""
텔레CRM 숨고 브릿지 — localhost HTTP API (port 17890)
CRM 4열 패널에서 현재 숨고 채팅방 읽기·메시지 전송
"""
from __future__ import annotations

import json
import logging
import os
import sys
import pathlib
import shutil
import signal
import tempfile
import threading
import time
import atexit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from automation.browser import BrowserManager
from automation.call_modal import CallModalManager
from automation.chat_list_watcher import ChatListWatcher
from automation.chat_room import ChatRoomManager
from automation.login import (
    goto_chat_list,
    is_logged_in,
    login_to_soomgo,
    login_via_kakao,
    wait_for_manual_login,
)
from automation.overlay_modals import dismiss_blocking_overlays
from automation.sequence_sender import run_send_sequence
from automation.http_download import download_bytes
from automation.navigation import (
    is_in_chat_room_url,
    is_on_chat_list_url,
    is_on_non_chat_pro_page,
    open_chat_room_by_id,
)

from version_info import APP_VERSION, BRIDGE_API_VERSION

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('soomgo-bridge')

PORT = 17890
BRIDGE_VERSION = BRIDGE_API_VERSION


def _update_flag_path() -> pathlib.Path:
    try:
        from desktop.config import resolve_update_flag_path

        return resolve_update_flag_path()
    except ImportError:
        return pathlib.Path(os.environ.get('LOCALAPPDATA', '')) / 'Cbiseo' / 'SoomgoBridge' / 'update.request'


def _restart_flag_path() -> pathlib.Path:
    try:
        from desktop.config import resolve_restart_flag_path

        return resolve_restart_flag_path()
    except ImportError:
        return pathlib.Path(os.environ.get('LOCALAPPDATA', '')) / 'Cbiseo' / 'SoomgoBridge' / 'restart.request'

_browser = BrowserManager(headless=False)
_lock = threading.Lock()
_logged_in = False
_last_error: str | None = None
_pending_call_phone: str | None = None
_pending_call_at: int | None = None
_call_watch_active = False
_watch_stop = threading.Event()
_watch_thread: threading.Thread | None = None
_chat_watch_active = False
_chat_watch_stop = threading.Event()
_chat_watch_thread: threading.Thread | None = None
_chat_watcher = ChatListWatcher()
_extract_in_progress = False
_status_nickname_cache: str | None = None


def _clear_pending_call_locked(modal: CallModalManager | None = None):
    global _pending_call_phone, _pending_call_at
    _pending_call_phone = None
    _pending_call_at = None
    if modal:
        modal.clear_pending_call()


def _set_pending_call(phone: str, at_ms: int):
    global _pending_call_phone, _pending_call_at
    _pending_call_phone = phone
    _pending_call_at = at_ms


def _chat_watch_loop():
    while not _chat_watch_stop.is_set():
        try:
            with _lock:
                if (
                    not _chat_watch_active
                    or not _browser.is_running()
                    or not _browser.driver
                    or _extract_in_progress
                ):
                    _chat_watch_stop.wait(2.0)
                    continue
                driver = _browser.driver
                url = driver.current_url
                on_list = is_on_chat_list_url(url)
                in_room = is_in_chat_room_url(url)
                if not on_list and not in_room:
                    _chat_watch_stop.wait(12.0)
                    continue
                _chat_watcher.ensure_installed(driver)
                _chat_watcher.poll_events(driver)
        except Exception as e:
            logger.debug('chat watch: %s', e)
        _chat_watch_stop.wait(_chat_watcher.poll_interval_sec())


def _ensure_chat_watch():
    global _chat_watch_active, _chat_watch_thread
    if _chat_watch_active and _chat_watch_thread and _chat_watch_thread.is_alive():
        return
    _chat_watch_active = True
    _chat_watch_stop.clear()
    _chat_watch_thread = threading.Thread(target=_chat_watch_loop, name='soomgo-chat-watch', daemon=True)
    _chat_watch_thread.start()


def _stop_chat_watch():
    global _chat_watch_active
    _chat_watch_active = False
    _chat_watch_stop.set()


def _call_watch_loop():
    while not _watch_stop.is_set():
        try:
            with _lock:
                if not _call_watch_active or not _browser.is_running() or not _browser.driver:
                    _watch_stop.wait(1.5)
                    continue
                driver = _browser.driver
                modal = CallModalManager(driver)
                if not modal._watcher_installed:
                    modal.install_call_button_watcher()
                pending = modal.poll_pending_call()
                if pending and pending.get('phone'):
                    at_ms = int(pending.get('at') or 0)
                    if at_ms != _pending_call_at or _pending_call_phone != pending['phone']:
                        _set_pending_call(str(pending['phone']), at_ms)
        except Exception as e:
            logger.debug('call watch: %s', e)
        _watch_stop.wait(1.0)


def _ensure_call_watch():
    global _call_watch_active, _watch_thread
    if _call_watch_active and _watch_thread and _watch_thread.is_alive():
        return
    _call_watch_active = True
    _watch_stop.clear()
    _watch_thread = threading.Thread(target=_call_watch_loop, name='soomgo-call-watch', daemon=True)
    _watch_thread.start()


def _stop_call_watch():
    global _call_watch_active
    _call_watch_active = False
    _watch_stop.set()


def _arrange_soomgo_layout(body: dict[str, Any]) -> bool:
    if not _browser.is_running() or not _browser.driver:
        return False
    bounds = body.get('screen') if isinstance(body.get('screen'), dict) else body
    return _browser.arrange_right_half(bounds if isinstance(bounds, dict) else None)


def _download_sequence_images(steps: list[dict[str, Any]]) -> tuple[dict[str, str], str | None, pathlib.Path | None]:
    """HTTPS 이미지 URL → 임시 파일. (url→path 맵, 오류, 정리용 tempdir)"""
    urls: list[str] = []
    for step in steps:
        if not isinstance(step, dict) or step.get('type') != 'images':
            continue
        raw_urls = step.get('urls')
        if not isinstance(raw_urls, list):
            continue
        for raw in raw_urls:
            url = str(raw).strip()
            if url.startswith('https://') and url not in urls:
                urls.append(url)

    if not urls:
        return {}, None, None

    temp_dir = pathlib.Path(tempfile.mkdtemp(prefix='soomgo-seq-'))
    mapping: dict[str, str] = {}
    try:
        for index, url in enumerate(urls, start=1):
            ext = '.jpg'
            lower = url.split('?')[0].lower()
            for candidate in ('.png', '.jpeg', '.jpg', '.gif', '.webp'):
                if lower.endswith(candidate):
                    ext = candidate if candidate != '.jpeg' else '.jpg'
                    break
            dest = temp_dir / f'img_{index}{ext}'
            data = download_bytes(url)
            if not data:
                raise ValueError(f'empty image: {url}')
            dest.write_bytes(data)
            mapping[url] = str(dest)
        return mapping, None, temp_dir
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {}, f'이미지 다운로드 실패: {e}', None


def _is_client_disconnect(exc: BaseException) -> bool:
    if isinstance(exc, (ConnectionAbortedError, BrokenPipeError, ConnectionResetError)):
        return True
    if isinstance(exc, OSError) and getattr(exc, 'winerror', None) in (10053, 10054):
        return True
    return False


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    try:
        handler.send_response(status)
        handler.send_header('Content-Type', 'application/json; charset=utf-8')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        handler.send_header('Content-Length', str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except Exception as e:
        if _is_client_disconnect(e):
            logger.debug('client disconnected before response completed')
            return
        raise


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get('Content-Length', 0))
    if length <= 0:
        return {}
    try:
        raw = handler.rfile.read(length)
    except Exception as e:
        if _is_client_disconnect(e):
            return {}
        raise
    try:
        return json.loads(raw.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def _page_mode(url: str, in_room: bool) -> str:
    if in_room:
        return 'chat_room'
    if is_on_chat_list_url(url):
        return 'chat_list'
    if is_on_non_chat_pro_page(url):
        return 'requests'
    if '/pro/chats' in url.lower():
        return 'chat_list'
    return 'other'


def _sync_logged_in_from_browser() -> bool:
    """Chrome URL 기준 로그인 상태 — 메모리 플래그·lastError 동기화."""
    global _logged_in, _last_error
    if not _browser.is_running() or not _browser.driver:
        return False
    try:
        dismiss_blocking_overlays(_browser.driver, 0.25, max_rounds=2)
        url_ok = is_logged_in(_browser.driver)
    except Exception:
        url_ok = False
    if url_ok:
        _logged_in = True
        _last_error = None
    return url_ok


def _status_payload(*, lite: bool = False) -> dict[str, Any]:
    global _status_nickname_cache
    running = _browser.is_running()
    in_room = False
    chat_id = None
    nickname = _status_nickname_cache
    page_mode = 'other'
    current_url = None
    call_modal_open = False
    light = lite or _extract_in_progress
    if running and _browser.driver:
        room = ChatRoomManager(_browser.driver)
        try:
            current_url = _browser.driver.current_url
        except Exception:
            current_url = None
        in_room = room.is_in_chat_room()
        chat_id = room.get_current_chat_id()
        if not light:
            nickname = room.get_nickname()
            if nickname:
                _status_nickname_cache = nickname
            try:
                call_modal_open = CallModalManager(_browser.driver).is_call_modal_open()
            except Exception:
                call_modal_open = False
        if current_url:
            page_mode = _page_mode(current_url, in_room)
    payload = {
        'ok': True,
        'bridgeVersion': BRIDGE_VERSION,
        'bridgeRunning': True,
        'browserRunning': running,
        'loggedIn': (_logged_in if light else _sync_logged_in_from_browser()) if running else False,
        'inChatRoom': in_room,
        'onChatList': page_mode == 'chat_list',
        'onRequestsPage': page_mode == 'requests',
        'pageMode': page_mode,
        'currentUrl': current_url,
        'chatId': chat_id,
        'nickname': nickname,
        'pendingCallPhone': _pending_call_phone,
        'pendingCallAt': _pending_call_at,
        'callModalOpen': call_modal_open,
        'callWatchActive': _call_watch_active,
        'chatWatchActive': _chat_watch_active,
        'watchedChatIds': _chat_watcher.watch_chat_ids(),
        'chatAlerts': _chat_watcher.pending_alerts(),
        'chatAlertCount': len(_chat_watcher.pending_alerts()),
        'chatInbox': _chat_watcher.all_alerts() if not light else [],
        'chatListSnapshot': (
            _chat_watcher.list_snapshot(_browser.driver)
            if (not light and running and _browser.driver)
            else []
        ),
        'extractInProgress': _extract_in_progress,
        'lastError': _last_error,
        'port': PORT,
        'appVersion': os.environ.get('SOOMGO_APP_VERSION', APP_VERSION),
        'desktopRunning': os.environ.get('SOOMGO_DESKTOP_RUNNING') == '1',
    }
    try:
        from bridge_status_extras import build_update_status_fields

        payload.update(build_update_status_fields())
    except Exception as e:
        logger.debug('update status fields skipped: %s', e)
    return payload


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args):  # noqa: A003
        logger.debug('%s - %s', self.address_string(), format % args)

    def handle_error(self, request, client_address) -> None:  # noqa: ANN001
        exc = sys.exc_info()[1]
        if exc is not None and _is_client_disconnect(exc):
            logger.debug('client disconnected: %s', exc)
            return
        super().handle_error(request, client_address)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        query = urlparse(self.path).query
        if path == '/status':
            lite = 'lite=1' in query or 'lite=true' in query
            with _lock:
                payload = _status_payload(lite=lite)
            _json_response(self, 200, payload)
            return
        if path == '/health':
            _json_response(self, 200, {'ok': True, 'bridgeVersion': BRIDGE_VERSION})
            return
        _json_response(self, 404, {'ok': False, 'error': 'not found'})

    def do_POST(self):  # noqa: N802
        global _logged_in, _last_error
        path = urlparse(self.path).path
        body = _read_json(self)

        with _lock:
            if path == '/start':
                if not _browser.is_running():
                    if not _browser.start():
                        _last_error = 'Chrome을 시작할 수 없습니다.'
                        _json_response(self, 500, {'ok': False, 'error': _last_error})
                        return
                _arrange_soomgo_layout(body)
                _json_response(self, 200, _status_payload())
                return

            if path == '/stop':
                _browser.stop()
                _logged_in = False
                _json_response(self, 200, {'ok': True})
                return

            if not _browser.is_running():
                if not _browser.start():
                    _last_error = 'Chrome을 시작할 수 없습니다.'
                    _json_response(self, 500, {'ok': False, 'error': _last_error})
                    return

            driver = _browser.driver
            assert driver is not None

            if path == '/login':
                email = str(body.get('email', '')).strip()
                password = str(body.get('password', '')).strip()
                mode = str(body.get('mode', 'email') or 'email').strip().lower()
                if mode not in ('email', 'kakao'):
                    mode = 'email'
                dismiss_blocking_overlays(driver, 0.5, max_rounds=4)
                if is_logged_in(driver):
                    goto_chat_list(driver)
                    _logged_in = True
                    _last_error = None
                    _chat_watcher.ensure_installed(driver)
                    _ensure_chat_watch()
                    _json_response(
                        self,
                        200,
                        {
                            **_status_payload(),
                            'loginOk': True,
                            'reusedSession': True,
                            'loginMode': mode,
                        },
                    )
                    return

                ok = False
                if mode == 'kakao':
                    ok = login_via_kakao(driver)
                else:
                    if not email or not password:
                        _json_response(
                            self,
                            400,
                            {'ok': False, 'error': 'email/password required (또는 mode=kakao)'},
                        )
                        return
                    ok = login_to_soomgo(driver, email, password)
                    if not ok and is_logged_in(driver):
                        goto_chat_list(driver)
                        ok = True
                    # 이메일 실패(카카오 전용 계정 등) → 카카오 플로우로 폴백
                    if not ok:
                        logger.info('email login failed — falling back to kakao flow')
                        ok = login_via_kakao(driver)
                    if not ok:
                        ok = wait_for_manual_login(driver, timeout_sec=60.0)

                _logged_in = ok
                if ok:
                    _last_error = None
                elif mode == 'kakao':
                    _last_error = (
                        '카카오 로그인이 완료되지 않았습니다. '
                        'Chrome 창에서 「카카오로 시작하기」·QR·로그인을 마쳐 주세요.'
                    )
                else:
                    _last_error = '숨고 로그인에 실패했습니다.'
                if ok:
                    _chat_watcher.ensure_installed(driver)
                    _ensure_chat_watch()
                status = 200 if ok else 401
                _json_response(
                    self,
                    status,
                    {
                        **_status_payload(),
                        'loginOk': ok,
                        'error': _last_error,
                        'loginMode': mode,
                    },
                )
                return

            if path == '/open-chats':
                if not _sync_logged_in_from_browser():
                    _json_response(self, 401, {'ok': False, 'error': '먼저 숨고 로그인을 해 주세요.'})
                    return
                goto_chat_list(driver, force_list=False)
                _arrange_soomgo_layout(body)
                _chat_watcher.ensure_installed(driver)
                _ensure_chat_watch()
                _json_response(self, 200, _status_payload())
                return

            if path == '/arrange-layout':
                ok = _arrange_soomgo_layout(body)
                _json_response(self, 200, {**_status_payload(), 'layoutOk': ok})
                return

            if path == '/extract':
                global _extract_in_progress
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 Chrome 창에서 채팅방을 연 뒤 다시 시도해 주세요.',
                    })
                    return
                known_phone = _pending_call_phone
                _extract_in_progress = True
                try:
                    data = room.extract_current_chat(known_safe_phone=known_phone)
                finally:
                    _extract_in_progress = False
                _json_response(self, 200, {'ok': True, 'data': data})
                return

            if path == '/send-message':
                message = str(body.get('message', '')).strip()
                if not message:
                    _json_response(self, 400, {'ok': False, 'error': 'message required'})
                    return
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 Chrome 창에서 채팅방을 연 뒤 다시 시도해 주세요.',
                    })
                    return
                ok, send_err = room.send_message(message)
                if ok:
                    _json_response(self, 200, {'ok': True})
                else:
                    _json_response(self, 500, {
                        'ok': False,
                        'error': send_err or '메시지 전송 실패. 숨고 채팅방이 열려 있는지 확인해 주세요.',
                    })
                return

            if path == '/send-sequence':
                raw_steps = body.get('steps')
                if not isinstance(raw_steps, list) or not raw_steps:
                    _json_response(self, 400, {'ok': False, 'error': 'steps required'})
                    return
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 Chrome 창에서 채팅방을 연 뒤 다시 시도해 주세요.',
                    })
                    return
                image_map, dl_err, temp_dir = _download_sequence_images(raw_steps)
                if dl_err:
                    _json_response(self, 400, {'ok': False, 'error': dl_err})
                    return
                try:
                    ok, seq_err = run_send_sequence(
                        room,
                        raw_steps,
                        image_paths_by_url=image_map,
                    )
                    if ok:
                        _json_response(self, 200, {'ok': True})
                    else:
                        _json_response(self, 500, {
                            'ok': False,
                            'error': seq_err or '순차 전송에 실패했습니다.',
                        })
                finally:
                    if temp_dir and temp_dir.exists():
                        shutil.rmtree(temp_dir, ignore_errors=True)
                return

            if path == '/watch-chat-list':
                if not _sync_logged_in_from_browser():
                    _json_response(self, 401, {'ok': False, 'error': '먼저 숨고 로그인을 해 주세요.'})
                    return
                _chat_watcher.ensure_installed(driver)
                _chat_watcher.poll_events(driver)
                _ensure_chat_watch()
                _json_response(self, 200, _status_payload())
                return

            if path == '/watch-chat-ids':
                if not _sync_logged_in_from_browser():
                    _json_response(self, 401, {'ok': False, 'error': '먼저 숨고 로그인을 해 주세요.'})
                    return
                raw_ids = body.get('chatIds')
                ids: list[str] = []
                if isinstance(raw_ids, list):
                    ids = [str(i).strip() for i in raw_ids if str(i).strip().isdigit()]
                _chat_watcher.ensure_installed(driver)
                _chat_watcher.set_watch_chat_ids(driver, ids)
                _chat_watcher.poll_events(driver)
                _ensure_chat_watch()
                _json_response(self, 200, {'ok': True, 'watchedChatIds': ids, **_status_payload(lite=True)})
                return

            if path == '/ack-chat-alerts':
                ids = body.get('ids')
                acked = 0
                if isinstance(ids, list) and ids:
                    acked = _chat_watcher.ack_ids([str(i) for i in ids])
                else:
                    before_ms = body.get('capturedAtBefore')
                    if before_ms is not None:
                        acked = _chat_watcher.ack_before(int(before_ms))
                _json_response(self, 200, {'ok': True, 'acked': acked, **_status_payload(lite=True)})
                return

            if path == '/open-chat-room':
                if not _sync_logged_in_from_browser():
                    _json_response(self, 401, {'ok': False, 'error': '먼저 숨고 로그인을 해 주세요.'})
                    return
                chat_id = str(body.get('chatId', '')).strip()
                if not chat_id.isdigit():
                    _json_response(self, 400, {'ok': False, 'error': 'chatId required'})
                    return
                ok = open_chat_room_by_id(driver, chat_id)
                if not ok:
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 채팅방을 열지 못했습니다.',
                    })
                    return
                _json_response(self, 200, _status_payload())
                return

            if path == '/watch-call-button':
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '채팅방에서 안심번호 통화 감시를 시작할 수 없습니다.',
                    })
                    return
                modal = CallModalManager(driver)
                modal.install_call_button_watcher()
                _ensure_call_watch()
                _json_response(self, 200, _status_payload())
                return

            if path == '/ack-pending-call':
                at_ms = body.get('pendingCallAt')
                if at_ms is not None and _pending_call_at is not None and int(at_ms) != int(_pending_call_at):
                    _json_response(self, 200, {'ok': True, 'acked': False})
                    return
                modal = CallModalManager(driver)
                _clear_pending_call_locked(modal)
                _json_response(self, 200, {'ok': True, 'acked': True, **_status_payload()})
                return

            if path == '/open-call-modal':
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 Chrome 창에서 채팅방을 연 뒤 다시 시도해 주세요.',
                    })
                    return
                modal = CallModalManager(driver)
                ok = modal.open_call_modal()
                if not ok:
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 전화 모달을 열지 못했습니다. 채팅방에서 전화 아이콘을 눌러 주세요.',
                    })
                    return
                _json_response(self, 200, _status_payload())
                return

            if path == '/extract-call-number':
                modal = CallModalManager(driver)
                phone = modal.extract_call_number_from_modal()
                modal.close_call_modal()
                if not phone:
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '안심번호를 찾지 못했습니다. 채팅만 희망 고객일 수 있습니다.',
                    })
                    return
                _json_response(self, 200, {'ok': True, 'phone': phone, **_status_payload()})
                return

            if path == '/request-update':
                try:
                    from bridge_status_extras import invalidate_manifest_cache, get_manifest_cached
                    from desktop.config import clear_pending_update_manifest, write_pending_update_manifest

                    invalidate_manifest_cache()
                    raw_manifest = body.get('manifest')
                    if isinstance(raw_manifest, dict):
                        latest = str(raw_manifest.get('latestVersion', '')).strip()
                        url = str(raw_manifest.get('downloadUrl', '')).strip()
                        if latest and url:
                            write_pending_update_manifest(
                                {
                                    'requiredVersion': raw_manifest.get('requiredVersion', 2),
                                    'latestVersion': latest,
                                    'downloadUrl': url,
                                    'releaseNotes': raw_manifest.get('releaseNotes'),
                                    'sha256': raw_manifest.get('sha256'),
                                }
                            )
                            logger.info('CRM manifest queued for update: v%s', latest)
                        else:
                            clear_pending_update_manifest()
                    else:
                        clear_pending_update_manifest()
                    mode = str(body.get('mode', 'prompt')).strip().lower()
                    if mode not in ('prompt', 'background', 'install'):
                        mode = 'prompt'
                    flag_path = _update_flag_path()
                    flag_path.parent.mkdir(parents=True, exist_ok=True)
                    flag_path.write_text(mode, encoding='utf-8')
                    _json_response(self, 200, {'ok': True, 'message': '업데이트 확인을 요청했습니다.', 'mode': mode})
                except OSError as e:
                    _json_response(self, 500, {'ok': False, 'error': f'업데이트 요청 실패: {e}'})
                return

            if path == '/restart-bridge':
                try:
                    mode = str(body.get('mode', 'bridge')).strip().lower()
                    if mode not in ('bridge', 'desktop'):
                        mode = 'bridge'
                    flag_path = _restart_flag_path()
                    flag_path.parent.mkdir(parents=True, exist_ok=True)
                    flag_path.write_text(mode, encoding='utf-8')
                    _json_response(self, 200, {'ok': True, 'message': '재시작을 요청했습니다.'})
                except OSError as e:
                    _json_response(self, 500, {'ok': False, 'error': f'재시작 요청 실패: {e}'})
                return

        _json_response(self, 404, {'ok': False, 'error': 'not found'})


def _shutdown_bridge() -> None:
    logger.info('브릿지 종료 — Chrome·감시 스레드 정리')
    _stop_call_watch()
    _browser.stop()


atexit.register(_shutdown_bridge)


def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), BridgeHandler)
    logger.info('Soomgo bridge v%s listening on http://127.0.0.1:%s', BRIDGE_VERSION, PORT)

    def _handle_stop(*_args) -> None:
        _shutdown_bridge()
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, _handle_stop)
    if hasattr(signal, 'SIGINT'):
        signal.signal(signal.SIGINT, _handle_stop)
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, _handle_stop)

    try:
        server.serve_forever()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        server.server_close()
        _shutdown_bridge()


if __name__ == '__main__':
    main()
