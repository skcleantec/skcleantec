# 미소 브릿지 — 로컬 HTTP API 초안

텔레CRM ↔ **청소비서 미소 연동** (로컬) 계약 초안입니다.  
숨고 브릿지(`tools/soomgo-bridge/server.py`)와 **같은 사용 패턴**, **다른 포트**입니다.

- **Base URL:** `http://127.0.0.1:17891` (초안, 변경 시 README·텔레CRM 동시 수정)
- **Content-Type:** `application/json`
- **bridgeVersion:** `1` (PoC 통과 후 v0 구현 시 부여)

---

## v0 (PoC 게이트 통과 후 최소)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/status` | 브릿지·에뮬·미소 로그인·현재 방·버전 |
| POST | `/open-chats` | 채팅/문의 목록 화면 진입 + 스냅샷 |
| POST | `/extract` | 현재 방 상세 — 고객·요청·**상태·연락처(고용 후)** |
| POST | `/send-message` | `{ "message": "..." }` 채팅 전송 |

### GET `/status` — 응답 초안

```json
{
  "ok": true,
  "bridgeVersion": 1,
  "emulatorReady": true,
  "misoLoggedIn": true,
  "misoAppVersion": "x.y.z",
  "currentChatId": "…",
  "currentChatTitle": "…"
}
```

### POST `/open-chats` — 응답 초안

```json
{
  "ok": true,
  "items": [
    {
      "chatId": "…",
      "title": "…",
      "preview": "…",
      "updatedAt": "2026-07-23T12:00:00+09:00",
      "unread": false,
      "statusLabel": "견적 대기"
    }
  ]
}
```

### POST `/extract` — 응답 초안

[04-data-schema.md](./04-data-schema.md) `MisoExtractPayload` 참고.

### POST `/send-message`

**요청**

```json
{ "message": "안녕하세요, 청소비서입니다." }
```

**응답**

```json
{ "ok": true, "sentAt": "2026-07-23T12:00:00+09:00" }
```

---

## v1 (숨고 패리티 — 목표)

| Method | Path | 숨고 대응 | 미소 차이 |
|--------|------|-----------|-----------|
| POST | `/login` | `/login` | OTP 등 추가 필드 가능 |
| POST | `/watch-contact` | `/watch-call-button` | **고용 후 실번호** 노출 감시 |
| POST | `/ack-pending-contact` | `/ack-pending-call` | CRM 반영 완료 |
| POST | `/send-sequence` | `/send-sequence` | 다중 메시지·템플릿 |
| POST | `/request-update` | `/request-update` | Setup 자동 업데이트 |

---

## 에러 형식 (공통)

```json
{
  "ok": false,
  "error": "사용자에게 보일 한 줄 메시지",
  "code": "MISO_NOT_LOGGED_IN"
}
```

**code 예시 (초안):**

| code | 의미 |
|------|------|
| `BRIDGE_NOT_READY` | 에뮬/앱 미기동 |
| `MISO_NOT_LOGGED_IN` | 미소 로그인 필요 |
| `NO_CHAT_SELECTED` | extract 전 방 미선택 |
| `CONTACT_NOT_AVAILABLE` | 고용 전 등 번호 없음 |
| `UI_CHANGED` | 셀렉터/화면 불일치 (앱 업데이트) |

---

## 텔레CRM 호출 순서 (초안)

1. 페이지 로드 → `GET /status`
2. 「미소 연동」 열기 → `POST /open-chats` (목록 캐시)
3. 방 선택 → (내부 state) → `POST /extract`
4. 「정보 가져오기」→ extract 결과 → `/api/crm/*` lookup
5. 「채팅 보내기」→ `POST /send-message`
6. 고용 후 → `POST /watch-contact` (v1) → 번호 → CRM·Android 다이얼 (**자동 발신 없음**, 숨고와 동일)

---

## 구현 시 숨고 브릿지 참고 파일

| 미소 (예정) | 숨고 |
|-------------|------|
| `server.py` | `tools/soomgo-bridge/server.py` |
| `automation/` | `tools/soomgo-bridge/automation/` |
| `desktop/tray_app.py` | 동명 |
| 매니페스트 | `GET /api/public/soomgo-bridge/manifest` → miso-bridge 별도 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-23 | v0/v1 초안 작성 |
