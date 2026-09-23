# DbSentinel — 발주서 청소 종류 (`cleaningKind`)

**Worktree:** `c:\skcleantec\.push-cleaning-kind`  
**Date:** 2026-09-23  
**Scope:** 청소 종류 persistence (Prisma 컬럼 없음 · `OrderForm.customerAnswers` / `prefillAnswers` JSON 키 `cleaningKind`)

**PUSH-safe: yes**

---

## Legal watch summary

- **청소 종류**는 업무 분류 enum (`MOVE_IN` · `MOVE` · `HANDOVER` · `OCCUPIED` · `SPECIAL`). 성명·전화·주소·카드번호가 아님.
- 개인정보보호법(PIPA) 관점: **추가 식별정보 수집이 아님.** 기존 발주서 제출(이름·전화·주소)과 같은 공개 토큰 경로에 enum 한 칸을 얹은 것.
- 변호사 검토 불필요. 본 판단은 컴플라이언스 메모이며 법률 자문이 아님.

---

## Isolation findings

### Submit (`POST /submit/:token`) — 테넌트 스코프 유지

1. `prisma.orderForm.findUnique({ where: { token } })` — 공개 발주서는 **토큰 unique**로 행을 연다 (`id` 단독 조회 아님).
2. 직후 `assertPublicOrderFormAccess(form.tenantId, req)` — `assertTenantAllowsPublicService` + 선택 slug 검증. **SUSPENDED 차단**.
3. `submitTenantId = form.tenantId` — 이후 템플릿·전문옵션·접수 생성/갱신·코인 모두 이 값 사용.
4. `cleaningKind`는 `parseOrderFormCleaningKind` **허용 집합만** 저장. 임의 문자열·JSON 주입 불가.
5. 저장: `customAnswers[ORDER_FORM_CLEANING_KIND_FIELD_KEY] = cleaningKind` → `orderForm.customerAnswers` + `customerSubmissionSnapshot.fields`. Inquiry typed 컬럼 없음.

공개 API가 slug/토큰 없이 `DEFAULT_TENANT_ID`로 떨어지지 않음.

### Prefill

- `PREFILL_STANDARD_KEYS`에 **`cleaningKind` 포함** (`orderFormPrefill.ts`).
- 마케터 `POST /:id/prefill`: `requireTenantIdFromAuth` + `findFirst({ where: { id, tenantId } })`.
- `buildPrefillFromPayload`가 표준 키로 `prefillAnswers.cleaningKind` 저장 → `overlayPrefillOntoSubmitBody`가 제출 body를 덮어씀(고객 변조 방지).
- `inquiryUpdateDataFromPrefillMap`은 **Inquiry에 cleaningKind를 쓰지 않음** (컬럼 없음 · 정상).

### `findUnique({ where: { id } })` — NEW 코드

- **신규 파일** (`shared/orderFormCleaningKind.ts`, `server/src/lib/orderFormCleaningKind.ts`)에 Prisma 조회 없음.
- 제출 경로에 **id-only `findUnique`를 새로 넣지 않음.** 토큰 조회 + `form.tenantId` 패턴 유지.
- 제출 트랜잭션의 `tx.inquiry.findUnique({ where: { id: existingPending.id } })` / `update({ where: { id } })`는 **기존 제출 경로**. 이번 기능이 도입한 패턴이 아님.

**참고(기존, 이번 변경 아님):** `existingPending` `findFirst` where에 `tenantId`가 없고 `orderFormId`만 사용. 발주서 행은 이미 토큰→테넌트 확정된 뒤라 교차 테넌트 위험은 낮음. 후속 hardening 후보.

---

## Exchange / mirror status

| 경로 | `customerAnswers` / `cleaningKind` 동기화? |
|------|---------------------------------------------|
| 파트너 접수 연계 (`SYNC_WHITELIST_KEYS`) | **아니오** — Inquiry typed 필드만. JSON·발주서 없음 |
| `orderFormId` | **동기화 X** (`TENANT_DB_EXCHANGE.md` §4.3 — 발주서는 테넌트별) |
| mirror backfill (`backfillSourceInquiryFromOrderFormForMigration`) | 전화·일정·면적만. `customerAnswers` 미복사 |
| 정보공유(marketplace) | `customerAnswers` 참조 없음 |
| 텔레CRM brief | **같은 테넌트** 접수에 한해 `customerAnswers` 노출. 교차 테넌트 아님 |

**의도인가?** 예. 청소 종류는 **현장 작업 분류(job detail)** 이고, 현 교환 정책은 발주서 JSON을 파트너 mirror에 실어 보내지 않는다.  
파트너가 종류를 봐야 한다면 Inquiry 정형 필드 + 화이트리스트 추가가 맞다. **이번 패치에서 JSON을 미러에 넣지 않은 것은 올바른 최소화.**

연계 취소(REVOKED → mirror CANCELLED) 경로는 이 변경이 건드리지 않음.

---

## Migration notes

- `schema.prisma` / `schema.template.prisma`: `OrderForm.customerAnswers` · `prefillAnswers` **기존 Json**. **새 컬럼·enum·마이그레이션 없음.**
- 본 기능으로 `prisma migrate` / `db push` **불필요.** 공유 DB에 push 제안 없음.
- 저장소에 있는 `20260923*` landing 마이그레이션은 **본 기능과 무관.**

---

## Data minimization

- 값: 5개 enum 코드만. 자유 텍스트·연락처 아님.
- 제출 메일 스냅샷에 `cleaningKindLabel`(입주청소 등) — 기존 발주서 확인 메일과 동일 채널. 추가 PII 아님.
- 서버 info 로그에 전화·주소·종류를 새로 찍지 않음.
- `sanitizeCustomAnswers` 이후 예약 키로 강제 기록 → 템플릿 커스텀 필드와 키 충돌 시에도 **서버가 검증한 enum만** 남김.

---

## Action items

| 우선 | 항목 | PUSH 차단? |
|------|------|------------|
| — | 없음 | — |
| 후속 | 제출 `existingPending` where에 `tenantId: submitTenantId` 보강 (기존 경로) | no |
| 후속 | 파트너에게 종류가 필요하면 Inquiry 필드 + sync 화이트리스트로만 (JSON 미러 금지) | no |

---

## Verdict

테넌트 격리는 공개 **토큰 발주서 → `form.tenantId`** 를 유지한다. Prisma 스키마 변경 없음. `cleaningKind`는 작업 분류이며 파트너 `customerAnswers` 동기화 대상이 아니다.

**PUSH-safe: yes**
