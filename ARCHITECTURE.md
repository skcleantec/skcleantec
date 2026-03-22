# 아키텍처 상세 가이드

## 로그인 URL 분리

| 역할 | 로그인 URL | 설명 |
|------|------------|------|
| **관리자** | `/admin/login` | 관리자 전용. 대시보드, 분배, 정산 등 |
| **팀장** | `/team/login` | 팀장 전용. 별도 주소 사용. 내 담당 건만 |

- 관리자와 팀장은 **서로 다른 로그인 주소** 사용
- 역할별로 분리된 인증 흐름

---

## 폴더 구조 (권장)

```
skcleanteck/
├── client/                    # 프론트엔드
│   ├── src/
│   │   ├── pages/
│   │   │   ├── public/       # 메인 접수, 확인
│   │   │   ├── admin/        # 관리자 페이지
│   │   │   └── team/         # 팀장 페이지
│   │   ├── components/
│   │   ├── api/
│   │   ├── hooks/
│   │   └── stores/
│   ├── package.json
│   └── vite.config.ts
│
├── server/                    # 백엔드
│   ├── src/
│   │   ├── modules/
│   │   ├── common/
│   │   └── config/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml         # 로컬 DB 띄우기
├── .env.example
└── PROJECT_GUIDE.md
```

## API 엔드포인트 설계

### 공개 API
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/inquiries | 고객 문의 등록 |

### 인증 API
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/refresh | 토큰 갱신 |
| GET | /api/auth/me | 현재 사용자 |

### 문의 API (관리자)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/inquiries | 목록 (필터, 검색) |
| GET | /api/inquiries/:id | 상세 |
| PATCH | /api/inquiries/:id | 상태 변경 |
| POST | /api/assignments | 분배 |

### 문의 API (팀장)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/team/inquiries | 내 담당 건만 |
| PATCH | /api/team/inquiries/:id/progress | 진행상황 업데이트 |

### 캘린더 API
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/calendar/events | 기간별 일정 (query: start, end, teamLeaderId?) |

### 메시지 API
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/messages | 대화 목록 |
| GET | /api/messages/:userId | 특정 사용자와 대화 |
| POST | /api/messages | 발송 |
| PATCH | /api/messages/:id/read | 읽음 처리 |

### 정산 API
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/settlements | 목록 (기간, 팀장 필터) |
| POST | /api/settlements/calculate | 정산 계산 |
| GET | /api/settlements/:id | 상세 |

### 설정 API (관리자)
| Method | Path | 설명 |
|--------|------|------|
| CRUD | /api/categories | 추가작업 카테고리 |
| CRUD | /api/price-tiers | 평수별 단가 |
| CRUD | /api/users | 팀장 계정 |

## 모듈 의존성 규칙

```
규칙 1: 하위 모듈은 상위 모듈을 import 하지 않음
규칙 2: 공통 로직은 common/ 으로
규칙 3: DB 접근은 각 모듈의 Service에서만
```

```
common (유틸, 가드)
  ↑
auth (인증)
  ↑
users, inquiries, assignments, messages, calendar, settlements, categories, price-tiers, notifications
```

## 로컬 → 외부 서버 이전 체크리스트

1. **DB**
   - [ ] 마이그레이션 파일로 스키마 동기화
   - [ ] DATABASE_URL 환경변수 변경
   - [ ] 시드 데이터 재실행 (필요시)

2. **애플리케이션**
   - [ ] CORS 설정 (프론트 도메인)
   - [ ] HTTPS 적용
   - [ ] 환경변수 (JWT, 카카오 등) 설정

3. **인프라**
   - [ ] PM2 또는 Docker로 프로세스 관리
   - [ ] Nginx 리버스 프록시
   - [ ] 정기 백업 스크립트
