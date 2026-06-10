# 테넌트 간 DB 거래 (Tenant DB Exchange)

> **목적**: 같은 솔루션을 쓰는 테넌트끼리 접수(DB)를 주고받고, 수수료·정산·양방향 동기화를 한다.  
> **기존 타업체(`ExternalCompany`)와 병행** — 타업체는 솔루션 미사용 외부 협력사, 본 기능은 **테넌트(솔루션 가입 업체)** 대상.

**관련**: [MULTI_TENANT_PLATFORM.md](./MULTI_TENANT_PLATFORM.md), [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) §8  
**구현 룰**: `.cursor/rules/tenant-db-exchange.mdc`  
**기능 모듈 ID**: `mod_tenant_exchange` (신규)

---

## 1. 합의된 정책 (확정)

| # | 항목 | 결정 |
|---|------|------|
| 1 | **송신 측 전달 후 편집** | **수정 가능** — 고객은 원 상담사(송신 테넌트)에게 연락하므로 원본 접수는 잠그지 않는다. 변경은 수신 측에 동기화한다. |
| 2 | **상태 동기화** | **`COMPLETED` / `CANCELLED` 양방향 자동 반영** 필수. |
| 3 | **수신 측 접수번호** | **독립 채번** — `allocateNextInquiryNumber(tx, targetTenantId, …)` 사용. 송신 번호는 메타/배지로만 표시. |
| 4 | **수수료 정산** | **판매자**: 타업체 정산과 동일 — 업체별 받을 금액·받은 금액·잔액. **구매자**: 쌓인 구매비·지급액·잔액. |
| 5 | **플랫폼 개입** | 분쟁·이상 대비 **플랫폼이 share/파트너십 일시 중지** 권한 보유. |

---

## 2. 기존 타업체 vs 테넌트 DB 거래

| | 타업체 (`mod_external_co`) | 테넌트 DB 거래 (`mod_tenant_exchange`) |
|---|---------------------------|----------------------------------------|
| 상대 | `ExternalCompany` + `EXTERNAL_PARTNER` 로그인 | 다른 `Tenant` (ADMIN이 자체 전산 사용) |
| 데이터 | 원본 1건, 우리 DB만 | **mirror 2건** + `TenantInquiryShare` 링크 |
| 수수료 필드 | `Inquiry.externalTransferFee` | `TenantInquiryShare.transferFee` (+ 링크) |
| 정산 UI | `/admin/team-leaders/external-companies` 정산 | 신규 「테넌트 DB 정산」 (패턴 복제) |
| 참고 코드 | `server/src/modules/external-companies/externalCompanies.routes.ts` | 동일 집계 패턴 추출·재사용 |

---

## 3. 데이터 모델

### 3.1 `TenantPartnership`

테넌트 쌍의 파트너십. **항상 `tenantLowId < tenantHighId` 로 정규화**해 `(low, high)` unique.

| 필드 | 설명 |
|------|------|
| `tenantLowId`, `tenantHighId` | 참여 테넌트 |
| `status` | `PENDING` → `ACTIVE` → `SUSPENDED` / `REJECTED` |
| `requestedByTenantId` | 초대한 쪽 |
| `lowAcceptedAt`, `highAcceptedAt` | 각 쪽 ADMIN 승인 시각 |
| `suspendedAt`, `suspendedBy` | `PLATFORM` \| `TENANT_LOW` \| `TENANT_HIGH` |
| `memo` | 내부 메모 |

**ACTIVE 조건**: 양쪽 `*AcceptedAt` 모두 not null, `status = ACTIVE`, 양 테넌트 `status != SUSPENDED`.

### 3.2 `TenantInquiryShare`

접수 1건의 cross-tenant 링크.

| 필드 | 설명 |
|------|------|
| `partnershipId` | FK |
| `sourceTenantId`, `sourceInquiryId` | 송신 |
| `targetTenantId`, `targetInquiryId` | 수신(mirror) |
| `direction` | `LOW_TO_HIGH` \| `HIGH_TO_LOW` (정규화된 low/high 기준) |
| `transferFee` | 건별 수수료(원) |
| `syncStatus` | `ACTIVE` \| `PAUSED` \| `REVOKED` |
| `sourceInquiryNumberSnapshot` | 송신 번호 스냅샷(표시용) |
| `sharedAt`, `sharedByUserId` | 전달 이력 |
| `cancelFeeDirection` | 취소 역분개용 (타업체 `cancelFeeExternalCompanyId` 패턴) |

**플랫폼 중지**: `syncStatus = PAUSED` 또는 partnership `SUSPENDED` → PATCH 동기화·신규 전달 차단.

### 3.3 정산

| 테이블 | 역할 |
|--------|------|
| `TenantPartnerSettlementPayment` | 지급/수금 1행 (판매자·구매자 각각 자기 tenantId 스코프) |
| `TenantPartnerSettlementReset` | 정산 완료 후 누적 초기화 (타업체 reset 패턴) |

