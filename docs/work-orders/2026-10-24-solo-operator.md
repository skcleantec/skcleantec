# 작업지시서 — 1인 업체: 팀장 기능 합치기 · 가계부 메인 · 잠금 메뉴

> Maestro 작업지시서 모드로 실행 (`.cursor/skills/maestro-orchestrator/SKILL.md` §작업지시서 모드).
> 규칙: `.cursor/rules/solo-operator-mode.mdc` · `.cursor/rules/multitenant-safety.mdc`
> 리포트 폴더: `agent/orchestrator/reports/packs/2026-10-24-solo-operator/`
> 브랜치: staging 기준 worktree. **main 푸시·공유 DB migrate 금지.**

## 목표 (사용자 원문 요약)

1. 1인 사업자는 팀장 기능을 사장이 직접 쓴다 — 해피콜·일정 알림이 사장에게 온다.
2. 1인은 월정산 대신 **가계부가 메인 메뉴** (팀장처럼).
3. 1인이 못 쓰는 기능을 숨기지 말고 **「유료버전(OO플랜)부터 사용 가능」** 으로 보여준다.

## 현재 코드 사실 (조사 완료 — 다시 찾지 말 것)

- `User.role` 은 단일 enum → 사장을 팀장으로 만들 수 없음.
- 해피콜: `server/src/modules/notifications/happyCallReminder.service.ts` — `core_assignments` OFF면 미배정 접수를 ADMIN에게 푸시 (이미 구현, 원형으로 사용).
- 일정 알림: `server/src/modules/schedule-alerts/scheduleAlerts.service.ts` — `assignments.teamLeaderId` 기준 → 1인 사장에게 안 감.
- 가계부: 테이블 `TeamLeaderHouseholdLedgerEntry.teamLeaderId` → User FK (스키마 변경 불필요).
  - `teamLeaderHouseholdLedger.routes.ts` 가 `role !== 'TEAM_LEADER'` 차단.
  - `teamLeaderHouseholdLedgerAutoSync.service.ts` 가 assignment 존재를 조건으로 prefill.
  - 팀장 UI: `client/src/pages/team/TeamHouseholdLedgerPage`(라우트 `/team/household-ledger`), 하단탭 `teamMobileBottomNav.config.ts`.
  - 관리자 `/admin/.../household-ledger` 는 **팀장들 가계부 조회용**(용도 다름).
- 메뉴 숨김 3곳: GNB `client/src/constants/adminNav.ts`(`canShowAdminNavItem`), 사이드 `client/src/utils/filterAdminSideNavByFeatures.ts`(`canShowTenantNavPath`), 라우트 `client/src/components/auth/FeatureGate.tsx`(off면 대시보드 redirect).
- 플랜: `shared/tenantFeatureModules.ts`(`modulesForPlan`, `TENANT_PLANS`), `shared/tenantPlanCatalog.ts`(라벨·가격). 업그레이드 화면: `/admin/subscription`.

---

## Phase 0 — 공통 기반 (서버·shared)

**에이전트:** CodeGuardian → PlatformOps → DbSentinel · **AppScout 생략**(UI 없음)

할 일
1. `shared/soloOperator.ts` — `isSoloOperatorTenant(enabledModules)` (현재: `core_assignments` 미포함).
2. 서버 `resolveFieldOwnerIds(tenantId, inquiryId)` — 배정 팀장 ID들, 없고 1인이면 활성 ADMIN ID들. 반드시 `tenantId` 스코프.
3. `shared/tenantModuleVisibility.ts` — `getModuleVisibility(mod, plan, enabledModules)` → `{ state: 'enabled'|'locked'|'hidden', requiredPlanId?, requiredPlanLabel? }`
   - locked = 현재 플랜 `modulesForPlan`에 없음 + 상위 플랜에 있음. 플랜에 포함인데 꺼짐 = hidden.
4. 클라이언트가 현재 `plan` 을 아는지 확인 (`/auth/me`). 없으면 응답에 추가.

산출물: 함수 3개 + 각 함수 입력/출력 예시 표 (phase-0.md)
관문: `tsc`(client·server) 통과 · DbSentinel "스키마 변경 없음 / tenantId 누락 없음" 한 줄

## Phase 1 — 알림을 사장에게

**에이전트:** CodeGuardian → ConfigCurator → RoleQA · **AppScout 생략**

