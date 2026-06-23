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
         ↓
      WITHDRAWN (OPEN만, 구매 신청 없을 때)
```

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
| POST | `/:id/buyer-confirm`, `/:id/seller-confirm` | 2 |

---

## 5. UI

| 위치 | 내용 |
|------|------|
| GNB | **정보공유** + 장바구니(DRAFT) 배지 |
| `/admin/db-marketplace` | 구매 가능 / 내 판매 / 진행 중 / 확정 완료 |
| 접수 상세 | `InquiryDbMarketplaceSellPanel` (직접 연계 블록과 분리) |

---

## 6. 로드맵

### Phase 1 — 게시·마스킹 (현재)

- [x] `mod_db_marketplace` + migration
- [x] shared 마스킹·금액
- [x] draft / publish / withdraw / list
- [x] 접수 상세 판매 UI + GNB

### Phase 2 — 양쪽 확정·이동

- [ ] buyer-confirm / seller-confirm
- [ ] share 또는 타업체 배정 + 미수금
- [ ] 확정 후 full detail

### Phase 3 — 타업체 GNB·UX

- [ ] EXTERNAL_PARTNER 정보공유
- [ ] verify 스크립트
