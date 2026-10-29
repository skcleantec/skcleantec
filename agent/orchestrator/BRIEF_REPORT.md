# BRIEF — 세금계산서 과세 구분

- 발행 화면에 과세·영세·면세. 과세는 전자세금계산서·세액 10%. 영세는 세액 0 잠금. 면세는 전자계산서·세액 칸 숨김.
- 바로빌 확인: TaxType 1/2/3, 면세는 TaxInvoiceType 2. 같은 RegistAndIssueTaxInvoice.
- 면세사업자(GetCorpState 4)는 면세만. 간이과세자(2)는 기존 차단. 세 종류 150원.
- 목록 배지, 면세 건은 계산서. 시안과 다른 점은 채팅에 항목별.
- staging 푸시 후 health gitSha 확인.
