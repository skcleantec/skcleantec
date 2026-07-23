"""Miso bridge HTTP server — port 17891 (skeleton phase)."""
from __future__ import annotations

import json
import logging
import signal
import sys
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from automation.chat_extract import extract_current_chat
from automation.chat_list import open_chats
from automation.chat_send import send_chat_message
from automation.emulator_launcher import start_emulator_detached
from automation.status_probe import build_status_payload
from bridge_config import HOST, PORT
from version_info import APP_VERSION, BRIDGE_API_VERSION

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger('miso-bridge')

KST = timezone(timedelta(hours=9))


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get('Content-Length') or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    data = json.loads(raw.decode('utf-8'))
    return data if isinstance(data, dict) else {}


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = f'MisoBridge/{APP_VERSION}'

    def log_message(self, fmt: str, *args: Any) -> None:
        logger.info('%s - %s', self.address_string(), fmt % args)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        if path == '/status':
            try:
                qs = parse_qs(parsed.query or '')
                lite = qs.get('lite', [''])[0] in ('1', 'true', 'yes')
                payload = build_status_payload(lite=lite)
                _json_response(self, 200, payload)
            except Exception as e:
                logger.exception('status failed')
                _json_response(
                    self,
                    500,
                    {
                        'ok': False,
                        'error': f'상태 조회 실패: {e}',
                        'code': 'BRIDGE_NOT_READY',
                    },
                )
            return
        _json_response(self, 404, {'ok': False, 'error': 'not found', 'code': 'NOT_FOUND'})

    def do_POST(self) -> None:
        path = urlparse(self.path).path.rstrip('/') or '/'
        try:
            body = _read_json_body(self)
        except json.JSONDecodeError:
            _json_response(self, 400, {'ok': False, 'error': 'JSON 형식 오류', 'code': 'BAD_REQUEST'})
            return

        if path == '/open-chats':
            try:
                force_launch = bool(body.get('forceLaunch'))
                payload = open_chats(force_launch=force_launch)
                status = 200 if payload.get('ok') else 503
                _json_response(self, status, payload)
            except Exception as e:
                logger.exception('open-chats failed')
                _json_response(
                    self,
                    500,
                    {
                        'ok': False,
                        'error': f'채팅 목록 연결 실패: {e}',
                        'code': 'UI_CHANGED',
                        'items': [],
                    },
                )
            return

        if path == '/extract':
            try:
                chat_id = str(body.get('chatId') or body.get('chat_id') or '').strip() or None
                payload = extract_current_chat(chat_id=chat_id)
                status = 200 if payload.get('ok') else 503
                _json_response(self, status, payload)
            except Exception as e:
                logger.exception('extract failed')
                err_name = type(e).__name__
                if 'Timeout' in err_name:
                    msg = (
                        '에뮬레이터가 응답하지 않습니다. 「응답 없음」 팝업 → 「대기」 후 '
                        '미소 채팅방을 연 뒤 다시 시도해 주세요.'
                    )
                    code = 'ADB_TIMEOUT'
                else:
                    msg = f'정보 가져오기 실패: {e}'
                    code = 'UI_CHANGED'
                _json_response(
                    self,
                    500,
                    {
                        'ok': False,
                        'error': msg,
                        'code': code,
                    },
                )
            return

        if path == '/send-message':
            message = str(body.get('message') or '').strip()
            if not message:
                _json_response(
                    self,
                    400,
                    {'ok': False, 'error': 'message 필드가 필요합니다.', 'code': 'BAD_REQUEST'},
                )
                return
            chat_id = str(body.get('chatId') or body.get('chat_id') or '').strip() or None
            try:
                payload = send_chat_message(message=message, chat_id=chat_id)
                status = 200 if payload.get('ok') else 503
                _json_response(self, status, payload)
            except Exception as e:
                logger.exception('send-message failed')
                _json_response(
                    self,
                    500,
                    {
                        'ok': False,
                        'error': f'메시지 전송 실패: {e}',
                        'code': 'UI_CHANGED',
                    },
                )
            return

        if path == '/emulator/start':
            ok, detail = start_emulator_detached()
            if ok:
                _json_response(
                    self,
                    200,
                    {
                        'ok': True,
                        'avd': detail,
                        'message': '에뮬레이터 시작 요청을 보냈습니다. boot 후 GET /status 로 확인하세요.',
                    },
                )
            else:
                _json_response(
                    self,
                    500,
                    {'ok': False, 'error': detail, 'code': 'BRIDGE_NOT_READY'},
                )
            return

        _json_response(self, 404, {'ok': False, 'error': 'not found', 'code': 'NOT_FOUND'})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), BridgeHandler)
    logger.info(
        'Miso bridge v%s (API %s) listening on http://%s:%s',
        APP_VERSION,
        BRIDGE_API_VERSION,
        HOST,
        PORT,
    )

    def _handle_stop(*_args: Any) -> None:
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


if __name__ == '__main__':
    main()