집계 API는 **역할별 2뷰**:

- **판매자(receivable)**: `payableAmount`, `paidAmount`, `remainingAmount` per partner tenant
- **구매자(payable)**: `accruedAmount`, `paidAmount`, `remainingAmount` per partner tenant

기준일: 타업체와 동일 **예약일 `preferredDate` KST**. 취소는 마이너스 반영.

---

## 4. 동기화

### 4.1 송신 측 편집 가능 (합의 #1)

- 전달 후에도 송신 `Inquiry`는 **일반 PATCH 가능**.
- PATCH 시 `tenantInquirySync.service`가 수신 mirror에 **허용 필드만** 반영.
- UI: 송신 측 배지 `🔗 {partnerName}에 전달됨` + 툴팁 「수정 시 상대 전산에도 반영됩니다」.

### 4.2 상태 동기화 (합의 #2)

- `status`가 `COMPLETED` 또는 `CANCELLED`로 바뀌면 **반드시** 상대 mirror에 동일 상태 반영.
- 취소 시 `cancelFeeDirection` / partnership 방향으로 역분개 대상 고정 (타업체 취소 fee 패턴).
- 그 외 상태(`ASSIGNED`, `IN_PROGRESS` 등)는 **기본 비동기화** — 수신 테넌트 운영 자율. (필요 시 2차 확장)

### 4.3 동기화 필드 화이트리스트 (1차)

**동기화 O**

- 고객·연락처: `customerName`, `customerPhone`, `customerPhone2`
- 주소·현장: `address`, `addressDetail`, `propertyType`, `areaPyeong`, `areaBasis`, `exclusiveAreaSqm`, `isOneRoom`, `roomCount`, …
- 일정: `preferredDate`, `preferredTime`, `preferredTimeDetail`, `betweenScheduleSlot`
- 건물: `buildingType`, `moveInDate`, `moveInDateUndecided`
- 금액: `serviceTotalAmount`, `serviceDepositAmount`, `serviceBalanceAmount`
- 메모: `specialNotes`, `consultationMemo`, `memo`
- **상태**: `COMPLETED`, `CANCELLED` 만

**동기화 X (테넌트별 독립)**

- `inquiryNumber`, `tenantId`, `createdById`, `internalCustomerTone`
- `assignments`, `crewMemberCount`, `crewMemberNote`, `crewMeetingTime*`
- `professionalOptionIds` (마스터가 테넌트마다 다름)
- `orderFormId` (발주서는 테넌트별)

### 4.4 루프 방지

- `tenantInquirySync.service` 내부에서만 cross-tenant `update`.
- 컨텍스트 플래그 `syncOrigin: 'TENANT_SHARE'` — 재진입 시 sync 스킵.
- `InquiryChangeLog`에 `source: TENANT_SHARE_SYNC` 기록.

### 4.5 충돌

- 1차: **LWW** (`updatedAt` 기준, sync 시 상대만 갱신).
- 동시 수정은 change log로 추적; 2차에 충돌 UI 검토.

---

## 5. API·화면

### 5.1 테넌트 API (`/api/tenant-partners/*`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 파트너십 목록 |
| POST | `/request` | `{ partnerSlug }` 초대 |
| POST | `/:id/accept` | 승인 |
| POST | `/:id/reject` | 거절 |
| POST | `/:id/suspend` | 테넌트 측 중지 요청 |
| POST | `/shares` | `{ inquiryId, partnershipId, transferFee, fieldPreset?, fieldMask? }` 전달 |
| GET | `/settlement/export` | `role`, `partnerTenantId`, `from?`, `to?` — 정산 CSV |
| GET | `/settlement/seller-summary` | 판매자 receivable |
| GET | `/settlement/buyer-summary` | 구매자 payable |
| POST | `/settlement/payments` | 지급 기록 |

모든 라우트: `authMiddleware` + `adminOnly` + `requireFeature('mod_tenant_exchange')` + `requireTenantIdFromAuth`.

