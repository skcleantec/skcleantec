# 해피콜 푸시 cron (Railway · GitHub Actions)

예약일 **전날 23:59(KST) 마감** 전·**마감 초과(미완)** 시 팀장에게 FCM 푸시를 보냅니다.  
테넌트 정책(`TenantNotificationPolicy`)·사용자 설정·`NotificationDeliveryLog` dedupe를 따릅니다.

## API (운영 단일 진입)

| 항목 | 값 |
|---|---|
| **메서드·경로** | `POST /api/admin/cron/happy-call-reminders` |
| **인증** | `Authorization: Bearer <secret>` 또는 헤더 `x-cron-secret: <secret>` |
| **Secret** | Railway Variables **`HAPPY_CALL_CRON_SECRET`** (없으면 **`BILLING_CRON_SECRET`** 폴백) |
| **dry-run** | 쿼리 `?dryRun=1` — DB 기록·FCM 없이 집계만 |

로컬 스크립트(동일 로직):

```bash
cd server
npm run cron:happy-call-reminders
npm run cron:happy-call-reminders -- --dry-run
```

## Railway Cron Job (권장)

1. Railway 프로젝트 → **+ New** → **Cron Job** (또는 기존 서비스에 Cron 스케줄 추가)
2. **Schedule**: `*/15 * * * *` (15분마다) — 정책의 `repeatIntervalMinutes`와 맞추면 됩니다.
3. **Command** (서비스가 동일 이미지를 쓰는 경우):

   ```bash
   node server/scripts/run-happy-call-reminders.mjs
   ```

   또는 HTTP 호출만 쓰는 경우(UptimeRobot·외부 ping):

   ```bash
   curl -sf -X POST "https://www.cbiseo.com/api/admin/cron/happy-call-reminders" \
     -H "Authorization: Bearer $HAPPY_CALL_CRON_SECRET"
   ```

4. Variables에 **`HAPPY_CALL_CRON_SECRET`** 설정 (스테이징·운영 각각).  
   GitHub Actions를 쓸 경우 Repository secrets에도 동일 이름으로 등록합니다.

## GitHub Actions (선택)

`.github/workflows/happy-call-reminders.yml` — **수동·스케줄** 실행 시 운영 URL을 `POST`합니다.

필요 secrets:

| Secret | 설명 |
|---|---|
| `HAPPY_CALL_CRON_SECRET` | API Bearer |
| `CBISEO_CRON_BASE_URL` | 예: `https://www.cbiseo.com` (스테이징은 staging URL) |

## 스테이징 검증

1. `HAPPY_CALL_CRON_SECRET` 설정 후  
   `POST …/happy-call-reminders?dryRun=1` → `200` + `pushesSent`/`skipped` JSON
2. dry-run 없이 1회 실행 → 팀장 앱(Play)에서 해피콜 문구·딥링크 확인
3. 관리자 **알림 정책**에서 해피콜 반복 간격·마감 전 알림 분 변경 후 재실행

## 관련 코드

| 파일 | 역할 |
|---|---|
| `server/src/modules/notifications/happyCallReminder.service.ts` | job 본문 |
| `server/src/modules/notifications/happyCallReminder.cron.routes.ts` | HTTP cron |
| `server/scripts/run-happy-call-reminders.ts` | CLI |
| `shared/notificationPolicy.ts` | 테넌트·사용자 정책 |
