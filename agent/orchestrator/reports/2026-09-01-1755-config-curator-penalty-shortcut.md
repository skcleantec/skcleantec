# ConfigCurator — 위약 기준일 · 알림톡 바로가기

**일시:** 2026-09-01 17:55 KST

## 신규 표시 신호

- [x] `alimtalk.scheduleD2.brandCancellationShortcut` — 브랜드 위약금 설정 바로가기
- [x] `operatingCompany.cancellation.freeChangeDeadline` — 위약 없이 바꿀 수 있는 마지막 날
- [x] `alimtalk.scheduleD2.sendHour` notes 갱신 (기준일 = 위약금 탭)

## 설정 위치

| 무엇을 | 어디 |
|--------|------|
| 마지막 날 (2/3/직접) | 영업브랜드 수정 → 위약금 |
| 알림 ON/OFF | 알림톡 → 무위약 마감일 (자동) |
| N일 전 (고급) | 알림톡 → 고급 details |

## help

- `?` 툴팁: 바로가기 안내 (`alimtalkTemplateHelp`)
- 기준일 없으면 알림톡에 노란 안내

## RoleQA 1줄

관리자가 알림톡에서 바로가기를 누르면 위약금 탭이 열리고, 2일을 고르면 미리보기에 낮 12시가 보인다.
