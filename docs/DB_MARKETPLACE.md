# DB 마켓 — 정보공유

> **목적**: 접수 DB를 마켓에 게시하고, 파트너·타업체가 **선택·양쪽 확정** 후 인수한다.  
> **직접 연계**(`mod_tenant_exchange`)와 **별도** — UI·API·정책 혼합 금지.

**관련**: [TENANT_DB_EXCHANGE.md](./TENANT_DB_EXCHANGE.md), [MULTI_TENANT_PLATFORM.md](./MULTI_TENANT_PLATFORM.md)  
**구현 룰**: `.cursor/rules/db-marketplace.mdc`  
**기능 모듈 ID**: `mod_db_marketplace`

---

## 1. 확정 정책

| 항목 | 결정 |
|------|------|
| 구매 전 금액 | `displayAmount = 잔금 − listingFee` **만** 노출 |
| 구매 전 PII | 이름 마스킹, 주소 시·구, 전화·이메일 비노출, 청소·일정 필드 전부 노출 |
| 확정 | **구매자 확정 + 판매자 인계 확정** 후 이동 |
| CONFIRMED 후 | 취소·환불 없음 (고객 접수 취소만 기존 sync) |
| 파트너 | mirror + `TenantInquiryShare` (Phase 2) |
| 타업체 | 기존 external 배정 + `externalTransferFee` (Phase 2) |

---

## 2. 상태

```
DRAFT → OPEN → PENDING_SELLER → CONFIRMED
         ↓              ↓ (판매자 거절)
      WITHDRAWN        OPEN
         ↓ (30일 경과, OPEN만)
      EXPIRED → (재게시) OPEN
```

- `OPEN`만 철회 가능(구매 신청 없을 때).
- `PENDING_SELLER`에서 판매자 **구매 신청 거절** → `OPEN` 복귀(구매자 정보 초기화).
- **게시 30일** 경과 시 `OPEN` → `EXPIRED` (PENDING_SELLER는 유지).
- **플랫폼 중지**(`platformSuspendedAt`) 시 구매 신청 차단 — 판매자·플랫폼 API로 해제.

목록 정렬: `OPEN` · `PENDING_SELLER` 최상단.

---

## 3. 데이터 모델

- `InquiryDbListing` — 접수 1건당 listing 1개 (`inquiryId` unique)
- `InquiryDbListingAudience` — `visibility=SELECTED` 일 때 파트너·타업체

---

## 4. API (`/api/db-marketplace/*`)

| Method | Path | Phase |
|--------|------|-------|
| POST | `/draft` | 1 |
| PATCH | `/:id/audience` | 1 |
| POST | `/:id/publish` | 1 |
| POST | `/:id/withdraw` | 1 |
| GET | `/`, `/:id`, `/by-inquiry/:inquiryId`, `/draft-count` | 1 |
| POST | `/:id/buyer-confirm`, `/:id/seller-confirm`, `/:id/seller-decline` | 2–4 |
| GET | `/draft-count` (장바구니 + 인계 대기 + 구매 대기 건수) | 1, 4, 6 |
| GET/POST | `/api/team/db-marketplace/*` (타업체 EXTERNAL_PARTNER) | 2–3 |
| GET/POST | `/api/platform/db-marketplace/*` (플랫폼 중지·목록, PII 없음) | 5 |

---

## 5. UI

| 위치 | 내용 |
|------|------|
| GNB | **정보공유** + 장바구니(DRAFT) + 인계 대기(판매) + 구매 대기(파트너) 배지 |
| `/admin/db-marketplace` | 구매 가능 / 내 판매 / 진행 중 / 확정 완료 |
| `/team/db-marketplace` | 타업체 — 구매 가능 / 인계 대기 / 확정 완료 + GNB 인계 대기 배지 |
| `/platform/db-marketplace` | 플랫폼 — listing 메타·중지/해제 (PII 없음) |
| 접수 상세 | `InquiryDbMarketplaceSellPanel` (직접 연계 블록과 분리) |
| 연계 배지 | `TenantInquiryShareBadge` — 정보공유 경유 share 표시 |

