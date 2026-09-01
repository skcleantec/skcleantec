# 일정확인 알림톡 cron (`CBISEO_CUST_SCHEDULE_D2`)

**고객**에게 **카카오 알림톡**으로 무위약 마감일·일정 확인 안내를 보냅니다.  
팀장 **해피콜**과 별개 — 해피콜은 앱 FCM, 본 기능은 **솔라피 알림톡**입니다.

## API

| 항목 | 값 |
|---|---|
| **경로** | `POST /api/admin/cron/alimtalk-schedule-d2` |
| **인증** | `Authorization: Bearer <secret>` 또는 `x-cron-secret` |
| **Secret** | `ALIMTALK_CRON_SECRET` → 없으면 `HAPPY_CALL_CRON_SECRET` → `BILLING_CRON_SECRET` |
| **dry-run** | `?dryRun=1` — 발송·과금 없이 후보만 집계 |
| **시각 가드 생략** | dry-run + `?skipTimeWindow=1` (낮 12:00 이전 테스트) |

## 발송 조건 (요약)

- 테넌트 알림톡 라이선스 + `CBISEO_CUST_SCHEDULE_D2` 템플릿 ON
- 접수 `sendYmd` = **오늘 KST** (기본: 무위약 마감일 당일. 테넌트가 N을 지정하면 위약 발생일 − N일)
- KST **낮 12:00 이후** (`isScheduleD2SendWindowOpen`, `SCHEDULE_D2_SEND_HOUR_KST`)
- 건당 1회 (`AlimtalkSendLog` dedupe)

## cron 연동 (필수)

**해피콜과 동일 Railway Cron Job** — `infra/happy-call-cron/railway.json` 이 15분마다 **두 URL**을 호출합니다.

배포 후 검증:

```bash
curl -sf -X POST "${CRON_BASE_URL}/api/admin/cron/alimtalk-schedule-d2?dryRun=1" \
  -H "Authorization: Bearer ${HAPPY_CALL_CRON_SECRET}"
```

`sendWindowOpen: true` 이고 `candidates` > 0 이면, dry-run 없이 1회 실행해 `AlimtalkSendLog`를 확인합니다.

## 관련 코드

| 파일 | 역할 |
|---|---|
| `server/src/modules/alimtalk/alimtalkScheduleD2.service.ts` | job 본문 |
| `server/src/modules/alimtalk/alimtalkScheduleD2.cron.routes.ts` | HTTP cron |
| `docs/알림톡/메시지/솔라피_템플릿_명세.md` | 템플릿 본문 |
