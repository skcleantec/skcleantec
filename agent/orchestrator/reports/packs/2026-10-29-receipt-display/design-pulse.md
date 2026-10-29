# DesignPulse — 영수증 표시 마무리

- [x] 수정 버튼 `whitespace-nowrap` + 최소 폭. 긴 이메일은 `break-all`로 왼쪽에서 줄바꿈.
- [x] 가입완료 배지 emerald-50 / emerald-800.
- [x] 실패 0은 회색 글자. 1 이상만 빨강 밑줄 버튼.
- [x] 발급일시 KST `10.29 14:24`. 현금영수증·세금계산서, PC 표와 모바일 카드.
- [x] 휴대폰 `010-****-1234`, 사업자 `123-45-*****`. 예전 저장값도 화면에서 같은 꼴로 고침.
- [x] PC 1440: 계산서 카드 최대 640px 유지. 입력칸을 화면 폭으로 늘리지 않음.
- [x] 모바일 390: 목록은 카드. 수정 버튼은 한 줄이고 이메일만 줄바꿈. 발행·충전 시트는 이번 수정에서 건드리지 않음.
- [x] 가입완료는 요약 + 수정. 등록·발행·충전은 접힌 칸에 없음.
- [ ] 브라우저 390·1440 실측은 배포 후.

확인: `/admin/team-leaders/cashbill`, `/admin/inquiries/receipts/cashbill`, `/admin/inquiries/receipts/taxinvoice`.
