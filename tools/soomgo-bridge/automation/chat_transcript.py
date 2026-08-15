"""채팅방 전체 대화 수집·PC 로컬 JSON 저장 (텔레CRM AI 정리 Phase 1)"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from selenium.webdriver.remote.webdriver import WebDriver

logger = logging.getLogger(__name__)

TRANSCRIPT_SCHEMA_VERSION = 1
DEFAULT_TENANT_SLUG = '_default'
KST = timezone(timedelta(hours=9))

_JS_LOAD_AND_COLLECT = """
return (function(maxSteps, stepPx) {
    function norm(t) {
        return String(t || '').replace(/\\s+/g, ' ').trim();
    }
    function findInput() {
        return document.querySelector(
            'textarea[name="message-input"], textarea.message-input, textarea, '
            + '[contenteditable="true"][role="textbox"], div[role="textbox"]'
        );
    }
    function findListSidebarRoot() {
        var uls = document.querySelectorAll('ul.css-19wxjby, main ul, ul[class*="css-"]');
        var best = null;
        var bestCount = 0;
        for (var u = 0; u < uls.length; u++) {
            var c = uls[u].querySelectorAll(':scope > li').length;
            if (c > bestCount) {
                bestCount = c;
                best = uls[u];
            }
        }
        return best;
    }
    function findScrollRoot(input) {
        var el = input;
        while (el) {
            var st = window.getComputedStyle(el);
            var oy = st.overflowY;
            if (
                (oy === 'auto' || oy === 'scroll' || oy === 'overlay')
                && el.scrollHeight > el.clientHeight + 8
            ) {
                return el;
            }
            el = el.parentElement;
        }
        var main = document.querySelector('main');
        if (!main) return null;
        var nodes = main.querySelectorAll('div, section, article');
        var best = null;
        var bestExtra = 0;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var st2 = window.getComputedStyle(n);
            if (st2.overflowY !== 'auto' && st2.overflowY !== 'scroll' && st2.overflowY !== 'overlay') continue;
            var extra = n.scrollHeight - n.clientHeight;
            if (extra > bestExtra + 20) {
                bestExtra = extra;
                best = n;
            }
        }
        return best;
    }
    function isSystemText(t) {
        if (!t) return true;
        if (/고수를\\s*고용|견적\\s*요청|자동\\s*응답|입력\\s*중|채팅방\\s*나가기|안읽음|읽음/.test(t)) return true;
        if (/^요청\\s*[·|]\\s*견적$|^스마트\\s*견적$|^마이\\s*페이지$|^고수\\s*찾기$|^커뮤니티$|^인터넷\\s*가입$/.test(t)) return true;
        if (/^프로필$|^프로필\\s*관리$|^받은\\s*견적$|^알림\\s*끄기$|^신고\\s*하기$|^고객\\s*요청\\s*보기$/.test(t)) return true;
        if (/^채팅\\s*\\d+\\+?$|^채팅\\s*메시지\\s*검색/.test(t)) return true;
        if (/브레이브\\s*모바일|통신\\s*판매\\s*중개|거래\\s*당사자|\\[위험\\]|100%\\s*사기|사칭\\s*공사|전자\\s*세금\\s*계산서/.test(t)) return true;
        if (/^\\d{1,2}:\\d{2}$/.test(t)) return true;
        if (/^\\d{4}년\\s*\\d{1,2}월\\s*\\d{1,2}일/.test(t)) return true;
        return false;
    }
    function extractBatch(sidebar, scroller) {
        var input = findInput();
        if (!input) return [];
        var searchRoot = scroller;
        if (!searchRoot) {
            searchRoot = input.closest('main') || document.body;
        }
        var lis = searchRoot.querySelectorAll('li');
        var out = [];
        for (var i = 0; i < lis.length; i++) {
            var li = lis[i];
            if (sidebar && sidebar.contains(li)) continue;
            if (li.closest('header, nav, footer, [role="navigation"]')) continue;
            var role = classifyRole(li);
            if (!role || role === 'system') continue;
            var text = norm(li.textContent || '')
                .replace(/오전\\s*\\d{1,2}:\\d{2}|오후\\s*\\d{1,2}:\\d{2}/g, '')
                .replace(/안읽음|읽음/g, '')
                .trim();
            if (!text || text.length < 2 || isSystemText(text)) continue;
            out.push({ role: role, text: text });
        }
        return out;
    }
    function fp(m) {
        return m.role + '\\u0001' + m.text;
    }
    var input = findInput();
    if (!input) {
        return { ok: false, error: 'message_input_not_found', messages: [], scrollSteps: 0 };
    }
    var sidebar = findListSidebarRoot();
    var scroller = findScrollRoot(input);
    var seen = {};
    var ordered = [];
    function mergeBatch(batch) {
        for (var b = 0; b < batch.length; b++) {
            var m = batch[b];
            var key = fp(m);
            if (seen[key]) continue;
            seen[key] = true;
            ordered.push(m);
        }
    }
    function classifyRole(li) {
        var style = window.getComputedStyle(li);
        var align = style.textAlign;
        var text = norm(li.textContent || '')
            .replace(/오전\\s*\\d{1,2}:\\d{2}|오후\\s*\\d{1,2}:\\d{2}/g, '')
            .replace(/안읽음|읽음/g, '')
            .trim();
        if (!text || text.length < 2) return null;
        if (isSystemText(text)) return 'system';
        if (align === 'right') return 'pro';
        return 'customer';
    }
    if (scroller) {
        scroller.scrollTop = 0;
    }
    mergeBatch(extractBatch(sidebar, scroller));
    var steps = 0;
    var stagnant = 0;
    var prevCount = ordered.length;
    for (var s = 0; s < maxSteps; s++) {
        steps = s + 1;
        if (!scroller) break;
        var prevTop = scroller.scrollTop;
        scroller.scrollTop = Math.min(scroller.scrollTop + stepPx, scroller.scrollHeight);
        try {
            scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: stepPx, bubbles: true, cancelable: true }));
        } catch (e) {}
        mergeBatch(extractBatch(sidebar, scroller));
        var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
        if (ordered.length === prevCount && (scroller.scrollTop === prevTop || atBottom)) {
            stagnant += 1;
        } else {
            stagnant = 0;
            prevCount = ordered.length;
        }
        if (atBottom && stagnant >= 2) break;
        if (stagnant >= 4) break;
    }
    if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
    }
    mergeBatch(extractBatch(sidebar, scroller));
    return {
        ok: true,
        messages: ordered,
        scrollSteps: steps,
        messageCount: ordered.length,
        hasScroller: !!scroller,
    };
})();
"""

_SYSTEM_LINE_RE = re.compile(
    r'고수를\s*고용|견적\s*요청|자동\s*응답|채팅방\s*나가기|브레이브\s*모바일|통신\s*판매\s*중개|'
    r'\[위험\]|100%\s*사기|사칭\s*공사|전자\s*세금\s*계산서|'
    r'^요청\s*[·|]\s*견적$|^스마트\s*견적$|^마이\s*페이지$|^채팅\s*\d+\+?$',
    re.I,
)

_UI_NOISE_EXACT = {
    '요청·견적', '요청|견적', '스마트견적', '마이페이지', '고수찾기', '커뮤니티', '인터넷가입',
    '프로필', '프로필관리', '프로필 관리', '받은 견적', '알림 끄기', '신고하기', '고객 요청 보기',
    '채팅 메시지 검색하기',
}


def _compact_text(text: str) -> str:
    return re.sub(r'\s+', '', text.strip())


def _is_transcript_noise(text: str) -> bool:
    t = (text or '').strip()
    if not t or len(t) < 2:
        return True
    compact = _compact_text(t)
    if compact in {_compact_text(x) for x in _UI_NOISE_EXACT}:
        return True
    if len(t) <= 18 and re.match(r'^채팅\d+\+?$', compact):
        return True
    if _SYSTEM_LINE_RE.search(t):
        return True
    return False


def normalize_tenant_slug(raw: str | None) -> str:
    s = (raw or DEFAULT_TENANT_SLUG).strip().lower()
    s = re.sub(r'[^a-z0-9_-]+', '-', s)
    s = s.strip('-')[:64]
    return s or DEFAULT_TENANT_SLUG


def _now_kst_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def compute_content_hash(messages: list[dict[str, Any]]) -> str:
    payload = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return f'sha256:{digest}'


def resolve_transcripts_root() -> Path:
    try:
        from desktop.config import resolve_chat_transcripts_dir

        return resolve_chat_transcripts_dir()
    except ImportError:
        import os

        return Path(os.environ.get('LOCALAPPDATA', '')) / 'Cbiseo' / 'SoomgoBridge' / 'chat-transcripts'


class ChatTranscriptStore:
    """%LOCALAPPDATA%\\Cbiseo\\SoomgoBridge\\chat-transcripts\\{tenantSlug}\\{chatId}.json"""

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or resolve_transcripts_root()

    def file_path(self, tenant_slug: str, chat_id: str) -> Path:
        safe_id = re.sub(r'[^0-9A-Za-z_-]+', '_', str(chat_id).strip())
        return self.root / normalize_tenant_slug(tenant_slug) / f'{safe_id}.json'

    def load(self, tenant_slug: str, chat_id: str) -> dict[str, Any] | None:
        path = self.file_path(tenant_slug, chat_id)
        if not path.is_file():
            return None
        try:
            raw = json.loads(path.read_text(encoding='utf-8'))
            return raw if isinstance(raw, dict) else None
        except (OSError, json.JSONDecodeError) as e:
            logger.warning('load transcript failed %s: %s', path, e)
            return None

    def status(self, tenant_slug: str, chat_id: str) -> dict[str, Any] | None:
        path = self.file_path(tenant_slug, chat_id)
        if not path.is_file():
            return None
        data = self.load(tenant_slug, chat_id)
        if not data:
            return None
        return {
            'chatId': data.get('chatId') or chat_id,
            'tenantSlug': data.get('tenantSlug') or normalize_tenant_slug(tenant_slug),
            'extractedAt': data.get('extractedAt'),
            'messageCount': data.get('messageCount') or len(data.get('messages') or []),
            'contentHash': data.get('contentHash'),
            'nickname': data.get('nickname'),
            'filePath': str(path),
        }

    def save(
        self,
        *,
        tenant_slug: str,
        chat_id: str,
        nickname: str | None,
        messages: list[dict[str, Any]],
        scroll_steps: int,
        source_url: str | None = None,
    ) -> dict[str, Any]:
        self.root.mkdir(parents=True, exist_ok=True)
        tenant_dir = self.root / normalize_tenant_slug(tenant_slug)
        tenant_dir.mkdir(parents=True, exist_ok=True)

        normalized_messages: list[dict[str, Any]] = []
        for item in messages:
            role = str(item.get('role', '')).strip()
            text = str(item.get('text', '')).strip()
            if role not in ('customer', 'pro', 'system') or not text:
                continue
            if role == 'system' or _SYSTEM_LINE_RE.search(text) or _is_transcript_noise(text):
                continue
            normalized_messages.append({
                'role': role,
                'text': text,
                'at': item.get('at'),
            })

        content_hash = compute_content_hash(normalized_messages)
        payload: dict[str, Any] = {
            'version': TRANSCRIPT_SCHEMA_VERSION,
            'tenantSlug': normalize_tenant_slug(tenant_slug),
            'chatId': str(chat_id),
            'nickname': (nickname or '').strip() or None,
            'extractedAt': _now_kst_iso(),
            'messageCount': len(normalized_messages),
            'messages': normalized_messages,
            'contentHash': content_hash,
            'scrollSteps': scroll_steps,
            'sourceUrl': source_url,
        }

        path = self.file_path(tenant_slug, chat_id)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        logger.info(
            'chat transcript saved chatId=%s tenant=%s messages=%s path=%s',
            chat_id,
            normalize_tenant_slug(tenant_slug),
            len(normalized_messages),
            path,
        )
        return payload


class ChatTranscriptExtractor:
    """현재 숨고 채팅방 DOM에서 전체 대화를 스크롤하며 수집."""

    def __init__(self, driver: WebDriver, delay: float = 0.35) -> None:
        self.driver = driver
        self.delay = delay

    def collect_messages(
        self,
        *,
        max_scroll_steps: int = 90,
        scroll_step_px: int = 520,
    ) -> tuple[list[dict[str, Any]], int, str | None]:
        try:
            raw = self.driver.execute_script(
                _JS_LOAD_AND_COLLECT,
                max_scroll_steps,
                scroll_step_px,
            )
        except Exception as e:
            logger.error('collect_messages js error: %s', e)
            return [], 0, str(e)

        if not isinstance(raw, dict):
            return [], 0, 'invalid_js_result'

        if not raw.get('ok'):
            return [], int(raw.get('scrollSteps') or 0), str(raw.get('error') or 'collect_failed')

        messages = raw.get('messages')
        if not isinstance(messages, list):
            messages = []

        cleaned: list[dict[str, Any]] = []
        for item in messages:
            if not isinstance(item, dict):
                continue
            role = str(item.get('role', '')).strip()
            text = str(item.get('text', '')).strip()
            if role in ('customer', 'pro') and text and not _is_transcript_noise(text):
                cleaned.append({'role': role, 'text': text, 'at': None})

        scroll_steps = int(raw.get('scrollSteps') or 0)
        time.sleep(self.delay * 0.2)
        return cleaned, scroll_steps, None

    def extract_and_store(
        self,
        *,
        chat_id: str,
        nickname: str | None,
        tenant_slug: str | None = None,
        max_scroll_steps: int = 90,
    ) -> dict[str, Any]:
        messages, scroll_steps, err = self.collect_messages(max_scroll_steps=max_scroll_steps)
        if err == 'message_input_not_found':
            raise ValueError('채팅 입력창을 찾을 수 없습니다. 숨고 채팅방이 열려 있는지 확인해 주세요.')
        if err:
            raise RuntimeError(f'대화 수집 실패: {err}')

        store = ChatTranscriptStore()
        existing = store.load(tenant_slug or DEFAULT_TENANT_SLUG, chat_id)
        new_hash = compute_content_hash(messages)
        if existing and existing.get('contentHash') == new_hash:
            logger.info('chat transcript unchanged chatId=%s — skip rewrite', chat_id)
            return existing

        try:
            source_url = self.driver.current_url
        except Exception:
            source_url = None

        return store.save(
            tenant_slug=tenant_slug or DEFAULT_TENANT_SLUG,
            chat_id=chat_id,
            nickname=nickname,
            messages=messages,
            scroll_steps=scroll_steps,
            source_url=source_url,
        )
