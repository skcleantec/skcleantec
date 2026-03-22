# 입주청소업체 고객관리 프로그램 - 프로젝트 가이드

> **코딩 규칙**: `CODING_RULES.md` 참고. `.cursor/rules/` 에 프로젝트 룰 적용됨.

## 🚀 실행 방법 (필수)

**클라이언트와 서버를 동시에 실행해야 합니다.** DB 데이터가 안 보이면 서버가 꺼져 있을 가능성이 높습니다.

```bash
# 루트에서 한 번에 실행 (권장)
npm install
npm run dev

# 또는 각각 별도 터미널에서
# 터미널 1: cd server && npm run dev
# 터미널 2: cd client && npm run dev
```

- **관리자**: http://localhost:5173/admin/login (아이디: admin, 비밀번호: 1234)
- **팀장**: http://localhost:5173/team/login (예: team1@skcleanteck.com / 1234)

> 📖 **페이지별 접속 방법**: `ACCESS_GUIDE.md` 참고

---

## 🔧 Git 설정 정보

| 항목 | 값 |
|------|-----|
| **Git 이메일** | skcleantec@gmail.com |

> 💡 Git 설정 방법은 아래 [Git 설정 가이드](#git-설정-가이드) 참고

---

## 📋 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 및 아키텍처](#2-기술-스택-및-아키텍처)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [페이지 구성](#4-페이지-구성)
5. [모듈 구조](#5-모듈-구조)
6. [추가 권장 기능](#6-추가-권장-기능)
7. [구현 로드맵](#7-구현-로드맵)
8. [DB 접수 및 팀장 전달 가이드](#8-db-접수-및-팀장-전달-가이드)

---

## 1. 프로젝트 개요

### 핵심 요구사항
- **모듈화**: 각 기능이 독립적이며, 수정 시 다른 모듈에 영향 없음
- **이식성**: 로컬 → 외부 서버 이전 용이, DB/테이블 마이그레이션 쉬움
- **역할 분리**: 고객 접수 → 관리자 분배 → 팀장 처리 → 정산

### 사용자 역할
| 역할 | 설명 |
|------|------|
| **고객** | 메인 페이지에서 청소 문의 등록 |
| **관리자** | 문의 분배, 정산, 카테고리 관리, 전체 현황 |
| **팀장** | 본인 담당 건만 조회, 진행상황 업데이트, 캘린더 확인 |

---

## 2. 기술 스택 및 아키텍처

### 권장 기술 스택

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 (프론트엔드)                      │
│  React + TypeScript + Vite + TailwindCSS + React Query           │
│  (또는 Next.js - SSR/SEO 필요시)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 서버 (백엔드)                           │
│  Node.js + Express (또는 Fastify) + TypeScript                   │
│  또는 NestJS (모듈화에 최적화된 프레임워크)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │  Redis (선택)    │ │  Kakao API      │
│   또는 MySQL    │ │  세션/캐시       │ │  알림톡         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 기술 선택 이유

| 구분 | 선택 | 이유 |
|------|------|------|
| **프론트엔드** | React + Vite | 빠른 개발, 모듈화 용이, 모바일 대응 |
| **백엔드** | NestJS 또는 Express | NestJS는 모듈/의존성 주입으로 확장성 우수 |
| **DB** | PostgreSQL | JSON 지원, 마이그레이션 도구 풍부 |
| **ORM** | Prisma 또는 TypeORM | 스키마 → 코드 동기화, 마이그레이션 자동화 |

### DB 이식성 설계 (핵심)

```
server/
├── prisma/
│   ├── schema.prisma         # 단일 스키마 파일
│   └── dev.db                # 로컬 SQLite (Docker 불필요)
├── .env                      # DATABASE_URL 등
└── docker-compose.yml        # (루트) PostgreSQL용
```

- **로컬**: SQLite (`file:./prisma/dev.db`) - Docker 불필요
- **외부**: `DATABASE_URL`을 PostgreSQL로 변경 후 `prisma migrate` 사용
- **마이그레이션 파일**: `prisma migrate` 또는 SQL 스크립트로 테이블 이전
- **시드 데이터**: 카테고리 등 초기 데이터는 별도 시드 스크립트

---

## 3. 데이터베이스 설계

### ERD 개요

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │────<│  assignments │>────│   inquiries  │
│ (관리자/팀장) │     │  (분배)      │     │  (고객문의)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                      │                    │
       │                      │                    │
       ▼                      ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   messages   │     │  progress    │     │  settlements │
│  (메시지)    │     │ (진행상황)   │     │   (정산)     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                      │                    │
       │                      ▼                    ▼
       │              ┌──────────────┐     ┌──────────────┐
       │              │  calendar    │     │ extra_income │
       │              │  (캘린더)    │     │ (추가수입)   │
       │              └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  categories  │     │ price_tiers  │
│ (추가작업종류)│     │ (평수별 단가)│
└──────────────┘     └──────────────┘
```

### 주요 테이블 설계

#### 1) `inquiries` (고객 문의)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| customer_name | VARCHAR | 고객명 |
| customer_phone | VARCHAR | 연락처 |
| address | VARCHAR | 주소 (우체국 API 연동) |
| address_detail | VARCHAR | 상세주소 (동·호수 등) |
| area_pyeong | DECIMAL | 평수 |
| room_count | INT | 방 개수 |
| bathroom_count | INT | 화장실 개수 |
| balcony_count | INT | 베란다 개수 |
| preferred_date | DATE | 희망일 |
| preferred_time | VARCHAR | 희망 시간대 |
| call_attempt | INT | 통화시도 (몇 번째 통화로 연결) |
| memo | TEXT | 특이사항, 메모 |
| status | ENUM | 접수/분배완료/진행중/완료/취소 |
| created_at | TIMESTAMP | 등록일시 |
| source | VARCHAR | 유입경로 (웹/전화 등) |

#### 2) `users` (관리자/팀장)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | VARCHAR | 로그인 이메일 |
| password_hash | VARCHAR | 비밀번호 해시 |
| name | VARCHAR | 이름 |
| role | ENUM | admin / team_leader |
| phone | VARCHAR | 카카오 알림 수신용 |
| is_active | BOOLEAN | 활성 여부 |
| created_at | TIMESTAMP | |

#### 3) `assignments` (분배)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| inquiry_id | FK | 문의 ID |
| team_leader_id | FK | 팀장 ID |
| assigned_at | TIMESTAMP | 분배 시각 |
| assigned_by | FK | 분배한 관리자 |

#### 4) `progress` (진행상황)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| inquiry_id | FK | 문의 ID |
| status | ENUM | 진행중/완료 등 |
| memo | TEXT | 팀장 메모 |
| updated_by | FK | 수정자 |
| updated_at | TIMESTAMP | |

#### 5) `messages` (메시지)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| sender_id | FK | 발신자 |
| receiver_id | FK | 수신자 |
| content | TEXT | 내용 |
| read_at | TIMESTAMP | 읽음 시각 |
| created_at | TIMESTAMP | |

#### 6) `categories` (추가작업 카테고리)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | VARCHAR | 카테고리명 |
| is_active | BOOLEAN | 사용 여부 |
| sort_order | INT | 정렬 순서 |

#### 7) `price_tiers` (평수별 단가)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| min_pyeong | DECIMAL | 최소 평수 |
| max_pyeong | DECIMAL | 최대 평수 |
| price | DECIMAL | 단가 |
| valid_from | DATE | 적용 시작일 |
| valid_to | DATE | 적용 종료일 |

#### 8) `extra_income` (추가수입)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| inquiry_id | FK | 문의 ID |
| category_id | FK | 카테고리 ID |
| amount | DECIMAL | 금액 |
| memo | TEXT | 비고 |
| created_at | TIMESTAMP | |

#### 9) `settlements` (정산)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| team_leader_id | FK | 팀장 ID |
| period_type | ENUM | monthly / yearly |
| period_start | DATE | 기간 시작 |
| period_end | DATE | 기간 종료 |
| base_amount | DECIMAL | 기본 청소비 |
| extra_amount | DECIMAL | 추가수입 합계 |
| total_amount | DECIMAL | 총액 |
| status | ENUM | 대기/확정/지급완료 |
| created_at | TIMESTAMP | |

---

## 4. 페이지 구성

### 4.1 공개 페이지 (인증 불필요)

| 경로 | 페이지명 | 설명 |
|------|----------|------|
| `/` | 메인/접수 페이지 | 고객 문의 폼 (이름, 연락처, 주소, 평수, 희망일, 메모) |
| `/confirm` | 접수 완료 | 제출 후 안내 메시지 |

### 4.2 관리자 페이지 (`/admin/*`)

| 경로 | 페이지명 | 설명 |
|------|----------|------|
| `/admin/login` | 로그인 | **관리자 전용** 로그인 |
| `/admin/dashboard` | **메인 대시보드** | DB 접수 화면. 오늘 접수, 미분배, 진행 현황 요약 |
| `/admin/inquiries` | 문의 목록 | 전체 문의, 필터, 검색, 분배 버튼 |
| `/admin/assign` | 분배 | 문의 선택 → 팀장 선택 → 분배 |
| `/admin/calendar` | 캘린더 | 전체 일정, 드래그로 분배 가능 |
| `/admin/messages` | 메시지 | 팀장들과 1:1 대화 |
| `/admin/settlements` | 정산 | 월별/연별 정산, 팀장별 조회 |
| `/admin/settings` | 설정 | 평수별 단가, 추가작업 카테고리, 팀장 계정 |

### 4.3 팀장 페이지 (`/team/*`)

> **로그인 분리**: 팀장은 **별도 로그인 주소** 사용. 관리자와 로그인 URL이 다름.

| 경로 | 페이지명 | 설명 |
|------|----------|------|
| `/team/login` | 로그인 | **팀장 전용** 로그인 (관리자와 별도 주소) |
| `/team/dashboard` | 대시보드 | 내 담당 건 요약 |
| `/team/inquiries` | 내 문의 목록 | 본인에게 분배된 건만 |
| `/team/calendar` | 캘린더 | 내 일정만, 모바일 최적화 |
| `/team/messages` | 메시지 | 관리자와 대화 |
| `/team/progress` | 진행상황 | 건별 상태/메모 업데이트 |

### 4.4 모바일 대응
- 반응형 CSS (Tailwind)
- PWA(Progressive Web App) 고려 → 홈 화면 추가, 오프라인 캐시
- 터치 친화적 버튼/캘린더 UI

---

## 5. 모듈 구조

### 백엔드 모듈 (NestJS 예시)

```
src/
├── modules/
│   ├── auth/           # 로그인, JWT, 권한
│   ├── inquiries/      # 고객 문의 CRUD
│   ├── assignments/    # 분배 로직
│   ├── users/          # 관리자/팀장 계정
│   ├── messages/       # 메시지
│   ├── calendar/       # 캘린더 조회 (inquiries 기반)
│   ├── settlements/    # 정산
│   ├── categories/     # 추가작업 카테고리
│   ├── price-tiers/    # 평수별 단가
│   └── notifications/  # 카카오 알림톡
├── common/             # 공통 유틸, 가드, 인터셉터
├── config/             # DB, 환경변수
└── prisma/             # Prisma 스키마/서비스
```

### 모듈 간 의존성 (최소화)

```
inquiries ──┬──> assignments ──> notifications (카카오)
            ├──> calendar (조회만)
            ├──> settlements
            └──> extra_income
```

- 각 모듈은 **자신의 도메인**만 담당
- 이벤트 기반: 문의 등록 → `InquiryCreatedEvent` → 알림 모듈이 구독

### 프론트엔드 모듈

```
src/
├── pages/           # 라우트별 페이지
├── components/      # 공통 컴포넌트
│   ├── common/
│   ├── calendar/
│   ├── forms/
│   └── layout/
├── hooks/           # 커스텀 훅
├── api/             # API 클라이언트 (모듈별)
├── stores/          # 상태 (Zustand 등)
└── utils/
```

---

## 6. 추가 권장 기능

고객관리에서 자주 필요한 기능 중 보완 권장 사항입니다.

### 6.1 고객/문의 관련
| 기능 | 설명 |
|------|------|
| **고객 중복 체크** | 연락처/주소로 기존 고객 매칭, 리피트 고객 표시 |
| **문의 유입경로** | 네이버/인스타/전화 등 추적용 |
| **첨부파일** | 평면도, 사진 업로드 (S3 등) |
| **견적서 출력** | PDF 생성, 고객 전달용 |

### 6.2 운영 관련
| 기능 | 설명 |
|------|------|
| **작업팀 관리** | 팀장별 팀원(실제 작업자) 등록, 인력 현황 |
| **재방문/AS** | 완료 후 재방문 요청, AS 이력 |
| **취소/변경 이력** | 일정 변경, 취소 사유 로그 |
| **알림 설정** | 팀장별 알림 on/off, 알림 채널(카카오/문자 등) |

### 6.3 정산/재무
| 기능 | 설명 |
|------|------|
| **세금계산서/영수증** | 발행 이력, 자동 연동 |
| **지급 이력** | 정산금 지급일, 방법 기록 |
| **손익 대시보드** | 월별 매출/비용 요약 |

### 6.4 시스템
| 기능 | 설명 |
|------|------|
| **감사 로그** | 누가, 언제, 무엇을 변경했는지 기록 |
| **백업/복원** | DB 정기 백업, 복원 절차 |
| **다국어** | 필요시 언어 전환 |

---

## 7. 구현 로드맵

### Phase 1: 기반 구축 (1~2주)
1. 프로젝트 초기화 (프론트/백/DB)
2. DB 스키마 정의, 마이그레이션 설정
3. 사용자 인증 (로그인, JWT, role)
4. 메인 페이지 (고객 문의 폼) + inquiries 저장

### Phase 2: 핵심 업무 (2~3주)
1. 관리자 문의 목록, 검색/필터
2. 분배 기능 (팀장 선택 → assignment)
3. 팀장 페이지 (본인 건만 조회)
4. 진행상황 업데이트

### Phase 3: 소통 & 알림 (1~2주)
1. 메시지 기능 (관리자 ↔ 팀장)
2. 카카오 알림톡 연동 (문의 접수/분배 시)

### Phase 4: 캘린더 & 정산 (2~3주)
1. 캘린더 뷰 (전체/팀장별), 모바일 최적화
2. 실시간 반영 (WebSocket 또는 폴링)
3. 평수별 단가, 추가작업 카테고리
4. 월별/연별 정산 화면

### Phase 5: 확장 & 안정화 (지속)
1. 추가 권장 기능 우선순위 적용
2. 로컬 → 외부 서버 이전
3. 모니터링, 백업 자동화

---

## 8. DB 접수 및 팀장 전달 가이드

> **메인 대시보드**: 관리자 로그인 후 첫 화면. DB 접수와 현황 요약이 이곳에서 이루어진다.

### 8.1 DB 접수 화면 (고객 전화 시 입력 항목)

스프레드시트 헤더 기반으로 전화 접수 시 아래 항목을 입력한다.

| 항목 | 설명 | 입력 방식 |
|------|------|------------|
| **이름** | 고객명 | 텍스트 입력 |
| **연락처** | 전화번호 | 숫자 입력 (자동 하이픈) |
| **주소** | 상세 주소 | **우체국 주소 검색** 사용 |
| **평수** | 전용면적 | 숫자 입력 (㎡ 또는 평 선택) |
| **방** | 방 개수 | 숫자 선택 (1~10 등) |
| **화** | 화장실 개수 | 숫자 선택 (1~5 등) |
| **베** | 베란다 개수 | 숫자 선택 (0~5 등) |
| **희망일** | 청소 희망일 | 날짜 선택 |
| **희망 시간대** | 오전/오후/시간 | 드롭다운 또는 시간 선택 |
| **통화시도** | 몇 번째 통화로 연결됐는지 | 숫자 (1, 2, 3…) |
| **특이사항** | 건물 구조, 특이사항 등 | 자유 입력 |
| **유입경로** | 전화/웹/네이버 등 | 선택 |

### 8.2 방·화·베 의미

| 약어 | 의미 | 설명 |
|------|------|------|
| **방** | 방 개수 | 거실 제외 침실/방 개수 |
| **화** | 화장실 개수 | 화장실 개수 |
| **베** | 베란다 개수 | 베란다 개수 |

- 입력 방식: 숫자 직접 입력 또는 +/- 버튼
- 기본값 예: 방 2, 화 1, 베 1

### 8.3 우체국 주소 검색 연동

**동작 방식**
1. 검색창에 동·읍·면·도로명 등 일부만 입력
2. **우체국 API** 또는 **도로명주소 API**(행정안전부)로 주소 목록 조회
3. 목록에서 선택 시 시/군/구, 도로명, 건물명 자동 입력
4. **상세주소**(동·호수 등)는 별도 입력

**참고 API**
- [우체국 우편번호 API](https://www.epost.go.kr/search/zipcode/zipcode.jsp)
- [도로명주소 API](https://www.juso.go.kr/)

### 8.4 DB 접수 → 팀장 전달 흐름

```
[고객 전화]
     ↓
[DB 접수 화면]
  - 우체국 주소 검색으로 주소 입력
  - 이름, 연락처, 평수, 방·화·베, 희망일, 특이사항 등 입력
     ↓
[저장 → 접수 완료]
     ↓
[관리자: 미분배 목록에서 팀장 선택 후 분배]
     ↓
[카카오 알림 → 팀장]
     ↓
[팀장 페이지: 내 담당 건에서 상세 내용 확인]
  - 주소, 평수, 방·화·베, 희망일, 특이사항 등 한눈에 확인
```

### 8.5 팀장에게 쉽게 전달되기 위한 요건

| 요건 | 설명 |
|------|------|
| **한 화면에 핵심 정보** | 주소, 평수, 방·화·베, 희망일, 특이사항을 한 블록에 배치 |
| **카드/리스트 형태** | 건별 카드로 표시, 상태(접수/예약/완료) 색/태그로 구분 |
| **알림** | 새 건 분배 시 카카오 알림, 읽지 않은 건 표시 |
| **모바일 대응** | 팀장이 현장에서 확인 가능하도록 모바일 최적화 |

---

## 9. 환경 변수 예시 (.env.example)

```env
# Database (로컬 ↔ 외부 전환 시 URL만 변경)
DATABASE_URL="postgresql://user:pass@localhost:5432/skcleanteck"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Kakao (알림톡)
KAKAO_REST_API_KEY=""
KAKAO_SENDER_KEY=""
KAKAO_TEMPLATE_CODE=""

# Server
PORT=3000
NODE_ENV=development
```

---

## Git 설정 가이드

### 1. Git 설정이 필요한 경우

다음 상황에서는 Git을 설정해야 합니다:

- 최초로 Git을 사용하는 PC
- 커밋 기록에 다른 이메일/이름이 보이길 원할 때
- 의뢰인 저장소로 push할 때 정확한 작성자로 기록되게 하려는 경우

### 2. 전역(모든 프로젝트) 설정

```bash
git config --global user.email "skcleantec@gmail.com"
git config --global user.name "skcleantec"
```

> `user.name`은 GitHub/GitLab에 보이는 이름입니다. 실제 이름이나 원하는 표시명으로 바꿔도 됩니다.

### 3. 이 프로젝트만 별도 설정

다른 프로젝트와 다른 계정을 쓰고 싶다면:

```bash
cd c:\skcleanteck
git config user.email "skcleantec@gmail.com"
git config user.name "skcleantec"
```

`--global` 없이 하면 **현재 프로젝트에만** 적용됩니다.

### 4. 설정 확인

```bash
git config --global --list
# 또는 이 프로젝트만
git config --list
```

### 5. 의뢰인 저장소에 연결 후 push하는 전체 흐름

1. 의뢰인이 GitHub/GitLab에서 새 저장소 생성
2. 의뢰인이 당신을 Collaborator로 초대 (또는 권한 부여)
3. 프로젝트 폴더에서:

```bash
cd c:\skcleanteck
git init
git add .
git commit -m "초기 프로젝트"
git remote add origin https://github.com/의뢰인ID/저장소명.git
git branch -M main
git push -u origin main
```

이미 `git init`이 되어 있다면 `git init`은 제외하고 진행합니다.

---

## Vercel 배포 가이드

서버는 **Vercel**에서 배포합니다. 클라이언트(React)와 API(Express)가 함께 배포됩니다.

### 구성 요약

| 항목 | 설명 |
|------|------|
| **vercel.json** | 빌드/설치 명령, output 경로 |
| **api/[[...path]].ts** | Express를 Vercel 서버리스로 래핑 |
| **server/src/app.ts** | Express 앱 (listen 제외, export용) |

### 배포 전 필수 조건

1. **DB 변경**: 현재 SQLite는 Vercel 서버리스에서 **사용 불가** (파일시스템 읽기 전용).  
   → **PostgreSQL** (Neon, Supabase, Railway 등)로 전환 후 `DATABASE_URL` 설정 필요.

2. **환경변수**: Vercel 대시보드에서 설정  
   - `DATABASE_URL`  
   - `JWT_SECRET`  
   - `JWT_EXPIRES_IN` (선택)

3. **빌드 통과**: 서버에 TypeScript 에러가 있으면 배포 실패. `npm run build`로 사전 확인.

### 배포 절차

1. [vercel.com](https://vercel.com) 로그인 → New Project
2. Git 저장소 연결 (또는 `vercel` CLI로 `vercel` 실행)
3. 환경변수 입력 후 배포

### 로컬에서 Vercel 환경 테스트

```bash
npm i -g vercel
vercel dev
```

---

## 10. 요약 체크리스트

- [ ] 모듈화된 프론트/백 구조
- [ ] DB 스키마 + 마이그레이션으로 이식성 확보
- [ ] 메인 접수 페이지
- [ ] DB 접수 화면: 방·화·베, 통화시도, 우체국 주소 검색 연동
- [ ] 관리자: 문의 목록, 분배, 캘린더, 정산, 설정
- [ ] 팀장: 내 문의, 캘린더, 진행상황, 메시지
- [ ] 관리자 ↔ 팀장 메시지
- [ ] 카카오 알림톡 (문의/분배 시)
- [ ] 모바일 친화적 캘린더
- [ ] 평수별 단가, 추가작업 카테고리
- [ ] 월별/연별 정산

이 가이드를 기준으로 Phase 1부터 순차적으로 구현하면 됩니다. 특정 단계별 상세 설계나 코드 예시가 필요하면 요청해 주세요.
