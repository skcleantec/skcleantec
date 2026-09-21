# CodeGuardian — 발주서 연결 점검

범위: 발급·목록·접수수정·팀장·손님 링크·미리보기

## 잘 된 점
- 발급 `templateId` → `resolveIssueTemplate` (테넌트+PUBLISHED). 잘못된 양식 400.
- 목록 `token: excludeDesignerPreviewTokens`. 미리보기 행이 업무 목록에 안 섞임.
- `previewTemplateId`는 디자이너 토큰만. 손님 링크에 미리보기 쿼리 안 붙음.
- 접수 상세·팀장 `attachIntakeFormProfiles` — 발주서 `templateId` 우선.
- 접수수정 커스텀 칸 → `syncOrderFormCustomAnswersFromInquiryPatch` tenantId.
- PATCH 후 `notifyAfterInquiryPatch`.

## 판정
| 항목 | 등급 |
|------|------|
| 테넌트 격리 | OK |
| 손님/미리보기 분리 | OK |
| 양식→접수→팀장 | OK |
| 목록에 프로필 미부착 | MEDIUM — 카드는 스냅샷, 상세는 프로필 |
| 목록에 양식명 없음 | MEDIUM — API/UI에 template 열 없음. 발급·손님 링크는 정상 |
| 사용함 양식 0개 | MEDIUM — 경고만 하고 레거시(칸 없는) 발급이 될 수 있음 |
| 미리보기 DRAFT 허용 | LOW — 실제 발급은 PUBLISHED만 |
| 에어컨 칸 덮어쓰기 | 고침 — 없는 칸만 보강, 업체가 고친 라벨·순서는 유지 |
| 접수수정 양면 | OK — 스케줄·목록 풀 수정은 같은 창 |
| 팀장 희망시각 상세 | MEDIUM — 양식 off여도 일정 줄에 표시 |
| 커스텀 칸만 PATCH | MEDIUM — 변경이력·WS 없음. 열린 상세는 목록만 갱신 |

tsc: client/server 최근 통과. Prisma 추가 컬럼은 이미 migrate됨.
