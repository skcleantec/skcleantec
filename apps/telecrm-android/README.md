# SK클린텍 텔레CRM Android (사무실 내부용)

> **Play Store 심사 전** — 사무실 직원 sideload 테스트용. PC 마케터와 **동일 계정**으로 근무·예약 유치 일관성 유지.

## 앱 구성 (4탭)

| 탭 | 기능 |
|----|------|
| **발신** | 전화·문자 · 고객 검색 · 접수 요약 |
| **수신** | 통화 기록 → 서버 고객 정보 · 회신 |
| **업무** | 오늘 통화 건수·시간 · 솔루션 알림 배지 |
| **메시지** | PC `/admin/messages` 와 동일 1:1 대화 |

**실시간:** `/ws?token=JWT` — `inbox:refresh`, 접수 축하, 접수 변동, 페이백 등 → Snackbar + 목록 재조회

## 디자인

`docs/UI_DESIGN_GUIDE.md` **슬레이트 프리미엄 SaaS** + 커뮤니티 APP형 여백·카드 레이아웃.

- **로그인**: slate 히어로 + **청소비서 로고** + 겹치는 흰 카드 (`clean-secretary-logo.png`)
- **헤더**: 다크 GNB + 로고 · **탭 선택** `blue-600`
- **본문**: `#f4f6f8` 배경 · 둥근 카드 · 리스트 원형 아이콘 + chevron
- **폰트**: `sans-serif` (시스템 Noto Sans KR 계열)

## 설정·빌드

`local.properties`:

```properties
sdk.dir=C\:\\Users\\user\\AppData\\Local\\Android\\Sdk
telecrm.apiBaseUrl=https://YOUR-STAGING-HOST
```

Android Studio → `apps/telecrm-android` → Run ▶

## Phase 2~ (예정)

- CallLog 자동 연동·통화 시간
- FCM 백그라운드 푸시
- 웹 → 앱 SMS 큐
