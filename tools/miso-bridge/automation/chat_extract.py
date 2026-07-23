"""Scrape current chat detail via header box -> request info screen."""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone, timedelta
from typing import Any

from automation.adb_client import first_online_emulator, get_foreground_package, shell, tap
from automation.anr_guard import dismiss_blocking_dialogs, ensure_emulator_responsive
from automation.chat_list import (
    _adb_lock,
    _chat_id,
    _now_iso,
    _open_chats_body,
    find_row_by_chat_id,
    open_chat_by_id,
    parse_list_rows,
    tap_chat_row,
)
from automation.uiautomator import (
    collect_nodes,
    dump_ui,
    parse_bounds,
    press_back,
    tap_node,
)
from bridge_config import MISO_PACKAGE

KST = timezone(timedelta(hours=9))

DATE_IN_DESC_RE = re.compile(r'\d+월\s*\d+일')
MASKED_NAME_RE = re.compile(r'^[^\s]{1,6}\*[^\s]{0,6}$')

DETAIL_BACK_BOUNDS = (42, 189, 105, 252)
HEADER_BOX_FALLBACK_CENTER = (540, 431)
PHONE_ICON_FALLBACK_CENTER = (985, 220)
PHONE_MODAL_MARKERS = ('전화번호', '연락처', '통화하기', '전화하기', '휴대폰 번호', '고객 연락처')

LABEL_FIELDS: dict[str, str] = {
    '견적 금액': 'quoteAmount',
    '견적 제출 일시': 'quoteSubmittedAt',
    '평 수': 'areaPyung',
    '서비스 타입': 'serviceTypeDetail',
    '방 개수': 'roomLayout',
    '거주지 종류': 'residenceType',
    '거주지 종...': 'residenceType',
    '서비스 주소': 'serviceAddress',
    '복층 여부': 'duplexFlag',
}

STATUS_TO_CODE: dict[str, str] = {
    '기한 만료': 'EXPIRED',
    '견적 대기': 'QUOTE_PENDING',
    '고용 완료': 'HIRED',
    '고용': 'HIRED',
}


def collect_texts(root) -> list[str]:
    out: list[str] = []
    for n in collect_nodes(root):
        t = n.text
        if t and len(t) < 500:
            out.append(t)
    return out


def find_date_summary_box(root) -> tuple[tuple[int, int, int, int] | None, str]:
    """채팅 상세 — 이름 아래 **날짜가 있는 요약 박스** (탭 → 요청 정보 화면)."""
    best: tuple[int, tuple[tuple[int, int, int, int], str]] | None = None
    for n in collect_nodes(root):
        d = n.content_desc
        if not d or ',' not in d:
            continue
        if not DATE_IN_DESC_RE.search(d):
            continue
        bounds = parse_bounds(n.bounds)
        if not bounds:
            continue
        _x1, y1, _x2, y2 = bounds
        if y1 > 700 or y2 < 250:
            continue
        score = 100
        if n.clickable:
            score += 10
        if any(k in d for k in ('기한', '견적', '청소', '이사', '상담', '￦', '₩', '원')):
            score += 5
        if best is None or score > best[0] or (score == best[0] and y1 < best[1][0][1]):
            best = (score, (bounds, d))
    if best:
        return best[1]
    return None, ''


def find_header_box(root) -> tuple[tuple[int, int, int, int] | None, str]:
    """Backward-compatible alias — prefer date summary box."""
    box, desc = find_date_summary_box(root)
    if box:
        return box, desc
    best: tuple[tuple[int, int, int, int], str] | None = None
    for n in collect_nodes(root):
        d = n.content_desc
        if not d or ',' not in d:
            continue
        if not any(k in d for k in ('이사', '청소', '상담', '￦', '₩', '기한', '견적', '원')):
            continue
        bounds = parse_bounds(n.bounds)
        if not bounds:
            continue
        _x1, y1, _x2, y2 = bounds
        if y1 > 700:
            continue
        if best is None or y1 < best[0][1]:
            best = (bounds, d)
    if best:
        return best
    return None, ''


def parse_header_summary(desc: str) -> dict[str, Any]:
    parts = [p.strip() for p in desc.split(',')]
    status = parts[1] if len(parts) > 1 else ''
    code = STATUS_TO_CODE.get(status, 'UNKNOWN')
    return {
        'serviceDate': parts[0] if parts else '',
        'rawStatusText': status,
        'statusLabel': status,
        'statusCode': code,
        'serviceType': parts[2] if len(parts) > 2 else '',
        'priceHint': parts[3] if len(parts) > 3 else '',
    }


def scroll_order_detail(serial: str | None) -> None:
    """Scroll request-info screen to reveal 서비스 주소 (below fold)."""
    for _ in range(2):
        shell(serial, 'input swipe 540 1700 540 700 350', timeout=10)
        time.sleep(0.45)


