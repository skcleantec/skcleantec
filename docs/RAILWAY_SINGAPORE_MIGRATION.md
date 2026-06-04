# Railway US → 싱가포르 리전 이전 가이드 (앱 + Postgres)

한국 사용자 체감 속도를 위해 **앱 서비스 + Postgres 를 둘 다 Railway 싱가포르(Southeast Asia)** 로 옮기는 절차.
현재 리전은 **US 계열**이며, 싱가포르가 Railway 리전 중 한국에 가장 가깝다(한국 왕복 약 70~90ms, US는 130~180ms).

> Railway 에는 한국·일본 리전이 없다. 그보다 더 빠르게 하려면 Railway 를 떠나야 한다(Fly.io 도쿄 ~30ms, NCP/AWS 서울 ~5~20ms). 자세한 배경은 `.cursor/rules/infra-hosting-db-plan.mdc`.

- **예상 다운타임**: 약 10~30분(데이터 양에 따라). **이용자가 적은 심야**에 진행.
- **위험도**: 낮음. 옛 US DB 를 지우지 않고 남겨 두므로 롤백 가능.

```
[지금]  앱(US) + Postgres(US)
   ① 싱가포르에 새 Postgres 생성
   ② 데이터 복사 (US → 싱가포르)
   ③ 앱을 싱가포르 리전으로 이동
   ④ 앱이 새 싱가포르 DB를 보도록 DATABASE_URL 변경
[완료]  앱(싱가포르) + Postgres(싱가포르)  + 옛 US DB 2주 보관(롤백용)
```

---

## 단계 0 — 준비

1. 작업 시간을 **이용자가 가장 적은 심야**로 정한다.
2. 안전망: 자동 백업(Supabase 서울, `docs/DB_BACKUP_SUPABASE.md`)이 한 번 성공했는지 확인하거나 수동 백업 1회.
3. 로컬 PC 에 **Docker Desktop** 실행 가능 상태 확인(데이터 복사 스크립트가 사용). 없으면 PostgreSQL 클라이언트(`pg_dump`/`pg_restore`)라도 PATH 에.

### 단계 0.5 — 볼륨(C/S 사진) 먼저 비우기 (⚠️ 리전 이동 전 필수)

Railway **볼륨은 리전 이동이 안 된다.** 앱 볼륨에는 **C/S 제출 사진**(`/uploads/cs/`)만 쌓인다. 이전 전에 Cloudinary 로 옮겨 볼륨 의존을 없앤다.

1. Railway 앱 서비스 **Variables** 에 **`CLOUDINARY_URL`**(또는 분리 변수)이 설정돼 있는지 확인. 없으면 설정(`.cursor/rules/cloudinary.mdc`).
2. C/S 업로드가 Cloudinary 로 가도록 바뀐 코드가 **배포**돼 있어야 한다(이후 신규 사진은 볼륨에 안 쌓임).
3. 기존 볼륨 사진을 Cloudinary 로 이전 + DB 주소 갱신 — **볼륨이 마운트된 현재(US) 환경에서** 일회성 실행:
   ```bash
   npm --prefix server run db:migrate-cs-images           # 먼저 --dry-run 으로 대상 확인 권장
   ```
4. C/S 사진이 Cloudinary 주소로 잘 뜨는지 확인되면, 앱 서비스에서 **볼륨 분리/삭제**. → 이제 리전 이동이 깔끔하다.

## 단계 1 — 싱가포르에 새 Postgres 생성

1. Railway → 운영 프로젝트 → **+ New → Database → Add PostgreSQL**.
2. 새 Postgres → **Settings → Name** 을 `Postgres-SG` 등으로 변경(구분).
3. 같은 **Settings → Region → Southeast Asia (Singapore)** 선택 → 재프로비저닝(1~2분).
4. **옛 US Postgres 는 건드리지 않는다.**

## 단계 2 — 두 DB 공개 주소 복사

- **소스(US)**: US Postgres → **Variables → `DATABASE_PUBLIC_URL`** 복사(`*.proxy.rlwy.net`).
- **대상(SG)**: 싱가포르 Postgres → **Variables → `DATABASE_PUBLIC_URL`** 복사.
- 두 주소는 비밀번호 포함 → 메모장에만, 공유 금지.

## 단계 3 — 데이터 복사 (US → 싱가포르) · 다운타임 0

PowerShell:

```powershell
cd c:\skcleanteck
$env:SKCT_SOURCE_DATABASE_URL = '소스(US)_DATABASE_PUBLIC_URL'
$env:SKCT_TARGET_DATABASE_URL = '대상(SG)_DATABASE_PUBLIC_URL'
.\scripts\copy-prod-db-to-staging.ps1
```

확인 문구 → Enter → "완료" 메시지. 이 시점까지 앱은 옛 DB 사용 중이라 서비스 정상.

## 단계 4 — 앱을 싱가포르로 이동 (⚠️ 잠깐 다운)

- **앱 서비스**(코드 실행 서비스) → **Settings → Region → Southeast Asia (Singapore)** → 재배포(잠깐 끊김).

## 단계 5 — 앱이 새 싱가포르 DB 를 보게 변경

- 앱 서비스 → **Variables → `DATABASE_URL`** 을 새 싱가포르 Postgres 로 교체.
  - 쉬움: 단계 2 의 대상(SG) 주소 붙여넣기.
  - 권장: 참조 변수 `${{ Postgres-SG.DATABASE_URL }}` (같은 리전 내부망 = 가장 빠름).
- 저장 → 재배포. preDeploy 의 `prisma migrate deploy`·시드는 이미 복원된 DB 라 **no-op/idempotent** 로 안전 통과.

## 단계 6 — 스모크 테스트

1. 로그인(관리자/팀장)
2. 접수 목록·대시보드 표시
3. 새 접수 등록·수정 저장
4. 팀장 실시간 알림(WebSocket)
5. 체감 속도 개선 확인

## 단계 7 — 롤백 대비 & 정리

- 옛 US Postgres **1~2주 보관**. 문제 시 앱 `DATABASE_URL` 을 옛 US 주소로 되돌려 즉시 복구.
- 안정되면 옛 US Postgres → Settings → **Delete service**.

---

## 롤백 절차

앱 서비스 → Variables → `DATABASE_URL` 을 옛 US 주소로 되돌리고 저장 → 옛 상태 복귀.
단, 전환 후 새로 쌓인 데이터는 옛 DB 에 없으므로 **전환 직후 문제 발견 시에만** 사용.

## 참고

- 데이터 복사 스크립트: `scripts/copy-prod-db-to-staging.ps1`
- 한국 보조 백업(Supabase 서울): `docs/DB_BACKUP_SUPABASE.md`
- 인프라 현황·향후 방향: `.cursor/rules/infra-hosting-db-plan.mdc`
