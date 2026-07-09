# SK클린텍 텔레CRM Android (사무실 내부용)

> **Play Store 심사 전** — 사무실 직원 sideload 테스트용. PC 마케터와 **동일 계정**으로 근무·예약 유치 일관성 유지.

## 앱 구성 (4탭)

| 탭 | 기능 |
|----|------|
| **발신** | 전화·문자 · 고객 검색 · 접수 요약 |
| **수신** | 통화 기록 → 서버 고객 정보 · 회신 |
| **업무** | 오늘 통화 건수·시간 · 솔루션 알림 배지 |
| **메시지** | PC `/admin/messages` 와 동일 1:1 대화 |

**실시간:** Foreground Service + `/ws?token=JWT` — 앱이 백그라운드·잠금 화면이어도 PC dispatch 수신. 통화는 **full-screen 알림** → 전화 앱 연결.

### 갤럭시(사무실폰) 권장 설정

1. 앱 최초 실행 시 **전체 화면 알림** 허용
2. **설정 → 배터리 → 백그라운드 사용 제한** 에서 「청소비서 전화」→ **제한 없음**
3. 상단 고정 알림 「PC 연결」이 켜져 있어야 백그라운드 수신이 안정적입니다

## 디자인

`docs/UI_DESIGN_GUIDE.md` **슬레이트 프리미엄 SaaS** + 커뮤니티 APP형 여백·카드 레이아웃.

- **로그인**: slate 히어로 + **청소비서 로고** + 겹치는 흰 카드 (`clean-secretary-logo.png`)
- **헤더**: 다크 GNB + 로고 · **탭 선택** `blue-600`
- **본문**: `#f4f6f8` 배경 · 둥근 카드 · 리스트 원형 아이콘 + chevron
- **폰트**: `sans-serif` (시스템 Noto Sans KR 계열)

## 설정·빌드

`local.properties` (선택 — 빌드 기본값):

```properties
sdk.dir=C\:\\Users\\user\\AppData\\Local\\Android\\Sdk
telecrm.apiBaseUrl=https://clean-solution-staging.up.railway.app
```

**로그인 화면에서 「운영 / 스테이징」** — **`pyo` 아이디만** 선택 가능합니다. 그 외 계정은 **항상 운영(`www.cbiseo.com`)** 에 연결됩니다.

| PC CRM 주소 | 앱 서버 | 대상 |
|-------------|---------|------|
| `www.cbiseo.com` | **운영** (자동) | 일반 계정 |
| Railway 스테이징 | **스테이징** (선택) | `pyo`만 |

Android Studio → `apps/telecrm-android` → Run ▶

## Phase 2~ (예정)

- CallLog 자동 연동·통화 시간
- FCM 백그라운드 푸시
- 웹 → 앱 SMS 큐
