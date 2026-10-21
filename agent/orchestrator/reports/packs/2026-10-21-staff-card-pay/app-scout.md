# AppScout — 접수에서 관리자·마케터가 카드결재를 연다

## 추천 방법
1. 접수 상세 아래 버튼 하나로 결제 화면을 연다. 새 메뉴는 만들지 않는다.
2. 결제 화면은 금액이 먼저 보이고, 수기결재와 인증결재 중 고른다.
3. 가맹이 없으면 결제 폼 대신 짧은 안내만 보여 준다.

## 타 앱 작동방식
| 앱·출처 | 최신 흐름 | 우리에게 쓸 점 |
|---------|-----------|----------------|
| Jobber (2026-07) | 견적·인보이스에서 Collect Deposit / Collect Invoice | 접수 안에서 결제를 연다 |
| Housecall Pro (2026-07) | Job Details의 PAY로 금액·수단을 고른 뒤 카드 또는 청구서 발송 | 현장 수금과 손님 결제 링크를 한 자리에서 고른다 |

## 모바일 인기 디자인 레퍼런스
| 순위 | 출처 URL | 왜 인기인가 | 가져올 패턴 |
|------|----------|-------------|-------------|
| 1 | https://help.getjobber.com/en/articles/collecting-card-payments-in-the-field-using-jobber-payments-with-the-jobber-app/ | 현장 서비스 앱의 현재 매뉴얼 | 일 상세 → 결제 |
| 2 | https://mobbin.com/explore/mobile/screens/payment-method | 실제 앱 결제 화면 모음 | 큰 버튼 두 개, 금액은 위 |

## 하지 말 것
- 마케터 상단 메뉴에 카드결재를 추가하지 않는다.
- 결재 목록·삭제·PG 설정을 접수 화면에 붙이지 않는다.

## DesignPulse / 구현에 넘길 한 줄
접수 수정 아래 검은 버튼 하나, 새 창은 기존 수기·인증 화면을 그대로 쓴다.
