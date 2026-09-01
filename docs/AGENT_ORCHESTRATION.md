# CBISEO 에이전트 오케스트라

청소비서(CBISEO) 저장소에서 **역할별 AI 에이전트**를 Maestro가 조율합니다.  
영문 에이전트 이름 · 실행 기록 · 상세 리포트로 **무엇이 돌아갔는지** 항상 확인할 수 있습니다.

---

## 에이전트 한눈에 보기

| 영문 이름 | ID | 하는 일 |
|-----------|-----|---------|
| **Maestro** | `maestro-orchestrator` | 요청 분석 → 에이전트 배치 → 리포트·활동 로그 정리 |
| **DesignPulse** | `design-pulse` | 최신 UI 트렌드 조사 + PC·모바일·앱(WebView) 반응형 점검·적용 |
| **CodeGuardian** | `code-guardian` | 신규·수정 코드·연관 모듈·`.cursor/rules`·docs 점검, 파일 비대화 방지 |
| **RoleQA** | `role-qa` | 마케터·관리자·팀장·플랫폼 역할별 시나리오·회귀 테스트 |
| **PlatformOps** | `platform-ops` | `mod_*` 기능·테넌트별 온오프·과금·플랫폼 운영 점검 |
| **DbSentinel** | `db-sentinel` | 개인정보법·테넌트 격리·금액·현장정보 교환 안전성 |

기존 **GuideRosie**(도우미 로지)는 팀장·마케터 **가이드 문서 전용**이며, Maestro 파이프라인과 별개입니다.

---

## Cursor에서 부르는 방법

**기본:** 모든 업무 지시는 `Maestro:` 로 시작 (권장).

```
Maestro: staging 최근 변경 전체 점검해줘
Maestro: TeamSchedulePage 모바일 UI 손봐줘
Maestro: server diff 리뷰하고 팀장 테스트까지
```

개별 이름만 써도 Maestro가 개입합니다:

```
CodeGuardian: server diff 리뷰   → Maestro가 감독 + 요약 레포트
```

---

## Maestro 기본 순서

```
요청 / PR / 기능 변경
       ↓
   Maestro (분류)
       ↓
  ┌────┴────┬─────────┬──────────┐
  ▼         ▼         ▼          ▼
DesignPulse CodeGuardian RoleQA  PlatformOps
  (UI)     (코드 변경 시)  (기능 검증)  (신규 mod_* / 과금)
       │         │         │          │
       └────┬────┴────┬────┴──────────┘
            ▼         ▼
       DbSentinel (스키마·PII·연계·교환)
            ↓
     활동 로그 + 리포트 + 요약
```

- UI 작업: DesignPulse → CodeGuardian → RoleQA  
- 서버만: CodeGuardian → RoleQA  
- Prisma·연계: CodeGuardian → DbSentinel → RoleQA  
- 신규 플랫폼 기능: PlatformOps → CodeGuardian → RoleQA  

---

## 내가 상태를 보는 곳

| 파일 | 용도 |
|------|------|
| **[`agent/orchestrator/BRIEF_REPORT.md`](../agent/orchestrator/BRIEF_REPORT.md)** | **★ 요약 레포트** — Maestro가 매번 갱신 (이것만 보면 됨) |
| [`agent/orchestrator/ACTIVITY_LOG.md`](../agent/orchestrator/ACTIVITY_LOG.md) | 실행 이력 표 |
| [`agent/orchestrator/activity-log.jsonl`](../agent/orchestrator/activity-log.jsonl) | 타임라인 (기계용) |
| [`agent/orchestrator/reports/`](../agent/orchestrator/reports/) | 상세 기술 리포트 (필요할 때) |

## Maestro가 항상 관여

개별 에이전트 이름만 말해도 **Maestro가 먼저** 지시를 해석하고, 필요한 에이전트를 배치·감독한 뒤 **요약 레포트**를 줍니다.

```
CodeGuardian: diff 봐줘     → Maestro가 CodeGuardian 실행 + 필요 시 RoleQA 추가 → BRIEF_REPORT.md
Maestro: 팀 스케줄 점검     → Maestro가 에이전트 선택 → BRIEF_REPORT.md
```

---

## 사람 승인이 필요한 작업 (자동 금지)

- `main` 푸시 · 운영 Railway 변수 · Play Console 제출  
- 공유 DB `prisma migrate deploy` (명시 요청 없을 때)  
- 대량 삭제 · 운영 테넌트 프로비저닝  

에이전트는 **PR/패치 초안 + 리포트**까지이고, 배포·DB 반영은 사용자가 결정합니다.

---

## Skill·Rule 위치

```
.cursor/skills/maestro-orchestrator/SKILL.md
.cursor/skills/design-pulse/SKILL.md
.cursor/skills/code-guardian/SKILL.md
.cursor/skills/role-qa/SKILL.md
.cursor/skills/platform-ops/SKILL.md
.cursor/skills/db-sentinel/SKILL.md
.cursor/rules/agent-orchestration.mdc   ← Maestro 트리거 힌트
```

프로젝트 규칙(40+ `.mdc`)은 **CodeGuardian·DesignPulse**가 작업 영역에 맞춰 자동으로 읽습니다.

---

## Cursor Automations (선택, 다음 단계)

GitHub `staging` 푸시 · 주간 스케줄 등에 **Cloud Agent**를 연결하면 Maestro가 주기적으로 CodeGuardian만 돌리는 식으로 확장할 수 있습니다.  
Automations 설정은 Cursor 설정 → Automations에서 `Maestro: run CodeGuardian on latest staging diff` 형태로 추가합니다.

---

## 관련 문서

- 워크플로 상세: [`agent/orchestrator/ORCHESTRATOR.md`](../agent/orchestrator/ORCHESTRATOR.md)
- 멀티테넌트: `docs/MULTI_TENANT_PLATFORM.md`
- UI: `docs/UI_DESIGN_GUIDE.md`
- 테넌트 DB 교환: `docs/TENANT_DB_EXCHANGE.md`
