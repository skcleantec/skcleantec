# 해피콜 푸시 · 일정확인 알림톡 cron (Railway · GitHub Actions)

> **같은 15분 cron**이 아래 **두 API**를 순서대로 `POST`합니다.  
> · **팀장 해피콜** = FCM 앱 푸시 (알림톡 아님)  
> · **고객 일정확인** = 솔라피 **`CBISEO_CUST_SCHEDULE_D2` 알림톡** (매일 **낮 12:00 KST** 이후 1회/건)

**청소일(예약일) 전날 18:00(KST)** 부터 해피콜이 **미완**이면 **1시간마다** 팀장에게 FCM 푸시를 보냅니다(완료까지).  
**예약일이 오늘·내일(KST)인 건만** cron 후보 — **지난 예약일** 미완은 화면에 남을 수 있으나 **푸시 없음**.  
테넌트 정책(`TenantNotificationPolicy`)·사용자 설정·`NotificationDeliveryLog` dedupe를 따릅니다.

**일정확인 알림톡** 상세·dry-run: `docs/ALIMTALK_SCHEDULE_D2_CRON.md`

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

메인 API(`clean solution`)와 **별도 Cron Job 서비스**로 두는 것을 권장합니다.  
메인 앱 루트 `railway.json`의 `startCommand: npm run start`·무거운 `preDeployCommand`를 그대로 물려받으면 Cron 배포가 **SKIPPED**·실패합니다.

### Custom Start Command가 잠길 때

대시보드에 **「railway.json 문구가 없어야 입력 가능」** 이 보이면, 이 Cron 서비스에 **루트 `/railway.json` Config-as-code**가 적용 중입니다. Source를 Docker 이미지로 바꿔도 **레포 연결 + Config File 경로**가 남아 있으면 UI는 계속 잠깁니다.

**해결 (둘 중 하나):**

| 방법 | 절차 |
|---|---|
| **A. UI에서 직접** | Cron 서비스 → **Settings** → **Config-as-code file** (또는 Railway config file) → **`/railway.json` 삭제(비움)** → 저장 → Custom Start Command 입력 |
| **B. 전용 config (권장)** | 같은 레포 연결 유지 → Config file을 **`/infra/happy-call-cron/railway.json`** 으로 변경 → 재배포 (curl startCommand·스케줄이 코드로 고정) |

방법 B는 저장소 `infra/happy-call-cron/` (Dockerfile + `railway.json`)을 사용합니다. UI Start Command는 여전히 잠길 수 있으나, **배포에 curl 명령이 적용**됩니다.

### Cron 서비스 설정 체크리스트

1. Railway 프로젝트 → **+ New** → **Cron Job** (서비스명 예: `Happy Call Cron Jobs`)
2. **Source**: GitHub 레포 + Config file **`/infra/happy-call-cron/railway.json`**  
   (또는 Source `curlimages/curl` + Config file **비움** + 아래 Start Command 수동)
3. **Schedule**: `*/15 * * * *` (15분마다) — `infra/happy-call-cron/railway.json`의 `cronSchedule`과 동일
4. **Start Command** (Config file 없을 때만 UI 입력):

   ```bash
   /bin/sh -c 'curl -sf -X POST "${CRON_BASE_URL}/api/admin/cron/happy-call-reminders" -H "Authorization: Bearer ${HAPPY_CALL_CRON_SECRET}" && curl -sf -X POST "${CRON_BASE_URL}/api/admin/cron/alimtalk-schedule-d2" -H "Authorization: Bearer ${ALIMTALK_CRON_SECRET:-$HAPPY_CALL_CRON_SECRET}"'
   ```

5. **Variables** (Cron 서비스에만):

   | 변수 | 예 (스테이징) |
   |---|---|
   | `CRON_BASE_URL` | `https://clean-solution-staging.up.railway.app` (끝 `/` 없음) |
   | `HAPPY_CALL_CRON_SECRET` | 메인 API 스테이징과 **동일** secret |

6. 메인 API 서비스 Variables에도 **`HAPPY_CALL_CRON_SECRET`** 이 있어야 `POST` 인증이 통과합니다.

**금지:** Cron 서비스에 루트 `/railway.json`만 두고 `npm run start`로 기동하려는 구성 (preDeploy·헬스체크 때문에 Cron이 준비되지 않음).

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
3. 관리자 **알림 정책**에서 해피콜 **사용 on/off** 확인 후 재실행 (간격은 **18:00부터 1시간** 고정)

## 알림 규칙 (2025-08)

| 항목 | 값 |
|---|---|
| **시작** | 예약일(청소일) **전날 18:00 KST** |
| **간격** | **1시간** (`hourIndex` dedupe — cron은 15분마다 돌아도 시간당 1회) |
| **종료** | `happyCallCompletedAt` 입력 · 상태 제외 · **예약일이 어제 이전** (cron 범위 밖) |
| **지난 내역** | UI 연체 표시 가능, **푸시는 오늘·내일 예약만** |
| **딥링크** | `/team/assignments?openInquiry=<id>` |

## 관련 코드

| 파일 | 역할 |
|---|---|
| `server/src/modules/notifications/happyCallReminder.service.ts` | job 본문 |
| `server/src/modules/notifications/happyCallReminder.cron.routes.ts` | HTTP cron |
| `server/scripts/run-happy-call-reminders.ts` | CLI |
| `shared/notificationPolicy.ts` | 테넌트·사용자 정책 |
