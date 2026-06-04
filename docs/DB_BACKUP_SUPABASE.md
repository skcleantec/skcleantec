# 한국 리전 보조 DB (Supabase 서울) — 자동 백업 / 장애 전환

운영 주 DB는 **Railway Postgres** 그대로 쓰고, **한국 리전 Supabase(서울)** 에 보조 DB를 두어
**1시간마다 운영본을 통째로 복제**합니다. Railway가 다운되면 보조 DB로 즉시 전환할 수 있습니다.

```
[운영/주 DB: Railway Postgres]  ← 앱이 평소 사용 (속도 그대로)
        │  매시간 단방향 복제 (pg_dump -> pg_restore)
        ▼
[보조 DB: Supabase 서울]        ← 평소엔 대기, Railway 다운 시 전환
```

자동화: `.github/workflows/db-sync-supabase.yml` (GitHub Actions cron, 매시 정각 UTC).

> **중요한 한계 — 데이터 시차**: 이건 실시간 미러링이 아니라 **1시간 주기 백업**입니다.
> Railway가 죽으면 **마지막 백업 이후 최대 1시간치 데이터**가 보조 DB에 없을 수 있습니다.

---

## 1. Supabase 서울 프로젝트 만들기 (1회)

1. [supabase.com](https://supabase.com) 가입 → **New project**.
2. **Region**: `Northeast Asia (Seoul)` (`ap-northeast-2`) 선택.
3. **Database Password** 설정 → 안전한 곳에 보관(아래 연결 문자열에 들어감).
4. 프로젝트 생성 후 **Project Settings → Database → Connection string** 에서 연결 문자열 확인.
   - **Session pooler (IPv4)** 문자열을 사용한다 (GitHub Actions 러너는 IPv6가 막힐 수 있어 IPv4 풀러가 안전).
   - 형태 예: `postgresql://postgres.<ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`

> 용량: 무료 티어는 약 500MB 제한이 있습니다. 운영 DB가 더 크면 Supabase 유료 플랜으로 올립니다.

---

## 2. 보조 DB 스키마 1회 부트스트랩

첫 복제 전에 보조 DB에 스키마를 한 번 올려 두면 가장 깔끔합니다. (선택이지만 권장)

로컬에서 `server/.env`의 `DATABASE_URL`을 **잠깐** Supabase 연결 문자열로 바꾼 뒤:

```powershell
cd c:\skcleanteck\server
npx prisma migrate deploy
```

끝나면 **`DATABASE_URL`을 다시 Railway 운영 URL로 되돌립니다.** (보조 DB는 매시간 어차피 덮어써지므로,
이 단계는 첫 `pg_restore`가 실패 없이 자리 잡게 하는 워밍업 정도입니다.)

---

## 3. GitHub Secrets 등록 (1회)

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret 이름 | 값 |
|---|---|
| `RAILWAY_DATABASE_URL` | Railway 운영 Postgres **공개 Proxy** URL (`*.proxy.rlwy.net`, `?sslmode=require` 포함) |
| `SUPABASE_DATABASE_URL` | Supabase 서울 **Session pooler(IPv4)** 연결 문자열 (비밀번호 포함) |

> 연결 문자열·비밀번호는 **절대 코드·문서·채팅에 적지 않습니다.** Secret 에만 둡니다.

---

## 4. 동작 확인

1. GitHub 저장소 → **Actions** 탭 → **DB sync (Railway -> Supabase Seoul)**.
2. **Run workflow** 로 수동 1회 실행 → 초록 체크면 성공.
3. 이후 매시 정각(UTC)마다 자동 실행됩니다.

---

## 5. Railway 장애 시 — 보조 DB로 전환

1. Railway 웹 서비스 **Variables** 에서 `DATABASE_URL` 을 **Supabase 서울 연결 문자열**로 교체.
   (또는 임시로 다른 호스팅에 앱을 띄우고 `DATABASE_URL`을 Supabase로 지정.)
2. 앱 재배포/재시작.
3. 로그인·접수·실시간(WebSocket) 스모크 테스트.

> 전환 중에는 보조 DB로 **쓰기**가 일어납니다. Railway가 복구되면, 그동안 보조 DB에 쌓인 데이터를
> 다시 Railway로 되돌리는 작업(역방향 1회 `pg_dump`/`pg_restore`)이 필요할 수 있습니다.
> `scripts/copy-prod-db-to-staging.ps1` 의 source/target 을 바꿔 수동 실행하면 됩니다.

---

## 6. 주기·비용 메모

- 백업 주기는 `.github/workflows/db-sync-supabase.yml` 의 `cron` 으로 조절합니다.
  - `'0 * * * *'` = 1시간(현재). `'*/15 * * * *'` = 15분, `'0 0 * * *'` = 하루 1회.
- GitHub Actions·Supabase 무료 한도 내에서 운영 가능하나, DB 용량/실행 빈도가 커지면 유료 플랜을 검토합니다.

---

## 7. 참고

- 워크플로: `.github/workflows/db-sync-supabase.yml`
- 수동 복제 스크립트(로컬/역방향): `scripts/copy-prod-db-to-staging.ps1`
- 운영↔스테이징 복제·웹 가져오기: `STAGING_SETUP.md`
