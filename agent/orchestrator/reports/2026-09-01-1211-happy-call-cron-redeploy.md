# happy-call-cron 재배포 체크리스트

**Maestro · PlatformOps · RoleQA**  
**일시:** 2026-09-01 12:11 KST

---

## 0. 이 cron이 하는 일

| 순서 | API | 대상 | 채널 |
|------|-----|------|------|
| 1 | `POST /api/admin/cron/happy-call-reminders` | 배정된 **팀장** | **FCM 앱 푸시** (알림톡 아님) |
| 2 | `POST /api/admin/cron/alimtalk-schedule-d2` | **고객** | 솔라피 **`CBISEO_CUST_SCHEDULE_D2` 알림톡** |

- **주기:** 15분 (`*/15 * * * *`)
- **구현:** Railway Cron Job → `curlimages/curl` → 두 URL POST
- **설정 파일:** `infra/happy-call-cron/railway.json` + `Dockerfile`

---

## 1. 사전 조건 (메인 API)

Cron은 **메인 API를 호출**만 합니다. Cron만 고치면 부족합니다.

- [ ] **스테이징** 메인 서비스(`clean solution` 등)가 최신 `staging` 배포 완료
- [ ] 아래 라우트가 **메인 API**에 존재:
  - `server/src/modules/notifications/happyCallReminder.cron.routes.ts`
  - `server/src/modules/alimtalk/alimtalkScheduleD2.cron.routes.ts`
- [ ] 스테이징 검증 커밋 포함: `b856448b` (D2 연동), `5a66b297` (오늘·내일만 푸시)
- [ ] **운영** 반영 시: staging 검증 후 `main` 배포

---

## 2. Railway Cron Job 서비스

### 2.1 서비스 존재·연결

- [ ] Railway 프로젝트에 **별도 Cron Job** 서비스 있음 (예: `Happy Call Cron Jobs`)
- [ ] **GitHub 레포** 연결
- [ ] **Config-as-code file** = **`/infra/happy-call-cron/railway.json`**
  - ❌ 루트 `/railway.json`만 쓰면 `npm run start`·preDeploy로 Cron **실패/SKIPPED**
- [ ] **Schedule:** `*/15 * * * *` (config와 동일)

### 2.2 Start Command (config에 포함 — 확인용)

```bash
/bin/sh -c 'curl -sf -X POST "${CRON_BASE_URL}/api/admin/cron/happy-call-reminders" -H "Authorization: Bearer ${HAPPY_CALL_CRON_SECRET}" && curl -sf -X POST "${CRON_BASE_URL}/api/admin/cron/alimtalk-schedule-d2" -H "Authorization: Bearer ${ALIMTALK_CRON_SECRET:-$HAPPY_CALL_CRON_SECRET}"'
```

- [ ] **두 curl** 모두 있는지 (알림톡 누락 방지)
- [ ] `restartPolicyType: NEVER` (한 번 POST 후 종료 — 정상)

### 2.3 Redeploy

- [ ] Cron 서비스 → **Deploy** / **Redeploy** (config·Dockerfile 변경 반영)
- [ ] 배포 로그에 curl 성공 또는 API 200 응답 확인 (실패 시 exit code ≠ 0)

**환경별:** 스테이징 Cron → 스테이징 URL, 운영 Cron → `https://www.cbiseo.com` (또는 운영 Railway URL)

---

## 3. Variables

### 3.1 Cron Job 서비스

| Variable | 필수 | 설명 |
|----------|------|------|
| `CRON_BASE_URL` | ✅ | 메인 API 베이스 URL, **끝 `/` 없음** |
| `HAPPY_CALL_CRON_SECRET` | ✅ | Bearer secret |
| `ALIMTALK_CRON_SECRET` | 선택 | 없으면 happy-call secret 사용 |

**스테이징 예:** `CRON_BASE_URL` = `https://clean-solution-staging.up.railway.app` (실제 Railway 도메인 확인)

### 3.2 메인 API 서비스 (staging / production)

| Variable | 필수 |
|----------|------|
| `HAPPY_CALL_CRON_SECRET` | ✅ — **Cron Job과 동일 문자열** |
| `ALIMTALK_CRON_SECRET` | 선택 (없으면 happy-call secret 폴백) |
| `BILLING_CRON_SECRET` | 레거시 폴백만 — 새로 쓰지 않음 |

