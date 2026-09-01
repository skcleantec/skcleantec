# CBISEO 에이전트 오케스트라

청소비서(CBISEO)에서 **Maestro**가 업무 지시 하나에 맞춰 **전문 에이전트를 알아서** 돌립니다.  
사용자는 **기능·버그·배포**만 말하면 됩니다. 에이전트 이름을 외울 필요 없습니다.

---

## 사용자 — 이렇게만 말하면 됩니다

```
접수 목록에 OO 필터 추가해줘
스케줄에서 전화 버튼 버그 고쳐줘
해피콜 알림 cron 점검해줘
스테이징 푸시
```

`Maestro:` · `ConfigCurator:` · `DesignPulse:` **붙일 필요 없음** — Cursor가 Maestro 규칙으로 자동 분류합니다.

---

## Maestro가 알아서 하는 일

| 당신이 말한 것 | Maestro가 기동하는 에이전트 (예) |
|----------------|-----------------------------------|
| **새 기능·화면** | 코드 점검 + UI + **화면 표시·설정** + 역할별 테스트 (+ DB/플랫폼 해당 시) |
| **버그 수정** | 코드 점검 + 회귀 테스트 (+ UI 바꿨으면 표시·설정 점검) |
| **DB·연계 변경** | 코드 + 개인정보·테넌트 격리 + 테스트 |
| **mod_*·과금** | 플랫폼 운영 + 코드 + 테스트 |

### 전문 에이전트 (이름 몰라도 됨)

| 이름 | 하는 일 |
|------|---------|
| **CodeGuardian** | 코드·룰·연관 파일·타입 검사 |
| **DesignPulse** | PC·모바일 UI |
| **ConfigCurator** | 행 색·배지·아이콘 **카탈로그**, 어디서 켜고 끄는지, 신 기능 표시·도움말 |
| **RoleQA** | 마케터·관리자·팀장 시나리오 |
| **PlatformOps** | 테넌트 기능·과금 |
| **DbSentinel** | DB·개인정보·연계 |

**새 기능을 만들 때** ConfigCurator는 Maestro가 **자동** 실행합니다 — 「설정도 해줘」라고 따로 말하지 않아도, 배지·색이 생기면 registry·설정 위치·문제 없는지까지 처리합니다.

---

## 흐름

```
「A 기능 만들어줘」(업무 한 줄)
        ↓
    Maestro (분류·배치)
        ↓
  ┌─────┴─────┬──────────┬────────────┐
  ▼           ▼          ▼            ▼
코드·UI·표시·설정·역할 테스트·(DB·플랫폼)
        ↓
  BRIEF_REPORT.md (한국어 요약)
```

---

## 결과 보는 곳

| 파일 | 용도 |
|------|------|
| **[`agent/orchestrator/BRIEF_REPORT.md`](../agent/orchestrator/BRIEF_REPORT.md)** | **★ 요약** — 에이전트별 한 줄 포함 |
| [`agent/orchestrator/reports/`](../agent/orchestrator/reports/) | 상세 (필요할 때) |

---

## 사람 승인 (자동 금지)

- `main` 푸시 · 공유 DB migrate · 운영 secret · 대량 삭제

---

## ConfigCurator 카탈로그 (에이전트가 유지)

| 파일 | 용도 |
|------|------|
| `agent/config-curator/display-indicator-registry.json` | 색·배지 목록 |
| `agent/config-curator/SETTINGS_ROADMAP.md` | **설정 → 화면 표시** 로드맵 |

---

## GuideRosie (별도)

팀장·마케터 **가이드 HTML/MD** 전용 — 「가이드 최신화」라고 할 때만.

---

## 관련

- [`agent/orchestrator/ORCHESTRATOR.md`](../agent/orchestrator/ORCHESTRATOR.md)
- `.cursor/skills/maestro-orchestrator/SKILL.md`
