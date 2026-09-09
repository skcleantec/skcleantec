# DesignPulse — 팀장 길안내 시트

## Research notes

AppScout: 하단 시트 + 앱 선택. 웹 딥링크만 쓰지 않음.

## Findings

| 면 | 상태 |
|----|------|
| **팀 모바일** | 상세 푸터 `variant=bar`. 시트 `z-[130]`, `mb-[max(4.5rem, safe-area)]` — 하단바·시스템 바와 분리. |
| **아이콘** | `line-md` `map-marker` / `navigation-left-up` / `compass` / `close`. |
| **버튼** | hover / focus-visible / disabled 있음. Primary는 업데이트 CTA만 `bg-slate-900`. |
| **PC** | `canLaunchStaffFieldNavi` false → 「휴대폰에서」. |

## Severity

없음. 구 앱 문구는 시트 안 빨간 안내 + Play 버튼.

## Suggested diff

추가 UI 없음. 웹만 푸시해도 구 앱은 업데이트 안내가 떠야 함 (openNavi 가드).
