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
- 고객용 화면 URL: `GetCashBillMailURL`. 현금영수증 API 레퍼런스(2026-10-29)에 유효기간 문구가 없다. 공급자용 `GetCashBillPopUpURL`·`GetCashBillPrintURL` 만 「60초동안만 유효」이고, 인쇄 URL은 회원 아이디로 로그인된 화면이다. PDF 전용 API는 없다.
- 세금계산서도 같다. 거래처용은 `GetTaxinvoiceMailURL`(유효기간 문구 없음). 인쇄는 `GetTaxInvoicePrintURL`(60초, `PWD` 빈 문자열). PDF 전용 API는 없다.

## 6. 세금계산서 (TI)

### 양식 칸 ↔ 바로빌 필드 (2026-10-29)

출처는 바로빌 세금계산서 SOAP `https://ws.baroservice.com/TI.asmx?wsdl` 의 `complexType TaxInvoice` · `TaxInvoiceTradeLineItem` · `InvoiceParty`, 그리고 `RegistAndIssueTaxInvoice` 샘플(`https://testws.baroservice.com/TI.asmx?op=RegistAndIssueTaxInvoice`)이다. WSDL과 샘플은 **영문 필드명과 타입만** 있고, 양식 칸의 한글 뜻은 적혀 있지 않다. 한글 칸과 필드를 잇는 설명은 **확인 못 함**. 아래 표의 「양식 칸」은 화면 칸 이름이고, 오른쪽은 그 요청에 **실제로 있는 필드명**이다.

| 양식 칸 | 바로빌 필드 | 확인 |
| --- | --- | --- |
| 품목 줄 | `TaxInvoice.TaxInvoiceTradeLineItems.TaxInvoiceTradeLineItem` | 타입·자식 필드명 확인. 한 장 최대 줄 수는 WSDL에 상한이 없어 **확인 못 함** |
| 품목 월·일 | `PurchaseExpiry` (string) | 필드명만 확인. 월/일이라는 설명은 **확인 못 함** |
| 품목명 | `Name` (string) | 필드명만 확인. 품목명이라는 설명은 **확인 못 함** |
| 규격 | `Information` (string) | 필드명만 확인. 규격이라는 설명은 **확인 못 함** |
| 수량 | `ChargeableUnit` (string) | 필드명만 확인. 수량이라는 설명은 **확인 못 함** |
| 단가 | `UnitPrice` (string) | 필드명만 확인. 단가라는 설명은 **확인 못 함** |
| 줄 공급가액 | `Amount` (string) | 필드명만 확인. 공급가액이라는 설명은 **확인 못 함** |
| 줄 세액 | `Tax` (string) | 필드명만 확인. 세액이라는 설명은 **확인 못 함** |
| 줄 비고 | `Description` (string) | 필드명만 확인. 비고라는 설명은 **확인 못 함** |
| 공급가액 합계 | `AmountTotal` (string) | 필드명만 확인 |
| 세액 합계 | `TaxTotal` (string) | 필드명만 확인 |
| 합계금액 | `TotalAmount` (string) | 필드명만 확인 |
| 현금 | `Cash` (string) | 필드명만 확인. 현금이라는 설명은 **확인 못 함** |
| 수표 | `ChkBill` (string) | 필드명만 확인. 수표라는 설명은 **확인 못 함** |
| 어음 | `Note` (string) | 필드명만 확인. 어음이라는 설명은 **확인 못 함** |
| 외상미수금 | `Credit` (string) | 필드명만 확인. 외상미수금이라는 설명은 **확인 못 함** |
| 영수/청구 | `PurposeType` (int) | 바로빌 개발자센터 세금계산서 API `TaxInvoice` 객체: 1 영수, 2 청구 |
| 과세 구분 | `TaxType` (int) | 같은 `TaxInvoice` 객체: 1 과세, 2 영세, 3 면세 |
| 세금계산서/계산서 | `TaxInvoiceType` (int) | 같은 객체: 1 세금계산서, 2 계산서, 4 위수탁세금계산서, 5 위수탁계산서. 면세 「전자계산서」는 `TaxType` 3과 `TaxInvoiceType` 2 |
| 비고 | `Remark1` · `Remark2` · `Remark3` (string) | 필드명만 확인. 양식의 비고 한 칸이 셋 중 어느 것인지는 **확인 못 함**. 화면 비고는 `Remark1`만 보내고 나머지 둘은 빈 문자열 |
| 종사업장번호 | `InvoiceParty.TaxRegID` (string) | 공급자 `InvoicerParty` · 공급받는자 `InvoiceeParty` 양쪽에 필드명 확인. 종사업장이라는 설명은 **확인 못 함** |

- 정발급 권장 흐름: **간편발급 `RegistAndIssueTaxInvoice`** (임시저장+발급 분리 시 재처리 로직 필요).
- 과세·영세·면세 모두 이 함수다. WSDL에 전자계산서 전용 발급 함수는 없다. 면세는 같은 `Invoice`에 `TaxType=3`, `TaxInvoiceType=2`를 넣는다. 과세는 `TaxType=1`·`TaxInvoiceType=1`, 영세는 `TaxType=2`·`TaxInvoiceType=1`. 출처: [세금계산서 API 레퍼런스](https://dev.barobill.co.kr/docs/references/%EC%84%B8%EA%B8%88%EA%B3%84%EC%82%B0%EC%84%9C-API) `TaxInvoice` 객체 (2026-10-29).
- 공급자 과세유형은 사업자등록 상태조회 `GetCorpState.TaxType`이다. 이 코드가 쓰는 구버전 `CorpState`: 1 일반과세자, 2 간이과세자, 4 면세사업자. 출처: [사업자등록 상태조회 API](https://dev.barobill.co.kr/docs/references/%EC%82%AC%EC%97%85%EC%9E%90%EB%93%B1%EB%A1%9D-%EC%83%81%ED%83%9C%EC%A1%B0%ED%9A%8C-API) `CorpState` (2026-10-29). 조회 API의 `TaxType` 1은 「과세+영세」라서 발급 필드와 코드가 다르다.
- InvoicerParty.MgtNum(공급자 관리번호) · InvoicerParty.ContactID(공급자 바로빌 아이디) 필수. 공급받는자 MgtNum/ContactID 는 빈 값.
- 상태: `GetTaxInvoiceStateEX(s)` → BarobillState 1000 임시 · 3014 발급완료 · 5031 발급취소 / NTSSendState 1 전송전(취소가능) · 2·3 전송중 · 4 성공 · 5 실패.
- 발급취소(국세청 전송 전): 현재 TI WSDL의 `ProcTaxInvoice`. `ProcType=ISSUE_CANCEL`, `Memo`는 빈 문자열. 전송 후 취소 API는 쓰지 않는다.
- 국세청 전송 기본값: **발급 익일 14시 자동전송**(콘솔 환경설정). 지연발급(익월 10일 후) 기본 차단.
- 발급 시 공급받는자 이메일 자동 발송(테스트환경도 실제 발송 주의).

## 7. 결과 확인
- 웹훅 없음 → **상태조회 폴링**(완료 상태는 DB 반영 후 재조회 중단).
