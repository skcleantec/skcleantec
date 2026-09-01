# Maestro — 오케스트레이션 워크플로

> 사용자용 개요: `docs/AGENT_ORCHESTRATION.md`  
> 영문 카탈로그: `.cursor/AGENTS.md`

## 1. Maestro가 하는 일

1. 사용자 요청·PR·변경 파일을 보고 **어떤 에이전트를 켤지** 결정
2. 각 Skill(`.cursor/skills/*/SKILL.md`) 지침대로 실행
3. 결과를 **하나의 요약**으로 합침
4. `ACTIVITY_LOG.md` · `activity-log.jsonl` · `reports/*.md` 갱신
5. **`BRIEF_REPORT.md` 덮어쓰기** — 사용자용 한국어 요약 (최우선 산출물)

## 2. 에이전트별 책임 (요청사항 매핑)

### DesignPulse

- 최신 SaaS UI 패턴 **웹 검색** 후 CBISEO 토큰에 맞게 적용 제안
- **PC / 모바일 / 팀 컴팩트 / 앱 WebView** 구분 점검
- `docs/UI_DESIGN_GUIDE.md` + responsive·team-mobile 룰 준수

### CodeGuardian

- **신규·수정** 코드 + **연관 파일** 전수 추적
- 해당 모듈 **docs·`.cursor/rules`·MD** 읽고 적용 여부 판단
- `pages/*.tsx` 비대화·한 파일 쏠림 방지
- `tsc` 등 검증 실행

### RoleQA

- **마케터·관리자·팀장·플랫폼** 역할별 시나리오
- 기능 **확대 해석** — 인접 화면·URL 새로고침·WS·회귀
- 버그 재현 단계·우선순위 정리

### PlatformOps

- `shared/tenantFeatureModules.ts` · `requireFeature` · 플랫폼 UI
- 테넌트별 **기능 온오프·사용량·과금** 운영 가능 여부
- 신규 기능 시 카탈로그·PLAN·GNB 체크리스트

### DbSentinel

- **개인정보보호법 등** 웹 검색 기반 모니터링 (법률 자문 아님 — 갭 리포트)
- `tenantId` 격리·연계·mirror·금액 필드 교환
- 마이그레이션 안전 (`migrate` only on shared DB)

## 3. 트리거 예시

| 사용자 말 | Maestro 동작 |
|-----------|--------------|
| "UI만 손봤어" | DesignPulse → CodeGuardian |
| "server PR 리뷰" | CodeGuardian (+ DbSentinel if prisma) |
| "새 mod_ 기능" | PlatformOps → CodeGuardian → RoleQA |
| "출시 전 전체" | 5종 (DbSentinel은 server/prisma 있을 때) |

## 4. 활동 기록 형식

**JSONL** (`activity-log.jsonl`) — 한 실행 한 줄:

```json
{
  "ts": "2026-09-01T14:30:00+09:00",
  "orchestrator": "Maestro",
  "agents": ["code-guardian", "role-qa"],
  "status": "completed",
  "summary": "No blockers; 2 medium RoleQA follow-ups",
  "reportPath": "agent/orchestrator/reports/2026-09-01-1430-code-guardian-happy-call.md",
  "userRequest": "…"
}
```

**ACTIVITY_LOG.md** — 표로 마지막 상태 유지 (사람이 읽기 쉬움).

## 5. GuideRosie와의 관계

- `agent/GUIDE_AGENT.md` / `CLAUDE.md` — **가이드 HTML·MD만** 수정
- Maestro 파이프라인에 **기본 포함하지 않음**
- 사용자가 "가이드 최신화"라고 하면 GuideRosie, "코드+테스트"면 Maestro
