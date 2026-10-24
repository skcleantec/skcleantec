# Phase 0 — 공통 기반

작업 트리: `_wt-admin-household-wage-main` (staging 기준). 스키마 변경 없음. 공유 DB migrate 없음.

## CodeGuardian

- `isSoloOperatorTenant` 한 곳. 기준은 `core_assignments` 없음. `null`(기능 목록 로드 전)은 1인이 아님.
- `resolveFieldOwnerIds(tenantId, inquiryId)`: 접수 존재 확인(`id`+`tenantId`) → 배정 팀장 → 없으면 1인일 때만 활성 ADMIN. 본사는 배정이 없으면 빈 배열.
- `getModuleVisibility`는 메뉴에 아직 연결하지 않음 (Phase 3).
- 서버 쿼리는 `tenantId` 포함. `findUnique({ where: { id } })` 없음.

## PlatformOps

`/auth/me`는 이미 `tenant.plan`과 `features`를 준다. `AdminLayout`이 `TenantCapabilitiesProvider`의 `plan`으로 넣는다. 필드를 추가하지 않았다.

| 입력 | 결과 |
|---|---|
| free 모듈, `mod_payroll` | locked, Standard+ |
| free 모듈, `core_messages` | locked, Standard |
| standard에서 `mod_cs`만 뺌 | hidden |
| standard, `core_assignments` 켜짐 | enabled |
| premium, `mod_telecrm` | hidden (어떤 플랜 모듈 목록에도 없음) |

## DbSentinel

스키마 변경 없음, tenantId 누락 없음.

## 관문

- server `npx tsc --noEmit` 통과
- client `npx tsc -b --noEmit` 통과
