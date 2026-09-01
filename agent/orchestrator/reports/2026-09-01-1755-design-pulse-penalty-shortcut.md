# DesignPulse — 위약 알림 UX · 바로가기

**일시:** 2026-09-01 17:55 KST  
**대상:** 알림톡 설정, 영업브랜드 위약금 탭

## 패턴

- 설정 본체와 발송 ON/OFF를 분리 (SaaS: 정책은 브랜드, 채널은 알림 화면)
- 딥링크 `?tab=cancellation` — 새로고침 후에도 동일 의도 유지
- 프리셋 칩 2/3/직접 — 숫자만 두지 않음
- 고급 숫자는 `<details>` — 평소 화면에서 숨김

## PC · 모바일

- 바로가기: `bg-slate-900` CTA, `text-fluid-xs`, hover/focus/disabled
- 안내 배너: `px-2.5 py-1.5 text-fluid-2xs` (좁은 화면 1줄)
- 프리셋: `flex-wrap` — 모바일에서 줄바꿈

## 잔여

- 영업브랜드 수정 모달은 기존 `z-50` 유지 (이번 범위 밖)
