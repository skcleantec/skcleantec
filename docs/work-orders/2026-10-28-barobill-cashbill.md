# 작업지시서 — 바로빌 연동 1차: 공통 기반 · 회원사 가입 · 현금영수증

> Maestro 작업지시서 모드. 규칙: `.cursor/rules/barobill-integration.mdc`, `multitenant-safety.mdc`
> 조사 노트(다시 조사 금지): `docs/barobill/BAROBILL_API_NOTES.md`
> 리포트: `agent/orchestrator/reports/packs/2026-10-28-barobill-cashbill/phase-N.md`
> staging 기준 새 브랜치 `feat/barobill-cashbill` worktree. **main 금지. 운영(prod) 바로빌 호출 금지 — 이번 작업은 test 환경만.** 공유 DB migrate 는 사람 확인 후.

## 확정된 사업 결정 (사용자)
- 바로빌 **수익형 파트너, 파트너 결제**. 서비스브릿지가 바로빌에 충전하고, 업체에는 청소비서 지갑으로 우리가 청구.
- 브랜드(운영사) = **별도 사업자번호** → 브랜드마다 각자 회원사 가입 (브랜드 1 : 회원사 1). API 키는 서비스브릿지 것 하나.
- 알림톡은 지금처럼 청소비서 채널 + 업체명 변수 치환. (템플릿 승인 후 별도 작업지시서 — 이번 범위 아님)
- 우선순위: 현금영수증 → 세금계산서(다음 작업지시서) → 알림톡 전환.

## 현재 코드 사실 (조사 완료)
- 사업자 정보: `TenantSignupBusiness`(bizNumber, businessName, representativeName, addressLine, businessType: registered_business|individual), `TenantPgOnboarding`(+ contactName/Phone/Email). **업태·종목 필드는 없음.**
- 브랜드: `OperatingCompany`(tenantId, name, slug, isDefault, config Json). 사업자 정보 필드 없음.
- 지갑: `TenantAlimtalkWallet`(prepaidBalanceKrw, 월 무료) + `AlimtalkWalletChargeLog` + `AlimtalkChargeRequest`. 차감 로직 `server/src/modules/alimtalk/alimtalkWallet.service.ts`.
- 접수 금액: `Inquiry.serviceTotalAmount / serviceDepositAmount / serviceBalanceAmount`, 카드결제 `Inquiry.cardPayments` (CardPayment).
- 플랜 잠금: `shared/tenantModuleVisibility.ts` `getModuleVisibility` (1인 작업에서 생성).

---

## Phase 0 — 바로빌 공통 클라이언트

**에이전트:** CodeGuardian → PlatformOps · AppScout 생략

1. `npm i soap` (server). `server/src/lib/barobill/` 에 서비스별 클라이언트(TI·CASHBILL·CORPSTATE). env: `BAROBILL_CERTKEY`, `BAROBILL_ENV`(기본 test). WSDL 은 노트의 표 사용.
2. 공통 래퍼: 타임아웃, 음수 반환 → `GetErrString` 변환, 키·개인정보 마스킹 로그.
3. `shared/barobillPolicy.ts` — 단가 상수 (**사용자 확정, VAT 포함**):
   - `CASHBILL_UNIT_PRICE_KRW = 22` (원가 11, **발행·취소 건 각각** 바로빌 11원 과금 → 우리도 발행·취소 각각 22원)
   - `TAXINVOICE_UNIT_PRICE_KRW = 150` (원가 110)
   - 사업자상태조회는 플랫폼 부담(업체 차감 없음)
4. 점검 스크립트 `server/scripts/barobill-ping.ts`: test 환경에서 `GetBalanceCostAmountOfInterOPEx`, `CheckCorpIsMember`(서비스브릿지) 호출 결과만 출력.

관문: tsc 통과 · 스크립트로 test 호출 성공 로그(키 미노출) · 클라이언트 번들에 barobill 코드 없음

## Phase 1 — 회원사 가입 (업체·브랜드별)

**에이전트:** DbSentinel → (CodeGuardian ∥ ConfigCurator ∥ DesignPulse ∥ MarketingAgency) → PlatformOps → RoleQA · AppScout 생략

1. DB (DbSentinel 설계·검토, **추가만, 파괴적 변경 금지**):
   - `BarobillMember`: tenantId, env, corpNum, corpName, ceoName, bizType, bizClass, addr1, addr2, contactName, contactTel, contactEmail, barobillUserId, taxType(사업자상태조회 결과), status(`ACTIVE` | `LINK_REQUIRED` | `FAILED`), lastError, timestamps. `@@unique([env, corpNum])`.
   - 브랜드 연결: OperatingCompany ↔ BarobillMember **1:1** (OperatingCompany 에 nullable unique FK). 브랜드 미지정 접수는 업체 기본 브랜드의 회원사.
