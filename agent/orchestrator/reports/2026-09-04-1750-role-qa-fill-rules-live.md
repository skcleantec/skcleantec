# RoleQA — 발주서 작성 설정 실기 점검

**일시:** 2026-09-04 17:50 KST  
**환경:** `_wt-staging` 로컬 `npm run dev` (API 3000, Vite 5174) · 테넌트 `sk` / `admin` / `1234`  
**DB:** `server/.env` localhost Postgres (마이그레이션 `20260904170000_order_form_issue_fill_rules` 적용됨)

## 시나리오

| 단계 | 관리자 | 상담사 | 고객 | 기대 |
|------|--------|--------|------|------|
| 발급 화면 | 제목 탭·설정·? | (계정 없음) | — | 탭·URL 유지 |
| 설정 기본값 | 면적=마케터+필수, 성함=셋 다 | — | — | 현재 발주서와 동일 |
| 면적 없이 발급 | POST 400 | — | — | 상담사 입력 안내 |
| 면적 넣고 발급 | POST 200 | — | GET by-token | `areaPyeong.customer=false` |
| 칸 전환 | 성함에서 `#order-field-area` 숨김 | — | — | 한 칸만 표시 |

## 실행 결과

### API (`scripts/tmp-fill-rules-qa.mjs`)

통과한 핵심:

- `GET /orderforms/form-config` · `GET /orderforms/issue-form` — 면적 `{customer:false, required:true}`, 성함 필수, 사진 선택
- `POST /orderforms` 면적 없음 → **400** 「면적(공급·전용·평수)은 상담사가 반드시 입력해야 발급됩니다.」
- `PUT form-config` 후 면적 규칙 유지 `{customer:false, marketer:true, required:true}`
- 브랜드+유입경로(숨고)+면적 34 발급 → **200**, 공개 `GET /by-token` **면적 고객 불가**, 비밀번호 삭제 **200**

환경상 스킵(실패로 집계됐으나 기능 결함 아님):

- 로컬 DB에 `cbiseo` 테넌트 없음 (404)
- `sk/cbiseo` · 마케터 · 팀장 계정 없음 (401)

### Playwright UI (Edge, `http://localhost:5174`)

**20/20 통과**

- 로그인 → `/admin/inquiries/order-issue`
- 제목 탭·설정·? · `?issueView=settings`
- 면적/성함 기본 체크 · F5 후 설정 유지
- 면적 탭 ↔ 성함 탭에서 `#order-field-area` 숨김
- 빈 발급 시 오류 메시지

## 버그

없음 (실기에서 재현된 P0/P1 없음).

## 회귀 위험

- 접수 목록 pin / 마케터 집계 / 팀 스케줄: **해당 없음**
- 로그인 복귀 URL: 발급 `?tab=issue&issueView=settings&issueSection=…` 유지 확인
- 제출 완료 영수증 JSON에 `fillRules` 없음: **정상** (미제출 공개 GET에만 포함)

## 수동 후속 (스테이징·계정 있을 때)

1. 상담사 계정으로 설정 **저장 버튼 비활성 / PUT 403**
2. 스테이징 고객 링크에서 면적 질문 숨김 + 옛 공란 링크 제출 거부 문구
3. 원격 Railway DB는 배포 시 `migrate deploy` (로컬만 적용됨)
