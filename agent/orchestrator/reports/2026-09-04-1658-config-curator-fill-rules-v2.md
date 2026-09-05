# ConfigCurator — 설정 위치 v2

## 어디에 두나

| 후보 | 결정 |
|------|------|
| 발주서 발급 **안** 「설정」 버튼 → 설정 페이지 | **채택** |
| 발급 제목을 탭으로 나눔 | **채택** — 설정과 같은 줄 |
| `?tab=fillPolicy` (목록과 형제) | **폐기** |
| 발주서설정 11번째 패널 | 비채택 |
| 설정 → 화면 표시 | 비채택 |

URL: `/admin/inquiries/order-issue?issueView=settings`  
제목 탭: `?issueSection=area` (새로고침 유지)

## 권한

- 설정 **저장**: `orderform.formConfig` (관리자)
- 상담사: 발급 탭에서 규칙대로 작성. 설정은 열람만(또는 버튼 숨김)

## 도움말

발주서 발급 `?`에 「설정 — 고객·마케터·필수」 절. 끄기 토글 없음(견적 규칙).

## 레지스트리

`orderForm.issue.fillRulesSettings` — 발급 안 설정 페이지.
