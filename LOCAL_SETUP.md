# 로컬 개발 환경 설정 (Docker + PostgreSQL)

## Docker 설치 (필수)

1. **다운로드**: https://www.docker.com/products/docker-desktop/
2. 설치 후 **PC 재시작**
3. **Docker Desktop** 실행 후 좌측 하단이 "Running" 상태인지 확인

## 순서대로 실행

```powershell
cd c:\skcleanteck

# 1. PostgreSQL 시작
npm run db:up

# 2. server/.env 파일에서 DATABASE_URL을 아래로 변경
#    DATABASE_URL="postgresql://skcleanteck:skcleanteck@localhost:5432/skcleanteck"

# 3. 테이블 + 초기 데이터 생성
npm run db:setup

# 4. 앱 실행
npm run dev
```

## DB GUI (Prisma Studio)

```powershell
npm run db:studio
```

→ 브라우저에서 테이블 확인/수정 가능
