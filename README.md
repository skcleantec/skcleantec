# SK클린텍 고객관리 프로그램

## 빠른 시작

### 1. 서버 설정

```bash
cd server
npm install
npm run db:push    # DB 스키마 적용 (이미 완료됐으면 생략)
npm run db:seed    # 관리자 계정 생성 (admin@skcleanteck.com / admin123)
npm run dev        # http://localhost:3000
```

### 2. 클라이언트 실행

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

### 3. 로그인

- **관리자**: http://localhost:5173/admin/login
- 아이디: `admin`
- 비밀번호: `1234`

### 4. 팀장 로그인

- 팀장은 **별도 로그인 주소** 사용 (`/team/login` - 추후 구현)

## DB 설정

- **로컬**: SQLite (`server/prisma/dev.db`) - Docker 불필요
- **외부**: `server/.env`에서 `DATABASE_URL`을 PostgreSQL로 변경 후 `prisma migrate` 사용

## 프로젝트 구조

- `client/` - React + Vite + Tailwind
- `server/` - Express + Prisma (모듈별 분리)
- `PROJECT_GUIDE.md` - 상세 가이드
- `CODING_RULES.md` - 코딩 규칙
