# 숨고 브릿지 ↔ 미소 브릿지 기능 대응

**목표:** 텔레CRM에서 **같은 버튼·같은 흐름**, 채널만 「숨고 / 미소」로 분기.

---

## 아키텍처

```
텔레CRM (브라우저)
    ├─ http://127.0.0.1:17890  →  청소비서 숨고 연동  →  Chrome + 숨고 웹
    └─ http://127.0.0.1:17891  →  청소비서 미소 연동  →  Android + 미소 앱
              │
              └─ /api/crm/*  (청소비서 서버 — 채널 공통)
```

동시 실행: **가능** (포트·프로세스 분리)

---

## 기능 대응표

| 기능 | 숨고 | 미소 | 비고 |
|------|------|------|------|
| 로컬 브릿지 | ○ | ○ (예정) | |
| 로그인 | 이메일/비번 | 앱 로그인 (+OTP?) | PoC 확인 |
| 채팅 목록 | ○ | ○ | |
| 상세·요청 정보 | 고객 요청 **모달** | 채팅 **헤더 박스 탭** → 정보 화면 | UI 다름, extract 동급 |
| 견적/예약 상태 | ○ | ○ (목표) | statusCode 매핑 |
| 연락처 | **0504 안심번호** | **고용 후 실번호** | UX 문구 다름 |
| 번호 감시 | watch-call-button | watch-contact (v1) | 고용 이벤트 |
| 채팅 보내기 | ○ | ○ | |
| 순차 메시지 | send-sequence | v1 | |
| CRM 자동 발신 | **없음** | **없음** | 다이얼만 |
| Setup·트레이 | ○ | Phase 4 | |
| 매니페스트 | soomgo-bridge | miso-bridge | Railway 변수 별도 |

---

## 텔레CRM UI (추가 예정)

| 숨고 연동 | 미소 연동 (초안) |
|-----------|------------------|
| 설치 프로그램 다운로드 | 동일 패턴 |
| 연동 상태 표시 | `/status` |
| 정보 가져오기 | `/extract` |
| (안심번호) | **연락처 가져오기** (고용 후) |
| 채팅 보내기 | `/send-message` |

---

## 숨고만 / 미소만

| | 숨고만 | 미소만 |
|---|--------|--------|
| | Chrome 필수 | 에뮬/가상 Android |
| | 웹 DOM 자동화 | Appium/UIAutomator 등 |
| | 안심번호 0504 | 고용 전 번호 없음 |

---

## 구현 참고 (숨고)

| 영역 | 경로 |
|------|------|
| HTTP 서버 | `tools/soomgo-bridge/server.py` |
| 채팅·extract | `automation/chat_room.py`, `customer_request.py` |
| 안심번호 | `automation/call_modal.py`, `chat_list_watcher.py` |
| 트레이·업데이트 | `desktop/tray_app.py`, `update_manager.py` |
| 문서 | `tools/soomgo-bridge/README.md` |

미소는 **동일 디렉터리 레이아웃**을 `tools/miso-bridge/`에 두는 것을 권장 (Phase 3).