할 일
1. 해피콜 solo 분기를 `resolveFieldOwnerIds` 로 교체 — **동작 동일**(dedupeKey 형식 유지).
2. schedule-alerts(일정·금액·취소)도 `resolveFieldOwnerIds` 사용 → 1인 사장 FCM/WS 수신.
3. 관리자 알림 설정 화면: 1인 업체 ADMIN에게 해피콜·일정 알림 토글 표시, 배정 알림은 숨김.

완료 기준
- [ ] 본사형 테넌트: 알림 대상·횟수 변화 없음 (RoleQA 회귀 1순위)
- [ ] 1인 Free 테넌트: 일정 변경 시 사장 폰에 푸시
- [ ] 해피콜 중복 발송 없음

## Phase 2 — 가계부 메인 메뉴 (1인)

**에이전트:** AppScout → (CodeGuardian ∥ DesignPulse ∥ ConfigCurator ∥ MarketingAgency) → RoleQA

AppScout 조사 범위: 1인 사업자 장부 앱(캐시노트, 자비스, 편한가계부류)의 **월 요약 → 일별 내역 → 접수 연결** 화면 흐름, 모바일 하단탭에서의 위치. 결론을 3줄로.

할 일
1. 서버: 가계부 라우트가 **1인 업체 ADMIN** 도 허용 (`teamLeaderId = 본인 userId`). 다른 경우는 지금처럼 차단.
2. 서버: AutoSync — 1인 업체는 assignment 조건 대신 "해당 테넌트 접수 + 담당자 = resolveFieldOwnerIds" 기준으로 prefill.
3. 클라: 1인 업체 관리자 GNB에 **「가계부」 메인 메뉴** (모바일 하단·데스크톱 GNB). 화면은 팀장 가계부 컴포넌트 **재사용**(복제 금지). 라우트 예: `/admin/my-ledger`.
4. 1인 업체에서는 「급여·정산」을 GNB에서 빼고 가계부가 그 자리를 대신 (급여는 Phase 3 규칙으로 locked 표시).

완료 기준
- [ ] 1인 사장: 접수 완료 → 가계부에 수입 자동 기입, 직접 수정 시 `amountLocked`
- [ ] 팀장 가계부·관리자 팀장가계부 조회 화면 회귀 없음
- [ ] 360px 모바일에서 하단탭 겹침 없음
- **사람 확인:** 스테이징에서 사용자 화면 확인 후 Phase 3 진행

## Phase 3 — 잠금 메뉴 「OO부터 사용 가능」

**에이전트:** AppScout → PlatformOps → (DesignPulse ∥ ConfigCurator ∥ MarketingAgency ∥ CodeGuardian) → RoleQA

AppScout 조사 범위: SaaS 업셀 잠금 패턴(노션·슬랙·캐시노트 등) — 메뉴 잠금 표시, 클릭 시 안내 방식, 과한 노출 피하는 법.

할 일
1. GNB·사이드·FeatureGate 모두 `getModuleVisibility` 사용. locked = 🔒(`LineMdIcon`) + 작은 배지 「Standard부터」.
2. locked 라우트 진입 시 redirect 대신 `PlanLockedNotice` 화면: 기능 한 줄 설명 · 필요한 플랜 · 「업그레이드 보기」(`/admin/subscription`).
3. 기능 설명 문구는 `shared/tenantFeatureModules.ts` 각 모듈에 `upsellDescription` 필드로 (화면 하드코딩 금지). 1인 맥락 문구 예: 배정·팀장 = "직원이 생기면 — Standard부터".
4. 노출 과다 방지: GNB에는 상위 메뉴만 잠금 표시, 하위 메뉴 잠금은 사이드에서만.
5. 서버 `requireFeature` 403 유지.

완료 기준 (RoleQA 플랜 매트릭스 필수)
- [ ] Free 1인 / 유료 1인 / Standard 본사 / Premium 본사 × 주요 메뉴 표
- [ ] locked 클릭 → 대시보드로 튕기지 않음
- [ ] 업체가 직접 끈 기능은 숨김 유지 (잠금으로 보이면 안 됨)
- [ ] 업그레이드 후 새로고침 없이(`/auth/me` 재조회) 잠금 해제
- **사람 확인:** 스테이징 화면 확인

---

## 이번 범위 밖 (다음 작업지시서)

- 팀장 화면의 현장 사진·검수·카드결제·견적을 관리자 접수 상세에 붙이기
- 운영방식 필드(solo/small/hq) 도입 및 가입 온보딩 질문
