# DesignPulse — 세금계산서 발행 양식

- PC 1440: 이 화면은 기준서 6-1의 640px 예외. 모달이 아니라 `/admin/inquiries/receipts/taxinvoice/new` 페이지. 양식은 칸 안 밑줄 입력이고 검색칸만 별도.
- 모바일 390: 페이지. 세로 카드, 하단 고정 발행, 터치 `min-h-11`. 브라우저로 390·1440을 열어 보지는 못 함.
- 발행 후 화면은 목록으로 돌아가며 토스트. 같은 페이지에 완료 요약은 없음.
- 발행하기는 접힌 「현금·수표·어음」 밖에 있음.
- PC 경로: `/admin/inquiries/receipts/taxinvoice/new`
- 모바일 경로: 같은 주소. 1024px 미만은 카드.
