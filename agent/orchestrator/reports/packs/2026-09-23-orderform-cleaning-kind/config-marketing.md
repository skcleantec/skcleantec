# ConfigCurator + MarketingAgency — 청소 종류

**일시:** 2026-09-23  
**대상:** `orderform.customer.cleaningKind` · 손님 발주서 1페이지  
**PUSH-safe:** **yes** (문서만. `client/`/`server/`/`prisma` 미수정)

## 화면과 맞춘 글자 (소스 확인)

- 질문: **「어떤 청소를 원하세요?」**
- 칸: **「청소 종류」** (`청소 종류 *` 한 장 폼)
- 5종: **입주청소 · 이사청소 · 준공청소 · 거주청소 · 특수청소**
- CTA: **「확인」** (고른 뒤에만 다음)
- 색(추측 없음): 선택 `slate-900` `#0f172a` · 기본 테두리 `slate-200` `#e2e8f0`

## 이미 맞던 것

- 레지스트리 id `orderform.customer.cleaningKind` — 끄기 불가, 범례만
- `CATALOG.md` §8 · `CHANGELOG.md` 2026-09-23 항목

## 메운 빈칸

| 파일 | 조치 |
|------|------|
| `menus/inquiries.md` | §3.4 짧은 문단 + 색 표 + 접수 목록 한 줄 (발주서/서비스접수 메뉴에 기능이 없었음) |
| `CATALOG.md` §3.1 | 발주서설정 행에 청소 종류·「확인」 한 구절 |
| `catalog.json` | `orderformCleaningKind` 메뉴 + 기본 카드 `slate-200` |
| 레지스트리 notes | 화면 질문·5종 라벨·선택/기본 테두리 보강 |

**설정 토글:** 없음 (`userConfigurable: false`). 도움말 모달 신설 불필요.

## RoleQA 한 줄

마케터가 손님 링크를 열면 첫 화면에서 다섯 종류와 「확인」을 보고, 색을 파랑으로 바꿔 그리지 않으면 통과.
