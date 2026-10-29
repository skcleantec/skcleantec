# 계산서 연결 · 공동인증서

브랜치 `feat/cashbill-cert-mobile`. 기준서 4·5.

- 계산서 연결은 상태별 카드. 미가입만 입력. 가입완료는 요약과 수정. 접힘 칸 삭제.
- 공동인증서 등록은 공용 창. 계산서 연결, 세금계산서 배너, 제목 칩이 연다.
- 등록이 확인되면 새로고침 없이 배너가 사라지고 발행이 켜진다.
- 발행·충전 창은 최대 640px, 모바일은 하단 시트. 주 버튼·닫기·줄 버튼 44px.

못 한 것: 검토 중은 버튼 없음(대기만). 브라우저 1440/390 실측은 배포 후. 수정은 바로빌 재가입이 아니라 청소비서 저장만.

확인: `/admin/team-leaders/cashbill`, `/admin/inquiries/receipts/taxinvoice`, `/admin/inquiries/receipts/cashbill`.