def merge_detail_texts(primary: list[str], secondary: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for t in primary + secondary:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def parse_order_detail(texts: list[str]) -> dict[str, Any]:
    detail: dict[str, Any] = {'quoteSubmittedAuto': '자동' in texts}
    if texts and '청소' in texts[0]:
        detail['screenTitle'] = texts[0]
    for i, t in enumerate(texts):
        key = LABEL_FIELDS.get(t)
        if not key:
            continue
        for j in range(i + 1, len(texts)):
            nxt = texts[j]
            if nxt in LABEL_FIELDS or nxt in ('견적 정보', '주문 정보', '자동'):
                continue
            if nxt.startswith('메모'):
                continue
            detail[key] = nxt
            break
    for t in texts:
        if re.match(r'\d+월 \d+일', t):
            detail.setdefault('serviceDate', t)
            break
    for t in texts:
        if t in STATUS_TO_CODE:
            detail.setdefault('statusLabel', t)
            detail.setdefault('statusCode', STATUS_TO_CODE[t])
            break
    return detail


def parse_customer_name(root) -> str:
    """채팅 상세 상단 GNB — `이*화` 마스킹 이름 그대로."""
    masked: list[tuple[int, str]] = []
    for n in collect_nodes(root):
        t = n.text.strip()
        if not t or '메시지' in t:
            continue
        bounds = parse_bounds(n.bounds)
        y1 = bounds[1] if bounds else 9999
        if y1 > 320:
            continue
        if MASKED_NAME_RE.match(t):
            masked.append((y1, t))
    if masked:
        masked.sort(key=lambda x: x[0])
        return masked[0][1]
    for n in collect_nodes(root):
        t = n.text.strip()
        if t.endswith(' 고객') and len(t) < 20:
            return t.replace(' 고객', '').strip()
    return ''


def normalize_phone(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 11 and digits.startswith('010'):
        return f'{digits[:3]}-{digits[3:7]}-{digits[7:]}'
    if len(digits) == 10 and digits.startswith('01'):
        return f'{digits[:3]}-{digits[3:6]}-{digits[6:]}'
    return raw.strip()


def parse_phones(root) -> list[str]:
    blob = '\n'.join(f'{n.text}\n{n.content_desc}' for n in collect_nodes(root))
    seen: set[str] = set()
    out: list[str] = []
    for m in re.finditer(r'0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}', blob):
        formatted = normalize_phone(m.group(0))
        if formatted not in seen:
            seen.add(formatted)
            out.append(formatted)
    return out


def find_phone_icon_bounds(root) -> tuple[int, int, int, int] | None:
    """채팅 상세 우측 상단 전화 아이콘."""
    icon_candidates: list[tuple[int, tuple[int, int, int, int]]] = []
    for n in collect_nodes(root):
        if not n.clickable:
            continue
        bounds = parse_bounds(n.bounds)
        if not bounds:
            continue
        x1, y1, x2, y2 = bounds
        if y2 > 320 or y1 < 120 or x1 < 820:
            continue
        blob = f'{n.text} {n.content_desc}'.lower()
        score = x1
        if any(k in blob for k in ('전화', 'phone', 'call', '통화')):
            score += 500
        if x1 >= 900 and (x2 - x1) <= 140 and (y2 - y1) <= 140:
            score += 100
        if score >= 100:
            icon_candidates.append((score, bounds))
    if icon_candidates:
        icon_candidates.sort(key=lambda x: -x[0])
        return icon_candidates[0][1]
    return None


def is_phone_modal_open(root) -> bool:
    texts = collect_texts(root)
    blob = '\n'.join(texts)
    return any(marker in blob for marker in PHONE_MODAL_MARKERS)


def dismiss_phone_modal(serial: str | None) -> None:
    press_back(serial, 1)
    time.sleep(0.6)


def extract_phone_via_call_icon(serial: str | None, chat_root) -> tuple[str | None, bool, str | None]:
    """
    채팅 상세 우측 전화 아이콘 → 모달에서만 번호 추출 (채팅 버블 번호는 무시).
    """
    icon = find_phone_icon_bounds(chat_root)
    if not icon:
        return None, False, None

    tap_bounds(serial, icon)
    time.sleep(1.6)

    modal_root = dump_ui(serial, 'miso-phone-modal')
    if not is_phone_modal_open(modal_root):
        return None, False, None

    blob = '\n'.join(collect_texts(modal_root))
    phones = parse_phones(modal_root)
    dismiss_phone_modal(serial)

    if phones:
        return phones[0], True, None

    note = None
    if any(k in blob for k in ('고용', '표시되지', '없습니다', '상담', '채팅')):
        note = '고용·상담 상태에 따라 연락처가 표시되지 않습니다.'
    return None, False, note


def parse_messages_preview(root) -> str | None:
    """가장 최근 고객 채팅 버블 1건 (상담사·시스템 메시지 제외)."""
    candidates: list[tuple[int, str]] = []
    for n in collect_nodes(root):
        d = n.content_desc
        if not d or len(d) < 8:
            continue
        if any(x in d for x in ('고객,', '기한', 'send', '더보기', '마감')):
            continue
        if '메시지' in d or '상담사:' in d or '청소업체 선정' in d:
            continue
        bounds = parse_bounds(n.bounds)
        if not bounds:
            continue
        x1, y1, _x2, _y2 = bounds
        if x1 > 850:
            continue
        candidates.append((y1, d[:500]))
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]
    texts = [t for t in collect_texts(root) if len(t) > 10 and '메시지' not in t and '상담사:' not in t]
    return texts[-1][:200] if texts else None


def is_chat_detail(root) -> bool:
    if find_header_box(root)[0]:
        return True
    list_rows = parse_list_rows(root)
    if len(list_rows) >= 2:
        return False
    for n in collect_nodes(root):
        blob = f'{n.text} {n.content_desc}'.strip()
        if '메시지' in blob and ('입력' in blob or '입력해' in blob):
            return True
        if n.content_desc == 'send':
            return True
        if n.text == '메시지를 입력해주세요':
            return True
    return False


def is_on_miso_chat_screen(root) -> bool:
    """채팅방이 이미 열린 상태 — 목록으로 나가지 않도록 넓게 판별."""
    if is_chat_detail(root):
        return True
    name = parse_customer_name(root)
    box, _desc = find_date_summary_box(root)
    if name and box:
        return True
    if name and any(n.content_desc == 'send' or n.text == '메시지를 입력해주세요' for n in collect_nodes(root)):
        return True
    return False


def _guess_chat_id(root, fallback: str | None = None) -> str:
    if fallback:
        return fallback
    for n in collect_nodes(root):
        if n.clickable and n.content_desc and ' 고객' in n.content_desc:
            return _chat_id(n.content_desc)
    customer = parse_customer_name(root)
    if customer:
        return _chat_id(customer)
    return ''


def tap_bounds(serial: str | None, bounds: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = bounds
    tap(serial, (x1 + x2) // 2, (y1 + y2) // 2)


def _ensure_chat_detail(serial: str | None, chat_id: str | None) -> tuple[str, Any | None]:
    dismiss_blocking_dialogs(serial)

    root = dump_ui(serial, 'miso-extract-check')
    if is_on_miso_chat_screen(root):
        return _guess_chat_id(root, chat_id), root

    if get_foreground_package(serial) == MISO_PACKAGE:
        root = dump_ui(serial, 'miso-extract-check-2')
        if is_on_miso_chat_screen(root):
            return _guess_chat_id(root, chat_id), root

    target_id = (chat_id or '').strip()
    result = _open_chats_body(serial, gentle=True)
    if not result.get('ok'):
        raise RuntimeError(str(result.get('error') or '채팅 목록을 열 수 없습니다.'))
    rows: list[dict[str, Any]] = list(result.get('items') or [])

    if not target_id:
        if rows:
            target_id = str(rows[0].get('chatId') or '')
        else:
            return '', None

    if not target_id:
        return '', None

    try:
        open_chat_by_id(serial, target_id)
    except RuntimeError:
        root = dump_ui(serial, 'miso-extract-list-retry')
        rows = parse_list_rows(root)
        row = find_row_by_chat_id(rows, target_id) or (rows[0] if rows else None)
        if not row:
            raise
        tap_chat_row(serial, row)
        time.sleep(2.2)

    root = dump_ui(serial, 'miso-extract-chat')
    if not is_on_miso_chat_screen(root):
        rows = parse_list_rows(root)
        row = find_row_by_chat_id(rows, target_id) or (rows[0] if rows else None)
        if row:
            tap_chat_row(serial, row)
            time.sleep(2.2)
            root = dump_ui(serial, 'miso-extract-chat-retry')

    if not is_on_miso_chat_screen(root):
        return target_id, None

    return _guess_chat_id(root, target_id), root


def build_extract_payload(
    *,
    chat_id: str,
    customer_name: str,
    header: dict[str, Any],
    order_detail: dict[str, Any],
    phone: str | None,
    phone_available: bool,
    phone_note: str | None,
    messages_preview: str | None,
) -> dict[str, Any]:
    summary_parts = [
        order_detail.get('serviceTypeDetail'),
        order_detail.get('areaPyung'),
        order_detail.get('roomLayout'),
    ]
    summary = ' / '.join(p for p in summary_parts if p)
    status_code = header.get('statusCode') or order_detail.get('statusCode') or 'UNKNOWN'
    payload: dict[str, Any] = {
        'ok': True,
        'source': 'miso',
        'extractedAt': _now_iso(),
        'chatId': chat_id or None,
        'customerName': customer_name or None,
        'phone': phone,
        'phoneAvailable': phone_available,
        'requestSummary': summary or header.get('serviceType') or '',
        'serviceAddress': order_detail.get('serviceAddress') or None,
        'address': order_detail.get('serviceAddress') or None,
        'statusLabel': header.get('statusLabel') or order_detail.get('statusLabel'),
        'statusCode': status_code,
        'quoteAmount': order_detail.get('quoteAmount') or header.get('priceHint'),
        'scheduledAt': order_detail.get('serviceDate') or header.get('serviceDate'),
        'rawStatusText': header.get('rawStatusText') or order_detail.get('statusLabel'),
        'messagesPreview': messages_preview,
        'orderDetail': order_detail,
    }
    if phone_note:
        payload['phoneNote'] = phone_note
    return payload


def extract_current_chat(*, chat_id: str | None = None) -> dict[str, Any]:
    with _adb_lock:
        device = first_online_emulator()
        if not device:
            return {
                'ok': False,
                'error': '에뮬레이터(adb)가 연결되지 않았습니다.',
                'code': 'BRIDGE_NOT_READY',
            }

        serial = device.serial
        blocked = ensure_emulator_responsive(serial)
        if blocked:
            return {'ok': False, 'error': blocked, 'code': 'ADB_ANR'}
        try:
            resolved_id, chat_root = _ensure_chat_detail(serial, chat_id)
        except RuntimeError as e:
            return {'ok': False, 'error': str(e), 'code': 'UI_CHANGED'}
        except Exception as e:
            err_name = type(e).__name__
            if 'Timeout' in err_name:
                return {
                    'ok': False,
                    'error': (
                        '에뮬레이터가 응답하지 않습니다. 「응답 없음」 팝업이 떠 있으면 「대기」를 누르고, '
                        '미소 채팅방을 연 뒤 다시 시도해 주세요.'
                    ),
                    'code': 'ADB_TIMEOUT',
                }
            raise

        if chat_root is None:
            return {
                'ok': False,
                'error': (
                    '채팅방을 열지 못했습니다. 에뮬레이터에서 미소 **채팅 상세**를 연 뒤 '
                    '「미소 정보」를 다시 눌러 주세요.'
                ),
                'code': 'NO_CHAT_SELECTED',
            }

        customer = parse_customer_name(chat_root)
        messages_preview = parse_messages_preview(chat_root)
        box_bounds, header_desc = find_date_summary_box(chat_root)
        if not box_bounds:
            box_bounds, header_desc = find_header_box(chat_root)
        header = parse_header_summary(header_desc) if header_desc else {}

        if box_bounds:
            tap_bounds(serial, box_bounds)
        else:
            tap(serial, *HEADER_BOX_FALLBACK_CENTER)
        time.sleep(2.0)

        detail_root = dump_ui(serial, 'miso-extract-detail')
        texts = collect_texts(detail_root)
        scroll_order_detail(serial)
        scrolled_root = dump_ui(serial, 'miso-extract-detail-scroll')
        texts = merge_detail_texts(texts, collect_texts(scrolled_root))
        order_detail = parse_order_detail(texts)

        tap_bounds(serial, DETAIL_BACK_BOUNDS)
        time.sleep(1.0)

        phone_root = dump_ui(serial, 'miso-phone-chat')
        phone, phone_available, phone_note = extract_phone_via_call_icon(serial, phone_root)

        has_order = any(
            order_detail.get(k)
            for k in (
                'serviceTypeDetail',
                'areaPyung',
                'roomLayout',
                'quoteAmount',
                'serviceDate',
                'serviceAddress',
            )
        )
        if not customer and not header.get('serviceDate') and not has_order:
            return {
                'ok': False,
                'error': '요청 정보를 읽지 못했습니다. 날짜 요약 박스가 보이는 채팅방인지 확인해 주세요.',
                'code': 'UI_CHANGED',
            }

        payload = build_extract_payload(
            chat_id=resolved_id or _chat_id(header_desc or customer or 'miso'),
            customer_name=customer,
            header=header,
            order_detail=order_detail,
            phone=phone,
            phone_available=phone_available,
            phone_note=phone_note,
            messages_preview=messages_preview,
        )

        after = dump_ui(serial, 'miso-extract-after')
        if not is_on_miso_chat_screen(after):
            press_back(serial, 1)

        return payload