- [ ] Cron ↔ 메인 API secret **일치** 확인
- [ ] secret 변경 시 **양쪽 동시** 갱신

---

## 4. 배포 후 검증 (RoleQA)

### 4.1 HTTP dry-run (스테이징 먼저)

PowerShell / curl — URL·secret은 Railway Variables에서 복사:

```powershell
$base = "https://YOUR-STAGING-URL"
$secret = "YOUR-HAPPY_CALL_CRON_SECRET"

# 해피콜
curl -sf -X POST "$base/api/admin/cron/happy-call-reminders?dryRun=1" `
  -H "Authorization: Bearer $secret"

# 알림톡 D2 (18시 이전 테스트)
curl -sf -X POST "$base/api/admin/cron/alimtalk-schedule-d2?dryRun=1&skipTimeWindow=1" `
  -H "Authorization: Bearer $secret"
```

| 결과 | 의미 |
|------|------|
| **200 + JSON** | ✅ 라우트·secret OK |
| **401** | secret 불일치 또는 Variables 미설정 |
| **404** | 메인 API 미배포 또는 경로 오류 |
| curl **22** (sf fail) | 4xx/5xx — API 로그 확인 |

### 4.2 해피콜 실동 (선택)

- [ ] 내일 예약 + **팀장 배정** + **Play 앱 FCM** 있는 계정
- [ ] 전날 **18:00 KST** 이후 cron 주기에 푸시 (웹만으로는 FCM 안 옴)
- [ ] `dryRun=0` 1회 후 `NotificationDeliveryLog` / API 로그

### 4.3 알림톡 D2 실동 (선택)

- [ ] 테넌트 알림톡 라이선스 + `CBISEO_CUST_SCHEDULE_D2` ON
- [ ] `sendYmd` = 오늘 KST 후보 존재
- [ ] **18:00 KST 이후** (또는 운영 정책에 맞는 시간)
- [ ] `AlimtalkSendLog` 1건 확인

### 4.4 Railway Cron 실행 이력

- [ ] Cron Job **Deployments / Runs** — 15분마다 성공
- [ ] 실패 run → 로그에서 curl 오류·401 확인

---

## 5. GitHub Actions (보조 — 선택)

`.github/workflows/happy-call-reminders.yml` — Railway Cron **대체·백업**용.

Secrets:

| Secret | 용도 |
|--------|------|
| `CBISEO_CRON_BASE_URL` | POST 대상 |
| `HAPPY_CALL_CRON_SECRET` | Bearer |
| `ALIMTALK_CRON_SECRET` | 선택 |

- [ ] Railway Cron이 주력이면 Actions는 **중복 실행** 주의 (15분마다 둘 다 켜면 이중 POST)
- [ ] Actions만 쓸 경우에도 **두 POST step** 모두 있는지 확인 (워크플로 최신)

---

## 6. 운영(production) 전환

- [ ] 스테이징 dry-run **전부 통과**
- [ ] **운영** 메인 API 배포 (`main`)
- [ ] **운영** Cron Job Variables → `CRON_BASE_URL` = 운영 URL
- [ ] 운영 dry-run → 필요 시 소량 실발송 확인
- [ ] 팀에 공지: **과거 연체 해피콜은 푸시 없음** (오늘·내일 예약만)

---

## 7. 트러블�hooting

| 증상 | 조치 |
|------|------|
| Custom Start Command UI 잠김 | Config file을 `/infra/happy-call-cron/railway.json`으로 설정 후 redeploy |
| 첫 curl만 성공 | `railway.json` startCommand에 D2 curl 추가 후 redeploy |
| pushesSent 항상 0 | 배정·예약일·상태·FCM 토큰·정책 OFF — `docs/HAPPY_CALL_CRON.md` |
| candidates 0 (D2) | 템플릿 OFF, sendYmd 불일치, 18:00 전 — `docs/ALIMTALK_SCHEDULE_D2_CRON.md` |

---

## 참고 문서·코드

- `docs/HAPPY_CALL_CRON.md`
- `docs/ALIMTALK_SCHEDULE_D2_CRON.md`
- `infra/happy-call-cron/railway.json`
- `server/scripts/diagnose-happy-call-*.ts` (로컬 진단, 선택)