### 5.2 플랫폼 API (`/api/platform/tenant-partnerships/*`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 파트너십·share 메타 목록 (PII 마스킹) |
| POST | `/:id/suspend` | **플랫폼 강제 중지** (합의 #5) |
| POST | `/:id/resume` | 중지 해제 |

업무 데이터(`Inquiry` 본문) **직접 조회 금지** — `multitenant-safety.mdc` 준수.

### 5.3 관리자 UI

| 위치 | 내용 |
|------|------|
| `관리 → 팀장·타업체` 인근 또는 신규 GNB | 「테넌트 DB 거래」 |
| 파트너 목록·초대·승인 | slug 검색 |
| 정산 | 판매/구매 탭 (타업체 정산 UI 복제) |
| 접수 상세 | `ScheduleInquiryDetailModal` 정산 블록에 파트너 선택·수수료·「DB 전달」 |

**필수**: `inquiry-edit-dual-surface-sync.mdc` — 스케줄·접수 목록 **동일 모달** 동시 반영.

---

## 6. 구현 로드맵 (단계별 체크리스트)

### Phase 1 — 파트너십만 (전달 없음)

- [x] `shared/tenantFeatureModules.ts` — `mod_tenant_exchange` 추가
- [x] Prisma + migration: `TenantPartnership`
- [x] `server/src/modules/tenant-partners/` — request/accept/reject/list
- [x] `client` — 파트너 관리 페이지, GNB, `FeatureGate`
- [x] `verify-multitenant-tenant-exchange` — feature off 403·필드 마스크 단위 검증
- [x] `tsc` server/client (Phase 2 구현 후)

**완료 기준**: A가 B slug 초대 → B 승인 → ACTIVE. 전달 버튼은 Phase 2에서 활성.

### Phase 2 — DB 전달 + mirror

- [x] Prisma: `TenantInquiryShare`
- [x] `tenantInquiryShare.service` — mirror `Inquiry` create, 독립 채번, 배지 필드
- [x] `POST /api/tenant-partners/shares`
- [x] 접수 상세 UI — 파트너·수수료·전달 (`ScheduleInquiryDetailModal`)
- [x] 송신 원본 유지 + `🔗 {partner}에 전달` 배지
- [x] 수신 `📥 {partner}에서 수신` 배지 + `sourceInquiryNumberSnapshot` 표시
- [x] 목록·스케줄 API 응답에 `tenantShare` 메타 포함

**완료 기준**: ACTIVE 파트너에게 1건 전달 → 양쪽 목록에 각각 표시, 번호 서로 다름.

### Phase 3 — 정산

- [x] `TenantPartnerSettlementPayment` / `Reset`
- [x] `GET /settlement/seller-summary` · `buyer-summary` · `partner-detail`
- [x] `POST /settlement/payments` · `reset-accrual`
- [x] 정산 UI — 판매/구매 탭 (`AdminTenantPartnerSettlementPage`)
- [x] 취소 역분개 — `signedShareTransferFee` 마이너스 + `cancelFeeDirection` 스탬프(PATCH)

### Phase 4 — 양방향 동기화

- [x] `tenantInquirySync.service` + `inquiries.routes` PATCH hook
- [x] 화이트리스트 + `COMPLETED`/`CANCELLED` (수신→송신은 상태만)
- [x] change log 연동 (`[테넌트DB동기화]` 접두)
- [x] 플랫폼 `/api/platform/tenant-partnerships` suspend/resume → sync 차단·복구

### Phase 5 — 고도화

- [x] `sync_field_mask` migration + `tenantInquiryShareFields` (부분 필드 전달)
- [x] share 생성·PATCH 동기화에 field mask 반영 (`customer_schedule` 프리셋)
- [x] 상담사진 cross-tenant — `tenantInquiryPhotoSync.service` (URL 공유)
- [x] 수신 알림 — `notifyTenantShareReceived` (변경 이력 WS)
- [x] `GET /settlement/export` CSV + 정산 UI 다운로드
- [x] 접수 상세 — 「고객·일정만」체크박스

---

## 7. 코드 참조 맵 (구현 전 필독)

| 영역 | 파일 |
|------|------|
| 타업체 정산 집계 | `server/src/modules/external-companies/externalCompanies.routes.ts` (`/settlement/payable`, `/summary`, `/accruals`, `/payments`) |
| 접수 PATCH | `server/src/modules/inquiries/inquiries.routes.ts` |
| 접수 편집 UI | `client/src/components/admin/ScheduleInquiryDetailModal.tsx` |
| 접수번호 채번 | `server/src/modules/inquiries/inquiryNumber.ts` |
| 변경 로그 | `server/src/modules/inquiry-change-logs/` |
| 테넌트 스코프 | `server/src/modules/tenants/tenantScope.helpers.ts` |
| 기능 모듈 | `shared/tenantFeatureModules.ts` |
| 플랫폼 테넌트 | `server/src/modules/platform/tenantProvisioning.service.ts` |

---

## 8. PR·배포 체크리스트

- [ ] 모든 신규 테이블 `tenantId` 또는 partnership을 통한 tenant 검증
- [ ] cross-tenant write는 **전용 service 1곳**만
- [ ] `schema.prisma` + migration SQL (db push 금지)
- [ ] `npm run verify:multitenant:tenant-exchange` + `verify:multitenant:phase4`
- [ ] server/client `tsc`
- [ ] 스테이징: A→B 전달, B 수정→A 반영, CANCELLED 양쪽, 정산 잔액

---

## 9. 용어

| 용어 | 의미 |
|------|------|
| 송신(판매) 테넌트 | DB를 넘기는 쪽 — 원본 접수 보유 |
| 수신(구매) 테넌트 | mirror 접수를 받아 운영하는 쪽 |
| mirror | 수신 테넌트에 생성된 복제 `Inquiry` |
| share | `TenantInquiryShare` 1행 |

---

*최종 합의 반영: 2026-06. Phase 1부터 순차 구현.*
