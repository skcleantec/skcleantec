# Phase 1 — 합치기

브랜치 `release/barobill-prod` = `origin/main` (`efeb5287`) 에 `origin/staging` (`ebebe2e6`) 머지. worktree `C:\skcleantec-wt-barobill-prod`.

## DbSentinel

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 마이그레이션 17개 유지, 기존 SQL 내용 불변 | 통과 | main 10개·staging 7개 폴더 존재. `git diff origin/main -- server/prisma/migrations` 는 staging 7개 추가만. `git diff origin/staging -- server/prisma/migrations` 는 main 10개 추가만 |
| `pgClerk` / `TenantPgClerkCode` 없음 | 통과 | `schema.prisma` 에 모델 없음. `git grep pgClerk -- server/src client/src` 0건. staging 전용 `pgClerk.service.ts` 삭제 |
| 스키마에 두 줄기 | 통과 | `TenantPgRail` `schema.prisma:93`, `PlatformPgAgency` `schema.prisma:642`, `TenantPgCredential` `schema.prisma:725`, `BarobillMember` `schema.prisma:1660`, `SkHomepageMailInbox` `schema.prisma:5299`, `TenantWalletUsageLog` `schema.prisma:5342` |
| `prisma validate` | 통과 | 더미 URL 로 schema valid |
| `migrate diff` 빈 결과 | 실패 (2025 기존 이력) | 빈 Postgres `--from-migrations` → `P3006` `20250418130400_assignment_detail_viewed_at` (`assignments` 없음). 이미 적용된 SQL 은 고치지 않음. 대체 비교는 아래 |

## 스키마끼리 비교 (2026-10-29 추가)

`npx prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script`. 스냅샷은 `origin/main`, `origin/staging`(`ebebe2e6`), `release/barobill-prod`(`c85de283`).

| 방향 | 결과 |
| --- | --- |
| main → release | 바로빌만 추가. `barobill_members`, `cash_bill_issues`, `tax_invoice_issues`, `tenant_wallet_usage_logs`, `cashbill_platform_holds`, `operating_companies.barobill_member_id`. main 의 PG·홈페이지 메일·스케줄 높이를 지우지 않음 |
| staging → release | main 기능만 추가·clerk 제거. `TenantPgRail`, `tenant_pg_credentials.rail`, `card_payments.goods_name`, `platform_pg_agencies`, `sk_homepage_mail_inboxes`, `sk_homepage_inquiry_mails`, `schedule_staff_notice_boards.body_height_px`. `tenant_pg_clerk_codes` 와 `pg_clerk_no`/`pg_clerk_code` 삭제. 바로빌 테이블은 유지 |
| main → staging | 위험 방향. 바로빌은 생기지만 `platform_pg_agencies`·홈페이지 메일·`body_height_px`·`rail` 이 빠지고 clerk 가 되살아남. 이번 합치기는 이 방향을 쓰지 않음 |

## CodeGuardian

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| server `tsc --noEmit` | 통과 | worktree `server` |
| client `tsc -b --noEmit` | 통과 | worktree `client` |
| 카드·PG·홈페이지 메일·1인·스케줄 공지 | main | 카드결제 파일은 main (`--ours`). 홈페이지 메일 모델·사이드 필터 `AdminTeamLeadersLayout.tsx` |
| 바로빌·영수증·지갑 | staging | 라우트·모델·지갑 충전 `openTenantWalletWindow` 를 이용료 서비스에 유지. `loadServiceBridgeMerchants` 는 main 이 async 라 `await` |
| 같은 파일에 둘 다 | 둘 다 | `App.tsx` 카드결제 라우트 + `/receipt/:token` + 바로빌 회원. `schema.prisma` Inquiry 관계 |

충돌을 고친 파일과 살린 쪽:

| 파일 | 살린 쪽 |
| --- | --- |
| `server/src/modules/card-payment/*`, `shared/cardPayment.ts`, 카드·PG 화면 | main |
| `server/prisma/schema.prisma` PG·대리점·홈페이지 메일 | main |
| `server/prisma/schema.prisma` 바로빌·지갑 원장·접수 연결 | staging, 홈페이지 메일과 같이 |
| `PaysisCheckoutResultPage.tsx` | 지갑 링크 + 메인 링크 |
| `usageFeeCardPayment.service.ts` | staging 지갑 + main 의 async 가맹 로드 |
| `App.tsx`, `lazyPages.ts` | 카드 라우트(main)와 영수증·바로빌(staging) |
| `tenantFeatureModules.ts` | `mod_cashbill` 유지 |
| `tenantNavFeatureCatalog.ts` | 홈페이지 문의메일(main) + 영수증 메뉴(staging, 충돌 밖) |
| `AdminTeamLeadersLayout.tsx` | SK 메일 필터(main) + 권한 로딩·수기/링크 활성(양쪽) |
| `platformNav.ts` | staging 그룹(바로빌 메뉴 포함). main 항목은 그룹 안에 있음 |
| `PlatformBillingSettlementPage.tsx` | 제목은 main 「정산」. 지갑 구분·반영 확인은 staging |
| `TeamLayout.tsx`, 견적 복귀, PG 도움말 | main |
| 마케팅·카탈로그 | 양쪽 문장 |
