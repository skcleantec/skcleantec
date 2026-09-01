# CodeGuardian — 안내사항 위약 코드 자동 삽입

**일시:** 2026-09-01 18:30 KST

## 원인

- 테넌트 `infoContent`에 옛 한글 위약 문장만 있고 `{{cancellationPolicy}}` 없음
- 기본값도 `{{penaltyLine:2/1/0}}` — 브랜드 구간 일수가 다르면 빈 줄

## 수정

- `ORDER_GUIDE_CANCELLATION_DEFAULT_ITEMS` = `{{cancellationPolicy}}`
- `ensureCancellationPolicyPlaceholderInSections` — 클라 파서 + 공개 `/public-guide`
- 서버 `orderFormGuidePlaceholders` / `operatingCompanyCancellationPolicyCore` 동기화
- `npx tsc` client·server 통과

## 회귀

- 이미 `{{cancellationPolicy}}` 있으면 그대로
- 14일 예약금 등 커스텀 줄은 유지
- 알림톡·해피콜 무관