---

## 6. 로드맵

### Phase 1 — 게시·마스킹 (현재)

- [x] `mod_db_marketplace` + migration
- [x] shared 마스킹·금액
- [x] draft / publish / withdraw / list
- [x] 접수 상세 판매 UI + GNB

### Phase 2 — 양쪽 확정·이동

- [x] buyer-confirm / seller-confirm
- [x] share 또는 타업체 배정 (정산은 기존 share·external 집계)
- [x] 확정 후 full detail API
- [x] 타업체 buyer-confirm (`/api/team/db-marketplace`)

### Phase 3 — 타업체 GNB·UX

- [x] EXTERNAL_PARTNER 정보공유 (`/team/db-marketplace` + GNB)
- [x] WebSocket `inbox:refresh` + silent 재조회 (관리·타업체)
- [x] `verify:multitenant:db-marketplace` 스크립트

### Phase 4 — 거절·배지·UX

- [x] 판매자 구매 신청 거절 (`POST /:id/seller-decline`) → `OPEN` 복귀
- [x] GNB 인계 대기(PENDING_SELLER) 배지
- [x] 접수·스케줄 목록 `InquiryDbMarketplaceBadge`
- [x] 확정 상세 연결 접수 링크 (`openInquiry` 딥링크)
- [x] 만료(`EXPIRED`) — 게시 후 30일, OPEN 자동 만료
- [x] 플랫폼 강제 중지 (`/api/platform/db-marketplace/:id/suspend|resume`)

### Phase 5 — 만료·플랫폼 중지

- [x] `EXPIRED` 상태 + `expiresAt` / `expiredAt` (게시 30일)
- [x] 목록·상세 조회 시 OPEN 만료 lazy 처리
- [x] `platformSuspendedAt` — 구매 차단, 판매자 UI 안내
- [x] 플랫폼 API (PII 없음) — 목록·중지·해제
- [x] 만료 건 재게시 (EXPIRED → OPEN)

### Phase 6 — 플랫폼 UI·정산 연계·배지

- [x] 플랫폼 콘솔 `/platform/db-marketplace` — listing 목록·중지/해제 UI
- [x] `TenantInquiryShareMeta.viaMarketplace` — 마켓 확정 share 구분
- [x] `TenantInquiryShareBadge` — 「정보공유」칩
- [x] 확정 상세 — 파트너·타업체 정산 화면 링크
- [x] GNB 배지 — 관리자 구매 대기(`buyerPendingCount`), 타업체 인계 대기(`marketplacePendingCount`)
- [x] `GET /db-marketplace/draft-count` — `buyerPendingCount` 추가

### Phase 7 — 정산 E2E·딥링크·검증

- [x] `dbMarketplaceSettlementMeta` — share·접수 ↔ CONFIRMED listing 조회
- [x] 파트너·타업체 정산 상세/CSV — `viaMarketplace` (정보공유) 표시
- [x] 파트너 정산 UI — 「수수료」내역 모달 + 정보공유 칩
- [x] 타업체 정산 상세 — 정보공유 칩
- [x] 정보공유 URL `?openListing=` 딥링크 (관리·팀)
- [x] `verify:multitenant:db-marketplace` — 기능 게이트·교차 tenant 격리

### Phase 8 — 직접 연계 UX 통합·만료 재게시·딥링크

- [x] 접수 상세 — 파트너 직접 연계 → 「정보공유로 등록하기」(수수료·파트너 prefill)
- [x] `InquiryDbMarketplaceSellPanel` — EXPIRED 「다시 게시」 버튼
- [x] 접수 상세 판매 패널 — 정보공유 목록 링크 (`?openListing=`)
- [x] 확정 상세 — 판매자(SELLER) 역할 판매 접수 `openInquiry` 링크
- [x] `/admin/schedule?openInquiry=` 딥링크 (스케줄 접수 수정)