2. 서버 흐름: 사업자번호 정규화 → `CheckCorpIsMember` → `RegistCorp`(아이디 규칙 예 `cb` + 영숫자, 6~20자, 비밀번호는 랜덤 생성 후 **저장하지 않음**) → CORPSTATE 로 과세유형 저장.
   - `-32000`(이미 바로빌 회원) → `LINK_REQUIRED` 로 저장하고 플랫폼 화면에 "콘솔에서 수동 연결 필요" 목록.
   - 개인(`individual`) 업체는 가입 버튼 비활성 + 안내.
3. 관리자 화면 「증빙 발급 설정」: 브랜드별 카드. 사업자 정보는 SignupBusiness/PgOnboarding 에서 **미리 채움**, 업태·종목·담당 이메일·전화만 입력. 상태 배지(가입완료/연결 필요/실패).
4. 플랫폼 화면: 회원사 목록(env, 업체, 브랜드, 상태, 과세유형), LINK_REQUIRED 처리완료 버튼.
5. 기능 모듈 `mod_cashbill` 추가(Standard 이상). Free 는 `getModuleVisibility` 로 🔒 「Standard부터」. **요금제 무료 제공량 없음** — Standard 이상도 청소비서 지갑을 별도 충전해서 건당 차감.

관문: 본사형·1인 기존 화면 회귀 없음 · test 환경에서 가짜 아닌 **테스트용 사업자번호**로 가입 1건 성공 · **사람 확인:** 스키마와 화면 확인 후 staging migrate 승인

## Phase 2 — 현금영수증 발급·취소

**에이전트:** CardPay → CodeGuardian ∥ DesignPulse ∥ ConfigCurator → RoleQA · AppScout 생략

1. DB: `CashBillIssue`: tenantId, memberId, inquiryId, mgtKey(@@unique([memberId, mgtKey])), kind(`DEPOSIT`|`BALANCE`|`FULL`|`CANCEL`), cancelOfId, tradeUsage(1 소득공제/2 지출증빙), identityMasked, amount, tax, serviceCharge, barobillState, ntsConfirmNum, issuedAt, chargedKrw, lastError.
2. 접수 상세에 「현금영수증」 버튼 (관리자·1인 사장). 기본 금액 = 선택한 구분(예약금/잔금/전체) − 이미 **카드결제된 금액**(CardPay 에이전트가 CardPayment 합산 규칙 확인). 이미 발급된 금액 초과 금지.
3. 입력: 소비자 휴대폰(기본=고객 연락처) 또는 사업자번호(지출증빙), 미입력 시 자진발급 010-000-1234. 거래일 **D-1까지만** 검증.
4. 금액 분리: 일반과세자 공급가액 = round(합계/1.1), 부가세 = 합계 − 공급가액. **간이과세자 처리는 바로빌 확인 전까지 발급 차단 + 안내** (BRIEF 「주의」에 남길 것).
5. 발급 `RegistAndIssueCashBill`(SMSSendYN=false). 발급 전 지갑 잔액 ≥ 22원 확인 — 부족하면 발급 막고 「청소비서 지갑 충전」 안내(기존 충전 신청 흐름 재사용). 성공 시 지갑 차감(사용 내역 기록). 실패 시 차감 없음.
6. 취소 `CancelCashBillEx`(전액). 취소거래도 새로 발급되는 건이라 **22원 차감**(잔액 확인 동일). 부분취소는 이번 범위 아님.
7. 상태 폴링 크론(`infra/happy-call-cron` 방식): 미완료 건 `GetCashBillStates` → 3000/4000/7000 은 최종 반영 후 중단. 4000(전송실패)은 관리자 알림.
8. 고객 안내: `GetCashBillMailURL` 링크를 접수 상세에서 복사 가능하게 (알림톡 발송은 다음 단계).

관문 (RoleQA)
- [ ] 카드결제 100% 접수 → 버튼 비활성
- [ ] 예약금 발급 후 잔금 발급 → 합계 초과 차단
- [ ] 같은 요청 두 번 → 중복 발급 없음(MgtKey 상태조회)
- [ ] 다른 업체 접수 ID 로 호출 → 403
- [ ] Free 업체 → 🔒 표시, API 403
- **사람 확인:** test 환경 실제 발급·취소 1건씩 결과 확인

---
## 이번 범위 밖
- 세금계산서 과세형태는 과세만으로 두지 않는다. 과세(`TaxType` 1)·영세(2)·면세(3, `TaxInvoiceType` 2 전자계산서)를 같은 `RegistAndIssueTaxInvoice`로 발행한다. 면세사업자(`GetCorpState.TaxType` 4)는 면세만, 간이과세자(2)는 발행 차단. 세 종류 모두 건당 150원. 공동인증서·이용료 시범은 기존처럼 이 지시서 범위 밖.
- 알림톡 바로빌 전환 — 템플릿 승인 후
- 입금확인 시 현금영수증 자동발급, 부분취소
