# 2026-10-29 세금계산서 과세 구분

바로빌 개발자센터(2026-10-29) TaxInvoice: TaxType 1 과세, 2 영세, 3 면세. TaxInvoiceType 1 세금계산서, 2 계산서. 발급은 RegistAndIssueTaxInvoice 하나. GetCorpState TaxType 4가 면세사업자, 2가 간이과세자.

시안 스크립트와 같게 제목·세액·합계를 바꾸고, 목록 배지와 면세 계산서 표기를 더했다. 640px 표 예외(종이 양식 min-w 1000px)는 이전 발행 화면과 같다.
