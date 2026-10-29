# Phase 2 — 열림 스위치

코드는 `release/barobill-prod`. 기본값은 `off`. 인증키 값은 쓰지 않음.

## CodeGuardian

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `off` / `pilot` / `all` | 통과 | `server/src/lib/barobill/barobillOpen.ts:7-22`. `tsx` 로 off=false, pilot 는 목록 업체만 true, all=true |
| 메뉴 | 통과 | `shared/tenantNavFeatureCatalog.ts:58-59`, `:199` 가 `mod_cashbill`. `getEffectiveEnabledModules` 가 닫힌 업체에서 그 모듈을 뺌 `tenantFeatures.service.ts:47-50`. 필터는 hidden `tenantModuleVisibility.ts:26` |
| API 403 문구 | 통과 | `requireTenantFeature.ts:20-22` → `영수증 발행은 준비 중입니다.` |
| 플랫폼 화면 | 통과 | `/api/platform/barobill` 는 `requireFeature` 를 타지 않음 `app.ts:196` |
| server tsc | 통과 | `npx tsc --noEmit` exit 0 |
| 스테이징 off·pilot·all 스크린샷 | 실패 | 이 커밋은 아직 스테이징에 없음. 화면 확인은 배포 후 |

## ConfigCurator

영수증·계산서 연결은 기능 모듈이 있을 때만 보입니다. 끄기 토글은 화면 설정이 아니라 서버 환경 `BAROBILL_OPEN` 입니다. 레지스트리 `cashbill.link.capability` 노트에 반영.
