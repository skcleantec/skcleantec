# 스테이징 서버 설정 가이드 (Railway)

운영(Production)과 **완전히 분리된** URL·DB로 배포 전 검증을 하는 절차입니다.  
한 단계씩 끝내고 다음으로 넘어가세요.

---

## 사전 확인

- Railway 계정·현재 운영 프로젝트 접근 권한
- GitHub 저장소 권한 (브랜치·연동 설정 시)
- **운영 `DATABASE_URL`을 스테이징에 붙여 넣지 않기** (실수 방지가 최우선)

---

## 1단계: Railway에 스테이징 **환경(Environment)** 만들기

1. [Railway Dashboard](https://railway.app)에서 **지금 쓰는 프로젝트**를 연다.
2. 프로젝트 상단 또는 **Settings** 근처에서 **Environments** 메뉴를 찾는다.
3. **New Environment** → 이름을 **`staging`** 으로 만든다. (이름은 나중에 스크립트·문서에서 구분할 때 쓰기 좋음)

> 환경이 없고 “프로젝트 복제”만 가능하면, **Duplicate project** 로 `…-staging` 프로젝트를 만들고 아래 단계를 그 프로젝트 안에서 동일하게 진행해도 된다.

**완료 기준:** `production`(또는 기본)과 `staging` 이 구분되어 보인다.

---

## 2단계: 스테이징 전용 **PostgreSQL** 만들기

1. **환경을 `staging`으로 선택**한 상태에서 유지한다.
2. **New** → **Database** → **PostgreSQL** 추가.
3. Postgres 서비스를 열고 **Variables** 탭에서 `DATABASE_URL`(또는 Connect 복사)을 확인한다.
4. 이 URL은 **3단계에서만** 스테이징 웹 서비스에 넣는다. 운영 서비스에는 건드리지 않는다.

**완료 기준:** 스테이징 환경에만 존재하는 Postgres 인스턴스가 있다.

---

## 3단계: 스테이징용 **웹 서비스** 만들기

운영 서비스를 복제하는 방식이 가장 빠르다.

1. 여전히 **`staging` 환경** 선택.
2. 운영에 쓰는 **Node/웹 서비스**에서 **⋯ 메뉴** → **Duplicate** 또는 **Copy** 가 있으면 사용한다.  
   없으면 **New** → **GitHub Repo** 로 같은 저장소를 연결해 새 서비스를 만든다.
3. 새 서비스의 **Settings → Environment** 가 **`staging`** 에만 묶여 있는지 확인한다.

**완료 기준:** 스테이징 환경에 “배포되는 앱” 서비스가 하나 있다.

---

## 4단계: 스테이징 서비스 **Variables** 설정

스테이징 웹 서비스를 연 뒤 **Variables** 에 아래를 넣는다. (이름은 운영과 같아도 되고, **값은 반드시 다르게**)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | **2단계 스테이징 Postgres** 연결 문자열만 사용 |
| `JWT_SECRET` | 운영과 **다른** 임의 긴 문자열 (JWT가 섞이지 않게) |
| `JWT_EXPIRES_IN` | 예: `7d` (운영과 동일해도 됨) |
| `NODE_ENV` | 보통 `production` (빌드·동작을 운영과 동일하게 맞출 때) |
| `CLOUDINARY_URL` | 가능하면 **스테이징 전용** 업로드 프리픽스/환경, 없으면 운영과 동일 키는 **삭제 테스트 주의** |
| 기타 Kakao 등 | 있으면 스테이징용 키 또는 비활성 |

Railway가 주입하는 `PORT` 등은 그대로 두면 된다.

**완료 기준:** 스테이징 서비스에 `DATABASE_URL` 이 **스테이징 DB**만 가리킨다 (운영 URL 아님).

---

## 5단계: **도메인** 열기

1. 스테이징 웹 서비스 → **Settings** → **Networking** (또는 **Generate Domain**).
2. **Generate Domain** 으로 `*.up.railway.app` 주소를 발급한다.
3. 브라우저에서 `https://(발급된주소)/api/health` 가 JSON으로 응답하는지 확인한다.

**완료 기준:** 스테이징 전용 URL로 헬스 체크가 된다.

---

## 6단계: **Git 브랜치**와 배포 연결 (실수 방지)

처음 추천 흐름:

1. GitHub에 **`staging`** (또는 `develop`) 브랜치를 만든다.
2. Railway 스테이징 **웹 서비스** → **Settings** → **Deploy** 에서 **Branch** 를 `staging` 으로 지정한다.
3. **운영(Production)** 서비스는 계속 **`main`** 만 배포하도록 둔다.

이렇게 하면 `main` 푸시가 곧바로 스테이징에 가지 않는다.

**완료 기준:** `staging` 브랜치 푸시 → 스테이징만 재배포, `main` → 운영만 재배포.

---

## 7단계: 첫 배포와 동작 확인

1. `staging` 브랜치에 현재 코드를 푸시하거나, Railway에서 **Redeploy** 한다.
2. 빌드 로그에 오류가 없는지 본다.
3. 스테이징 URL로 접속해 로그인·접수 목록·발주서 등 **핵심 화면**을 눌러 본다.
4. 운영 URL과 **데이터가 다름**을 확인한다 (같은 계정이 있어도 DB가 다르면 내용이 달라야 정상).

**완료 기준:** 스테이징만으로 업무 플로우가 한 사이클 돌아간다.

---

## 8단계: 운영 반영 습관

- 기능/마이그레이션은 **`staging` → 검증 → `main` 머지(또는 PR)** 순서로 올린다.
- 스테이징에서 `railway.json` 의 `preDeployCommand`(`db push`, 시드 등)가 **매번** 돌면 테스트 데이터가 바뀔 수 있다. 필요하면 나중에 **시드만 끄는** 플래그나 스크립트 분리를 검토한다.

---

## 문제 발생 시

- **`Failed to fetch` / 502:** 스테이징 서비스가 떠 있는지, `PORT`·헬스체크 경로(`/api/health`) 확인.
- **DB enum·마이그레이션 오류:** 스테이징 DB에도 운영과 동일하게 스키마가 맞는지 확인. 앱 기동 시 `ORDER_FORM_PENDING` 보정 로직이 있으면 대부분 자동 복구된다.
- **로그인은 되는데 운영과 같음:** `DATABASE_URL` 이 운영과 **같은지** Variables를 다시 확인한다.

---

## 요약 체크리스트

- [ ] `staging` 환경(또는 스테이징 전용 프로젝트) 생성  
- [ ] 스테이징 전용 Postgres  
- [ ] 스테이징 웹 서비스 + **스테이징 DB URL**  
- [ ] **운영과 다른** `JWT_SECRET`  
- [ ] 스테이징 공개 도메인  
- [ ] 배포 브랜치: 스테이징 ≠ 운영  
- [ ] 스테이징 URL로 스모크 테스트 완료  

이후 단계(시드 분리, `migrate deploy` 전환 등)는 팀 상황에 맞춰 추가하면 된다.

---

## 로컬 `server/.env`를 스테이징 DB로 맞추기

**목적:** PC에서 `npm run dev` 할 때도 **운영이 아닌 스테이징 Postgres**만 건드리게 한다.

1. Railway에서 **환경 `staging`** → **Postgres** 서비스를 연다.
2. **Connect** 또는 **Variables**에서 **`DATABASE_URL`** 중 **외부(로컬)에서 접속 가능한** 문자열을 찾는다.  
   - 보통 `*.proxy.rlwy.net` 같은 **공개 Proxy** 형태다.  
   - 컨테이너 전용 `postgres.railway.internal` 은 **로컬 PC에서는 동작하지 않으므로** `.env`에 넣지 않는다.
3. PC의 **`server/.env`** 에 있는 `DATABASE_URL=` 한 줄을 **위에서 복사한 스테이징 URL**로 바꾼다. (따옴표·`?sslmode=require` 는 Railway가 준 형식에 맞춘다.)
4. **`npm run dev`** 를 **완전히 끄고 다시 실행**한다. (`DATABASE_URL` 변경은 재시작 후에만 반영된다.)
5. 브라우저에서 로컬 앱으로 로그인해, **Railway 스테이징 웹에서 보이는 데이터와 같은지** 대략 맞춰 본다.

**주의:** 스테이징 DB도 **공유 원격 DB**이므로, 마이그레이션·시드·대량 삭제는 **팀과 합의 후** 진행한다. 운영 URL로 다시 바꿀 때도 같은 방식으로 **운영 Postgres의 공개 URL**만 사용한다.

---

## 운영 DB → 스테이징 DB (`pg_dump` / `pg_restore`)

Railway 대시보드만으로는 **다른 환경의 Postgres로 통째 복제**가 어렵다. 로컬(Windows)에서 아래 스크립트를 쓴다.

### 준비

1. 아래 **둘 중 하나**
   - **PostgreSQL 클라이언트** 설치 → `pg_dump`, `pg_restore` 가 PATH 에서 실행되는지 확인, 또는  
   - **Docker Desktop** 실행 가능 → 스크립트가 자동으로 `postgres:18` 이미지(Railway 등 PostgreSQL 18 호환 `pg_dump`)를 받아 같은 작업을 수행한다.
2. Railway **production** Postgres → **공개 Proxy** `DATABASE_URL` (로컬에서 붙는 주소).
3. Railway **staging** Postgres → 동일하게 **공개 Proxy** `DATABASE_URL`.
4. URL·비밀번호는 **채팅·Git에 붙이지 않는다.**

### 실행 (PowerShell, 저장소 루트에서)

```powershell
.\scripts\copy-prod-db-to-staging.ps1 `
  -SourceDatabaseUrl '여기에_운영_공개_DATABASE_URL' `
  -TargetDatabaseUrl '여기에_스테이징_공개_DATABASE_URL'
```

연결 문자열을 명령줄에 남기기 싫으면 세션 환경변수를 쓸 수 있다:

```powershell
$env:SKCT_SOURCE_DATABASE_URL = '<Railway production 공개 Proxy DATABASE_URL>'
$env:SKCT_TARGET_DATABASE_URL = '<Railway staging 공개 Proxy DATABASE_URL>'
.\scripts\copy-prod-db-to-staging.ps1 -SkipConfirm
```

- 확인 메시지 후 Enter 하면 대상 DB에 `--clean --if-exists` 복원이 진행된다.
- 비대화형(스크립트 파이프라인)이면 `-SkipConfirm` 과 `$env:CI` 등에 맞춰 사용할 수 있으나, **첫 실행은 확인 프롬프트 권장**.

### 복원 후

- 스테이징 웹 서비스 **재배포** 또는 앱 재시작 후, 스테이징 URL에서 데이터·로그인을 확인한다.
- `pg_restore` 가 경고만 내고 끝나는 경우가 있어, **접수·사용자 몇 건**이 보이는지 꼭 확인한다.
- 웹 가져오기는 완료 시 **tenants·users·inquiries 건수 검증**을 수행한다. `done` 이라도 건수가 0·불일치면 `failed`로 처리된다.
- **`STAGING_DB_IMPORT_SOURCE_DATABASE_URL` 과 스테이징 `DATABASE_URL` 이 같으면** 복사가 되지 않는다(시작 단계에서 차단).

---

## 웹에서 「운영 DB 가져오기」(스테이징 전용)

배포된 **스테이징** 관리자 화면에서만, 지정한 개발자 계정의 프로필 드롭다운에 **운영 DB 가져오기**가 나타납니다. PowerShell 스크립트와 동일하게 `pg_dump` → `pg_restore(--clean --if-exists)` 를 서버에서 실행합니다.

### Railway 스테이징 웹 서비스 변수

| 변수 | 설명 |
|------|------|
| `STAGING_DB_IMPORT_ENABLED` | `true` 로 두면 기능 활성화(스테이징에서만 설정). **운영에는 넣지 않는다.** |
| `STAGING_DB_IMPORT_SOURCE_DATABASE_URL` | **운영(메인) Postgres**의 공개 Proxy `DATABASE_URL`. 스테이징 앱이 이 주소로 **읽기 전용 덤프**만 한다. |
| `STAGING_DB_IMPORT_OPERATOR_EMAIL_SUBSTRING` | (선택) 기본값 `pyo`. 로그인 이메일(소문자)에 이 문자열이 **포함**된 **ADMIN** 만 메뉴·API 사용 가능. 다른 개발자 계정으로 바꿀 때만 수정. |
| `STAGING_DB_IMPORT_ALLOW_LOCAL` | (선택) 로컬 `npm run dev` 로 이 기능을 시험할 때만 `true`. `NODE_ENV=production` 이면 무시된다. |

복원 대상은 항상 해당 서비스의 **`DATABASE_URL`**(스테이징 Postgres)이다. 운영 DB로 쓰기하지 않는다.

Railway는 컨테이너에 `RAILWAY_ENVIRONMENT=staging` 을 넣는 경우가 많다. 코드상 **`RAILWAY_ENVIRONMENT === 'staging'`** 일 때만 위 변수 조합으로 기능이 켜진다(로컬 시험은 `STAGING_DB_IMPORT_ALLOW_LOCAL=true`).

### 주의

- 작업 중에는 Prisma 연결이 잠시 끊기므로 **스테이징 API가 잠깐 오류**를 낼 수 있다.
- Railway를 **인스턴스 여러 개**로 띄우면 작업 상태 조회가 다른 인스턴스로 가 **404** 가 날 수 있다. 가능하면 스테이징 웹은 단일 인스턴스를 권장한다.
- 이미지(Dockerfile 러너)에 **PGDG `postgresql-client`(최신 pg_dump/pg_restore)** 가 포함되어 있어야 한다. (구버전 클라이언트는 Railway Postgres 메이저와 맞지 않아 `pg_dump` 종료 코드 1이 날 수 있음.)

### `done` 인데 스테이징에 데이터가 없을 때 (자주 나는 Railway 오설정)

1. **`STAGING_DB_IMPORT_SOURCE_DATABASE_URL` 이 스테이징 Postgres를 가리킴**  
   Railway 변수에 `${{Postgres.DATABASE_URL}}` 을 그대로 넣으면 **스테이징 DB를 덤프**합니다. 운영과 스테이징 건수가 같아 보이고, 복원해도 화면이 안 바뀝니다.  
   → **production(메인) Postgres** 의 **공개 Proxy URL** 을 수동으로 붙여 넣으세요.

2. **스테이징 Postgres 플러그인이 두 개**  
   복원은 스테이징 **웹 서비스**의 `DATABASE_URL` 로 들어가지만, Railway Data 탭에서 **다른** Postgres를 열고 있으면 “DB가 비었다”고 느낄 수 있습니다.  
   → 스테이징 웹 Variables의 `DATABASE_URL` host:port 와 Data 탭 Postgres가 **같은지** 확인하세요.

3. **웹 모달 사전 점검**  
   「운영 DB 가져오기」 모달을 열면 운영·스테이징 `host:port/db` 와 접수 건수가 표시됩니다.  
   - 운영 접수 0건 → SOURCE URL 오류 가능성 큼  
   - 운영·스테이징 지표가 완전히 동일 → SOURCE가 스테이징일 가능성 큼  
   - 앱 접수 ≠ 스테이징 DB 직접 조회 → 웹 서비스 `DATABASE_URL` 과 보고 있는 Postgres 불일치

4. **완료 후 앱 DB 재검증**  
   복원·마이그레이션 후 서버가 Prisma로 접수 건수를 다시 확인합니다. psql 검증은 통과했는데 앱 DB만 다르면 `failed` 로 끝나며, 위 2번을 의심하면 됩니다.
