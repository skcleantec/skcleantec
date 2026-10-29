# 카드 전액 취소 순서

- 지갑: `prepaidBalanceKrw` < `supplyAmountKrw` 이면 `requestPaysisFullCancel` 을 호출하지 않는다.
- 문구: 업체가 충전금 일부를 이미 사용해 전액 취소할 수 없습니다(잔액 N원). 원성 판매자센터에서 부분 환불 후 지갑 회수를 하세요
- 결제사 성공 후 `reverseWalletCardOnce` 또는 청구 재오픈이 실패하면 상태를 `CANCELLED`로 두고 메모 `반영 확인 필요`. `APPROVED`로 되돌리지 않는다.
- 오늘 할 일 돈 처리 kind `reconcile`. 승인 버튼은 없고 입금 내역 링크만 있다.
- 1,000원 시험결제는 `ac4e3129`로 이미 staging에 포함. 이번 커밋은 취소 순서만.
- 실제 카드 승인·취소는 실행하지 않았다. staging 키는 운영과 같다.
