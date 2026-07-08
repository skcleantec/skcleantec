"""
텔레CRM 숨고 브릿지 — localhost HTTP API (port 17890)
CRM 4열 패널에서 현재 숨고 채팅방 읽기·메시지 전송
"""
from __future__ import annotations

import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from automation.browser import BrowserManager
from automation.chat_room import ChatRoomManager
from automation.login import goto_chat_list, is_logged_in, login_to_soomgo

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('soomgo-bridge')

PORT = 17890

_browser = BrowserManager(headless=False)
_lock = threading.Lock()
_logged_in = False
_last_error: str | None = None


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get('Content-Length', 0))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def _status_payload() -> dict[str, Any]:
    running = _browser.is_running()
    in_room = False
    chat_id = None
    nickname = None
    if running and _browser.driver:
        room = ChatRoomManager(_browser.driver)
        in_room = room.is_in_chat_room()
        chat_id = room.get_current_chat_id()
        nickname = room.get_nickname()
    return {
        'ok': True,
        'bridgeRunning': True,
        'browserRunning': running,
        'loggedIn': _logged_in and is_logged_in(_browser.driver) if running else False,
        'inChatRoom': in_room,
        'chatId': chat_id,
        'nickname': nickname,
        'lastError': _last_error,
        'port': PORT,
    }


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args):  # noqa: A003
        logger.debug('%s - %s', self.address_string(), format % args)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        if path == '/status':
            _json_response(self, 200, _status_payload())
            return
        if path == '/health':
            _json_response(self, 200, {'ok': True})
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
                if not email or not password:
                    _json_response(self, 400, {'ok': False, 'error': 'email/password required'})
                    return
                ok = login_to_soomgo(driver, email, password)
                _logged_in = ok
                _last_error = None if ok else '숨고 로그인에 실패했습니다.'
                status = 200 if ok else 401
                _json_response(self, status, {**_status_payload(), 'loginOk': ok, 'error': _last_error})
                return

            if path == '/open-chats':
                if not is_logged_in(driver):
                    _json_response(self, 401, {'ok': False, 'error': '먼저 숨고 로그인을 해 주세요.'})
                    return
                goto_chat_list(driver)
                _json_response(self, 200, _status_payload())
                return

            if path == '/extract':
                room = ChatRoomManager(driver)
                if not room.is_in_chat_room():
                    _json_response(self, 400, {
                        'ok': False,
                        'error': '숨고 Chrome 창에서 채팅방을 연 뒤 다시 시도해 주세요.',
                    })
                    return
                data = room.extract_current_chat()
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
                ok = room.send_message(message)
                _json_response(self, 200 if ok else 500, {'ok': ok, 'error': None if ok else '메시지 전송 실패'})
                return

        _json_response(self, 404, {'ok': False, 'error': 'not found'})


def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), BridgeHandler)
    logger.info('Soomgo bridge listening on http://127.0.0.1:%s', PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('shutting down')
        _browser.stop()
        server.server_close()


if __name__ == '__main__':
    main()
