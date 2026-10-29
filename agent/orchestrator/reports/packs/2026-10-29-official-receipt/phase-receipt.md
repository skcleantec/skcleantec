# 공식 영수증

## CodeGuardian
- 공유는 `GetCashBillMailURL` / `GetTaxinvoiceMailURL`. 인쇄·PDF는 `GetCashBillPrintURL` / `GetTaxInvoicePrintURL` (PWD 빈 값). PDF 전용 API는 레퍼런스에 없음.
- 확인용 이미지·PDF는 바로빌 주소 실패 시에만 버튼이 나온다. 공개 화면은 공식 주소가 있으면 그쪽으로 이동하고 사본 이미지를 숨긴다.
- tenantId 로 발급 건을 찾은 뒤 바로빌을 호출한다. 스키마 변경 없음.
- `npx tsc --noEmit` (server), `npx tsc -b --noEmit` (client) 통과.

## DesignPulse
- 목록 버튼은 기존 `min-h-9` · `text-fluid-2xs`. 발행 폼 이메일 안내는 입력 아래 한 줄.
- 로그인된 화면에서 클릭 확인은 하지 못함.

## RoleQA
- 관리자: 현금영수증·세금계산서 발행 폼 이메일 안내, 목록 공유(메일 URL 복사), 인쇄·PDF(인쇄 URL). 실패 시 확인용만.
- 고객: 예전 `/receipt/토큰` 은 공식 주소가 있으면 바로빌로 이동.
- 마케터도 같은 목록. 팀장 화면에는 이 버튼이 없다.
