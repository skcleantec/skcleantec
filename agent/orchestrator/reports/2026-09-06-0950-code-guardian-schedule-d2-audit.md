# CodeGuardian — 고객 위약·일정확인 알림 (전일?)

**일시:** 2026-09-06 09:50 KST

## 결론

코드는 **청소일 전날이 아니라, 무위약 마감일 당일 낮 12시(KST)** 에 솔라피 알림톡을 보냅니다.  
브랜드 미설정 폴백은 `freeChangeDaysBefore = 2` → **청소일 2일 전**입니다. 「전일(1일 전)」이 되려면 위약금 탭에서 1로 두어야 합니다.

## 경로

| 단계 | 파일 |
|------|------|
| cron 15분 | `infra/happy-call-cron/railway.json` → `POST /api/admin/cron/alimtalk-schedule-d2` |
| job | `alimtalkScheduleD2.service.ts` |
| 발송일 | `computeScheduleD2SendYmd` — 정책 ON + 마감일 = 오늘 |
| 시각 | `hour >= 12` KST |
| 본문 | `CBISEO_CUST_SCHEDULE_D2` |
| 중복 | `AlimtalkSendLog` 건당 1회 |

## 빠지는 경우

- 위약 정책 OFF / 마감일 계산 불가
- 알림톡 모듈 OFF, 템플릿 OFF, 잔액 부족
- 상태 not in RECEIVED·ASSIGNED·IN_PROGRESS·CS_PROCESSING
- 연락처 없음, 발주서/연계 없음
- 이미 발송됨
- 지금(09:50)은 낮 12시 전이라 **오늘 분은 아직 안 나감**

## DB (연결된 DATABASE_URL)

- `CBISEO_CUST_SCHEDULE_D2` 로그 **전체 0건**
- 알림톡 로그 자체 0건 — 운영 발송 이력이 있는 DB가 아닐 수 있음
- `sk` 브랜드 `cancellationPolicy` 없음 → 코드 폴백 2일 전
