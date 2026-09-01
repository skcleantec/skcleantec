# ConfigCurator — 설정 큐레이터 에이전트 도입

**일시:** 2026-09-01 14:55 KST  
**Maestro run:** config-curator-agent-create

---

## 배경

청소비서는 기능이 많고, 접수 목록 **행 색**(미제출·입금대기 등), 스케줄 **슬롯 띠·배지**, 해피콜·DB·1건 강조 등 **시각 신호**가 코드·화면마다 흩어져 있어 신규·기존 사용자 모두 의미 파악이 어렵다.

원하는 방향:

- 필요 없는 표시는 **끄기**
- 새 기능 추가 시 **설정 위치·도움말·문제 없는지** 에이전트가 알아서 처리

---

## 해결: ConfigCurator

| 역할 | 내용 |
|------|------|
| **카탈로그** | `display-indicator-registry.json` — id, 한글 라벨, 화면, 색, 설정 가능 여부 |
| **설계** | tenant / 개인(localStorage) / 범례만 — `SETTINGS_ROADMAP.md` |
| **신규 기능** | diff에 배지 추가 → registry 등록 + help + RoleQA 체크리스트 |
| **구현 위임** | DesignPulse(UI), CodeGuardian(코드), RoleQA(마케터 이해) |

GuideRosie(가이드 문서)와 분리 — ConfigCurator는 **설정·표시 discoverability** 전담.

---

## 시드 카탈로그 (14건)

- 접수 pin tier 4종 (미제출·입금완료·입금대기·대기) — **끄기 불가**, 범례 강화
- 해피콜 overdue/pending 강조 — **토글 후보**
- 스케줄 슬롯·1건·종일·처리전·DB 배지 — **토글 후보**
- 팀 스케줄 청록 숫자 — **토글 후보**

전체: `agent/config-curator/display-indicator-registry.json`

---

## 제품 로드맵 (요약)

**목표 메뉴:** 관리자 **설정 → 화면 표시**

1. 1차: `localStorage` `cbiseo.display.v1`  
2. 2차: 업체 공통 `TenantDisplaySettings` (DB)  
3. 3차: 역할별 기본값  

**원칙:** 표시를 꺼도 **행이 목록에서 사라지지 않음** (필터와 혼동 금지).

---

## Maestro 라우팅 추가

```
Colors / badges / legends → ConfigCurator → DesignPulse → CodeGuardian → RoleQA
New list/schedule badge in PR → ConfigCurator (registry) → CodeGuardian → RoleQA
```

---

## 사용자 명령 치트시트

```
Maestro: 접수 목록·스케줄 표시 정리하고 설정 화면 설계해줘
ConfigCurator: registry에 없는 배지 더 찾아서 등록해줘
Maestro: 설정 → 화면 표시 페이지 구현해줘 (해피콜 강조만 1차)
Maestro: OO 기능 머지했는데 ConfigCurator 체크리스트 돌려줘
```

---

## 다음 작업 (미구현)

- [ ] `/admin/settings/display` UI  
- [ ] `useDisplayPreferences` 훅  
- [ ] `inquiryListPinTierStyle` 등에 prefs 적용  
- [ ] GNB 설정 메뉴 링크  

사용자가 **「Maestro: 화면 표시 설정 1차 구현」** 이라고 하면 위 순서로 진행.
