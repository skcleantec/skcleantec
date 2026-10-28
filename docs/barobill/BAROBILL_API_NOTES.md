# 바로빌 연동 메모 (2026-10-28 조사)

> 파트너: 주식회사 서비스브릿지 (콘솔 파트너 ID 8712). 프로그램명 "청소비서".
> **연동인증키(CERTKEY)는 이 문서·코드·클라이언트에 절대 쓰지 않는다.** Railway 환경변수만: `BAROBILL_CERTKEY`, `BAROBILL_ENV=test|prod`.
> 원문: https://dev.barobill.co.kr/docs/references/바로빌-API-레퍼런스-개요

## 1. 통신 방식
- **SOAP(WSDL)**. Node 는 `npm i soap` 권장(공식 가이드).
- 모든 API 첫 파라미터 `CERTKEY`(파트너 인증키), 둘째 `CorpNum`(회원사 사업자번호, 하이픈 없이).
- 반환: 성공 양수/문자열, **실패 음수 오류코드** → `GetErrString(CERTKEY, code)` 로 메시지.
- 테스트/운영 **DB 별도**: 회원가입·공동인증서·채널·템플릿 모두 양쪽에 따로 등록.

| 서비스 | 테스트 WSDL | 운영 WSDL |
|---|---|---|
| 세금계산서(+공통 회원 API) | https://testws.baroservice.com/TI.asmx?wsdl | https://ws.baroservice.com/TI.asmx?wsdl |
| 현금영수증 | https://testws.baroservice.com/CASHBILL.asmx?wsdl | https://ws.baroservice.com/CASHBILL.asmx?wsdl |
| 사업자등록 상태조회 | https://testws.baroservice.com/CORPSTATE.asmx?wsdl | https://ws.baroservice.com/CORPSTATE.asmx?wsdl |
| 카카오톡 | https://testws.baroservice.com/KAKAOTALK.asmx?wsdl | https://ws.baroservice.com/KAKAOTALK.asmx?wsdl |

- 테스트 가입 시 10,000원 자동 충전. 테스트 사이트 https://test.barobill.co.kr

## 2. 회원 구조
- 파트너(서비스브릿지) 1 : N 회원사(각 청소업체 사업자). 회원사 1 : N 계정(아이디).
- **파트너와 연결된 회원사만** 파트너 CERTKEY 로 API 호출 가능.
- 회원사 연결 방법: ① 콘솔 회원사 추가 ② 바로빌 사이트 연동회원 가입(가입코드) ③ **`RegistCorp` API**.
- `RegistCorp` 필수: CorpNum, CorpName, CEOName, BizType(업태), BizClass(종목), Addr1, MemberName, ID(6~20), PWD(6~20), TEL, Email. (PostNum·JuminNum 은 빈 문자열)
- **-32000 = 이미 바로빌에 가입된 사업자** → API 로 연결 불가(정책). 콘솔에서 수동 "회원사 추가" 후 `AddUserToCorp` 또는 기존 아이디 사용.
- 사업자번호·아이디는 변경 불가 → 우리 DB 에 1회 저장. PWD 를 받는 URL API 들은 "더 이상 사용되지 않음(빈 문자열)" → **비밀번호 저장 불필요**.
- `CheckCorpIsMember` 로 가입 여부 사전 확인.

## 3. 과금
- 2가지: **회원사 결제**(회원사가 각자 바로빌에 충전, `GetBaroBillURL(TOGO=CHRG)` 팝업) / **파트너 결제**(파트너가 콘솔에서 충전, 회원사 사용분이 파트너 잔액에서 차감).
- 현재 콘솔 계약정보: 모든 항목 "회원사 과금 · 바로빌 100% / 파트너 0%", 최소·최대 단가 미설정 → 수익형 마진·결제방식은 바로빌과 계약 후 반영됨.
- 파트너 잔액 `GetBalanceCostAmountOfInterOPEx`, 회원사 잔액 `GetBalanceCostAmountEx`, 단가 `GetChargeUnitCostEx`(1 세금계산서, 9 현금영수증, 15 알림톡, 51 휴폐업조회).
- 원가(VAT 포함): 세금계산서 110 · 현금영수증 11 · 알림톡 7.7 · SMS 16.5 · LMS 38.5 · 사업자상태조회 11.
- 잔액 부족 오류: -26006, -26011.

## 4. 공동인증서 (세금계산서만 필요)
- 세금계산서 발급에는 **공급자(회원사) 공동인증서**가 바로빌 서버에 등록돼 있어야 함. 현금영수증은 해당 가이드에 인증서 요구 없음.
- 등록: `GetBaroBillURL(TOGO=CERT)` → 60초 유효 URL 을 팝업으로 연다(해당 ID 로 로그인된 상태).
- 점검: `CheckCERTIsValid`, `GetCertificateExpireDate`(YYYY-MM-DD) → 만료 전 알림.
- 오류: -26001 미등록, -26002 만료, -26003 갱신·재발급으로 폐기.

## 5. 현금영수증 (CASHBILL)
- 간편: `RegistAndIssueCashBill(CERTKEY, CorpNum, UserID, Invoice: CashBillEx, SMSSendYN, MailTitle)`.
- 취소: `CancelCashBillEx`(전액, 새 "취소거래" 건 발급, CancelMgtKey 필요) / `CancelCashBillPartialEx`(부분). 임시저장·취소 상태만 `DeleteCashBill`.
- 상태: `GetCashBillState(s)` → BarobillState 1000 임시저장 · 2000 발급완료 · 2500 국세청 전송중 · **3000 전송완료** · **4000 전송실패** · 7000 취소완료(전송전).
- CashBillEx 핵심: MgtKey(≤24, 회원사 단위 고유), Franchise*(가맹점=업체 정보, FranchiseMemberID=바로빌 아이디), IdentityNum(휴대폰/사업자번호/카드번호, 자진발급 010-000-1234), TradeType N/D, TradeUsage 1 소득공제 · 2 지출증빙, TradeMethod 5 휴대폰, Amount/Tax/ServiceCharge(문자열), TradeDate(**D-1 까지만 소급**), ItemName.
- 고객용 화면 URL: `GetCashBillMailURL`.

## 6. 세금계산서 (TI)
- 정발급 권장 흐름: **간편발급 `RegistAndIssueTaxInvoice`** (임시저장+발급 분리 시 재처리 로직 필요).
- InvoicerParty.MgtNum(공급자 관리번호) · InvoicerParty.ContactID(공급자 바로빌 아이디) 필수. 공급받는자 MgtNum/ContactID 는 빈 값.
- 상태: `GetTaxInvoiceStateEX(s)` → BarobillState 1000 임시 · 3014 발급완료 · 5031 발급취소 / NTSSendState 1 전송전(취소가능) · 2·3 전송중 · 4 성공 · 5 실패.
- 국세청 전송 기본값: **발급 익일 14시 자동전송**(콘솔 환경설정). 지연발급(익월 10일 후) 기본 차단.
- 발급 시 공급받는자 이메일 자동 발송(테스트환경도 실제 발송 주의).

## 7. 결과 확인
- 웹훅 없음 → **상태조회 폴링**(완료 상태는 DB 반영 후 재조회 중단).
