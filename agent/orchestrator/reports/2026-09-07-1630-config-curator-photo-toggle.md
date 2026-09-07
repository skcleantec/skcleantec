# ConfigCurator — 사진첨부 토글 설정 위치

**레지스트리 예정 id:** `orderForm.template.section.photos`

| 항목 | 값 |
|------|-----|
| 라벨 | 고객 발주서 · 현장 사진 첨부 |
| 화면 | `admin.inquiries.order-templates` |
| 시각 | 스위치 (기본 ON) |
| 설정 경로 | `/admin/inquiries/order-templates` → 양식 선택 → 고객에게 보일 섹션 |
| 도움말 | 「끄면 고객이 사진을 올리는 칸이 없어집니다. 이미 보낸 링크도 다음에 열면 같이 적용됩니다.」 |

**넣지 말 곳**

- 발주서설정(`order-customer-preview`) — 테넌트 공통 문구·전문시공 옵션용. 사진 칸은 양식별.
- 화면 표시 허브 — 업무 양식 구성이지 색/배지 취향이 아님.
- 작성 설정 — 「누가 적나/필수인가」용. 칸 자체를 없애는 스위치와 섞지 말 것. 구현 후 도움말에 교차 안내만.

구현 시 `display-indicator-registry.json`에 위 id 등록. `userConfigurable: true`, `settingsPath`는 발주서 양식.
