# Phase 1 — 회원사 가입

스키마 SQL은 작성만 했다. staging `migrate deploy`는 사용자 확인 전이라 실행하지 않았다. 화면은 마이그레이션 전에는 목록 API가 실패한다.

## DbSentinel

- 추가만. `BarobillMember` + `operating_companies.barobill_member_id` nullable unique FK (`ON DELETE SET NULL`).
- `@@unique([env, corpNum])`, `@@index([tenantId, env])`, tenant FK cascade.
- 상태 `ACTIVE | LINK_REQUIRED | FAILED`. 비밀번호 컬럼 없음.
- 업체 API 조회·수정은 `tenantId` 포함. 다른 업체 사업자번호는 이름 없이 409.
- 플랫폼 목록은 지시서의 운영 목록이라 전 업체 조회. 응답은 환경·업체명·브랜드·상태·과세유형·마스킹 사업자번호만. 연락처는 안 내려줌. 처리완료 `updateMany`는 `id`와 `tenantId`를 같이 씀.
- 플랫폼 `findFirst({ id })`는 처리완료 한 건을 찾기 위한 운영 조회이고, 이어서 tenant 조건을 넣어 갱신한다.

## CodeGuardian

- 가입 순서: 사업자번호 정규화 → `CheckCorpIsMember` → 0이면 `RegistCorp` → `GetCorpState`. 이미 회원(-32000 또는 회원 플래그)은 `LINK_REQUIRED`. 개인 업체는 버튼 전에 서버도 거부.
- 아이디는 `cb`+영숫자, 6–20자. 비밀번호는 호출에만 쓰고 저장·로그하지 않음.
- 브랜드 없는 접수용 `resolveCashbillMemberForBrand`만 준비. 발행 API는 없음.
- 같은 브랜드 재가입(ACTIVE)은 409. test env가 아니면 403.

## ConfigCurator

- 표시: 가입완료 / 연결 필요 / 실패. 설정에서 끄기 없음.
- 레지스트리 `admin.cashbill.memberStatus`. 도움말 경로 `/admin/team-leaders/cashbill`.
- 메뉴 글자 「증빙 발급 설정」, 플랫폼 「현금영수증 회원」.

## DesignPulse

- 관리 화면: 브랜드 카드, 업태·종목·담당 전화·이메일. 상호·번호·대표자는 사업자정보에서 채움. 주소·담당자명이 비면 입력칸을 더 연다.
- 버튼 slate-900, hover / focus-visible / disabled. 모바일 입력은 본문 스크롤 위로.
- 플랫폼: 등록일 전체·월별·날짜, 상태 필터, 페이지당 30, 표+모바일 카드, URL 쿼리.

## MarketingAgency

- `CATALOG.md`, `menus/admin.md`, `catalog.json`, `CHANGELOG.md`에 메뉴·배지 색(emerald / amber / red, 버튼 `#0f172a`)을 반영.

## PlatformOps

- `mod_cashbill`을 shared·서버 카탈로그, Standard, Standard+, Premium 업무 모듈에 추가. Free에는 없음.
- 관리 API `requireFeature('mod_cashbill')` + ADMIN. 잠금은 기존 `FeatureGate` → 「Standard부터」.
- 플랫폼 API는 플랫폼 로그인. 처리완료는 test 행이고 `CheckCorpIsMember`가 회원일 때만.

## RoleQA

- 본사·1인 화면 파일은 수정하지 않음. 1인 숨김은 팀장 가계부만이라 증빙 메뉴는 플랜에 따라 잠금 또는 표시.
- 서버·클라이언트 tsc 통과.
- 브라우저 클릭은 하지 않음. DB에 테이블이 없고, test 인증키와 테스트 사업자번호가 없어 가입 1건도 호출하지 않음.
- 회귀로 본 범위: 기존 알림톡·카드결재 라우트 옆에 라우트만 추가. 발행·취소 코드는 없음.
