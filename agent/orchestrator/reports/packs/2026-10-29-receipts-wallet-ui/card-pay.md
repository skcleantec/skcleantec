# CardPay

공개 문서 https://wspay.net/docs/ 를 열었다. 키인 `POST /api/v1/keyin/pay.php`와 웹훅이 있다. 하위 필드 문서는 이 페이지에 없다.

이번 충전은 그 키인을 새로 만들지 않는다. 기존 `openTenantWalletWindow` → 결제창 URL이다. 카드번호는 우리 화면에 없다.

1,000원 칩은 `GET` 지갑 요약의 `testAmountEnabled`가 true일 때만 그린다. 서버는 `PAYMENT_TEST_AMOUNT_ENABLED=true`가 아니면 1,000원 카드·무통장 요청을 거절한다. 문구: 「1,000원 시험결제는 이 환경에서 사용할 수 없습니다.」

실결제는 하지 않았다. staging 키는 운영과 같은 실제 키다.
