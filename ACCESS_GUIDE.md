# SK클린텍 - 페이지 접속 가이드

> 로컬 실행 시 기본 주소: **http://localhost:5173** (포트는 5174 등으로 바뀔 수 있음)

---

## 📌 빠른 접속 요약

| 역할 | 로그인 주소 | 기본 계정 |
|------|-------------|-----------|
| **관리자** | `/admin/login` | admin / 1234 |
| **팀장** | `/team/login` | team1@skcleanteck.com / 1234 |

---

## 🔐 관리자 (ADMIN)

### 로그인
- **주소**: `http://localhost:5173/admin/login`
- **아이디**: `admin`
- **비밀번호**: `1234`

### 로그인 후 접근 가능한 페이지

| 메뉴 | 주소 | 설명 |
|------|------|------|
| 대시보드 | `/admin/dashboard` | DB 접수 폼, 오늘 접수/미분배/진행중 통계 |
| 문의 목록 | `/admin/inquiries` | 전체 문의 목록, 담당 지정, 상태 변경, C/S 처리 |
| 스케줄 표 | `/admin/schedule` | 달력 뷰, 날짜별 일정, 상세 보기 |
| 팀장 관리 | `/admin/team-leaders` | 팀장 등록/목록 |
| 메시지 | `/admin/messages` | 팀장과 1:1 메시지 |

### 직접 URL 접속 예시
```
http://localhost:5173/admin/dashboard
http://localhost:5173/admin/inquiries
http://localhost:5173/admin/schedule
http://localhost:5173/admin/team-leaders
http://localhost:5173/admin/messages
```

---

## 👷 팀장 (TEAM_LEADER)

### 로그인
- **주소**: `http://localhost:5173/team/login`
- **아이디**: `team1@skcleanteck.com` (또는 등록된 팀장 이메일)
- **비밀번호**: `1234`

### 로그인 후 접근 가능한 페이지

| 메뉴 | 주소 | 설명 |
|------|------|------|
| 일정 | `/team/dashboard` | 오늘 일정, 다가오는 일정, 스케줄 상세(달력) |
| 메시지 | `/team/messages` | 관리자에게 메시지 전송 |

### 직접 URL 접속 예시
```
http://localhost:5173/team/dashboard
http://localhost:5173/team/messages
```

---

## 🔄 접속 흐름

### 관리자
1. `/admin/login` 접속 → 로그인
2. 로그인 성공 시 `/admin/dashboard`로 이동
3. 상단 메뉴로 각 페이지 이동

### 팀장
1. `/team/login` 접속 → 로그인
2. 로그인 성공 시 `/team/dashboard`로 이동
3. 상단(데스크톱) 또는 하단(모바일) 메뉴로 이동

---

## ⚠️ 참고 사항

- **미로그인 시**: `/admin/*`, `/team/*` 접속 시 각각 로그인 페이지로 리다이렉트
- **루트 접속** (`/`): `/admin/login`으로 자동 이동
- **잘못된 경로**: `/admin/login`으로 이동
- **관리자 ↔ 팀장**: 서로 다른 로그인 주소 사용 (계정 혼용 불가)
