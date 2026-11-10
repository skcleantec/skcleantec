# BRIEF — 플랫폼·업체 영수증 공용 양식 · 거래처

- 세금계산서/현금영수증: 발행 주체 어댑터로 업체·플랫폼 동일 양식.
- `tax_invoice_buyers` 추가, 업체·플랫폼 격리 CRUD + 피커·발행 시 저장.
- 플랫폼 mail-url + 목록 ReceiptRowMenu(보기/사본/취소).
- 확인: client tsc · server build · migrate deploy 완료. staging→main 푸시.
