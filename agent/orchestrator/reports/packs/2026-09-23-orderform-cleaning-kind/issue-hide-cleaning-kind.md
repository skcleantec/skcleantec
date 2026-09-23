# 발주서 발급 — 청소 종류 섹션 제거

**요청:** 발주서 발급에서는 청소 종류를 없앤다. 고객이 직접 고른다.

## 코드
- `shouldShowCustomerCleaningKindPicker(template, isStaffIssueForm)` — 발급·편집 `isEditor`면 false
- `OrderFormPage` 클래식 폼: 발급 임베드에서 섹션 미표시, 검증·선입력 payload에서 제외
- 손님 위저드·고객화면 미리보기는 그대로(처음부터 비어 있음)

## RoleQA
| 역할 | 경로 | 기대 |
|------|------|------|
| 마케터 | `/admin/inquiries/order-issue` | 청소 종류 카드 없음. 발급 가능 |
| 손님 | 발주서 링크 | 첫 화면에서 직접 고름. 입주 미체크 |
| 미리보기 | 발주서설정 iframe | 빈 피커. 제출 안 됨 |
| 관리 | 접수 상세 | 제출 후 한글 종류 표시 |

## 회귀
- 에어컨 등 비기본 양식: 종류 수집 안 함 (기존)
- 선입력 overlay는 `cleaningKind` skip 유지
