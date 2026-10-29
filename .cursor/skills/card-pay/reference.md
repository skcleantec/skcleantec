# CardPay — 구현·문서 인덱스

## 벤더

- 제품명: **선샤인페이** (Sunshine Pay)
- 운영: 주식회사 원성페이먼츠
- 개발자 문서: https://wspay.net/docs/
- 수기결제 가이드(로그인 필요할 수 있음): https://wspay.net/docs/keyin
- 웹훅 가이드(로그인 필요할 수 있음): https://wspay.net/docs/webhook
- 호스티드 창(현재): https://wspay.net
- 고객센터: 1555-0985
- API: v1 · JSON · `X-API-Key` + `X-TID` · 10 req/min

## 제품 지침

- **`docs/카드결제/SYSTEM.md`** — 결정·역할·상태·금지 (단일 기준)
- `docs/카드결제/SUNSHINE_PAY.md` — 공개 스펙 스냅샷
- `docs/카드결제/WSPAY_VENDOR_QUESTIONS.md` — 벤더 확인 목록
- `.cursor/rules/card-payment-wspay.mdc`

## CBISEO 파일 (2026-09)

| 경로 | 내용 |
|------|------|
| `shared/cardPayment.ts` | 수수료 3.3%/2.6% · 상태·방식 |
| `server/src/modules/card-payment/` | 가입·키·결제·웹훅·어댑터 |
| `client/src/constants/teamCardPayment.ts` | `TEAM_CARD_PAYMENT_URL`, `openWspayHostedWindow` |
| `client/src/pages/team/TeamCardPaymentPage.tsx` | 금액 → PG 창 / 링크 |
| `client/src/pages/public/PublicCardPaymentLinkPage.tsx` | 고객 → PG 창 |
| `client/src/pages/admin/card-payment/` | 내역 · PG 가입 |
| `client/src/pages/platform/card-payment/` | 플랫폼 키·요율 |
| `client/src/pages/team/teamInquiryShared.tsx` | 상세 「카드결재」 |

카드번호 input 없음. 창 URL이 문서화되면 `wspayAdapter.ts`만 교체.

첨부 PDF/xlsx가 생기면 `docs/카드결제/`에 두고 이 표에 한 줄 추가한다.
