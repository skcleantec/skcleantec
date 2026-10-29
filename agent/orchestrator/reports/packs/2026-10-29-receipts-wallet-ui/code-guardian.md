# CodeGuardian

- 목록 월 요약은 현재 페이지가 아니라 서버 `summary`다.
- 현금영수증 내부 메모는 `cash_bill_issues.internal_memo`. 세금계산서는 기존 `internal_memo`.
- 1,000원은 `validateWalletChargeAmountKrw`가 카드 창과 무통장 신청 둘 다에서 거절한다. 플랫폼 이용료 연결 시험 창은 그대로다.
- 충전 창은 기존 결제창 URL만 연다. 카드번호 입력칸을 추가하지 않았다.
- 테넌트 조건은 기존 지갑·영수증 조회를 그대로 쓴다.
