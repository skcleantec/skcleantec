# Maestro — 오케스트레이션 워크플로

> 사용자용: `docs/AGENT_ORCHESTRATION.md`  
> 카탈로그: `.cursor/AGENTS.md`

## 0. 원칙 — 사용자는 업무만 말한다

- 사용자: `A 기능 만들어줘` · `버그 고쳐줘` · `푸시해줘`
- **에이전트 이름·Maestro 접두어·설정 에이전트 호출을 요구하지 않는다**
- Maestro가 **자동 배치표**로 전문 에이전트 **전부** 기동

## 1. Maestro가 하는 일

1. 업무 요청 분류
2. 배치표에 따라 Skill 실행 (**ConfigCurator 포함 — UI 기능 시 필수**)
3. 결과 병합 → **`BRIEF_REPORT.md`** (한국어)
4. activity log · reports 갱신

## 2. 자동 배치표

### 신규 기능 · UI

| 에이전트 | 필수 | 할 일 |
|----------|------|--------|
| CodeGuardian | ✅ | 코드·룰·tsc |
| DesignPulse | client UI | 반응형 |
| **ConfigCurator** | client UI | registry·설정 위치·help |
| RoleQA | ✅ | 역할별 시나리오 |
| PlatformOps | mod_* 등 | 기능·과금 |
| DbSentinel | prisma/PII | 격리·마이그레이션 |

### 버그 · 리팩터

CodeGuardian + RoleQA; UI diff → ConfigCurator; server/DB → DbSentinel.

## 3. 에이전트별 책임

### ConfigCurator (신규)

- `display-indicator-registry.json` 유지
- 신 기능의 배지/색 → 설정·범례·끄기 설계
- **Maestro UI 파이프라인에 기본 포함** — 사용자 별도 지시 없음

### DesignPulse · CodeGuardian · RoleQA · PlatformOps · DbSentinel

(기존과 동일 — ORCHESTRATOR §2 legacy 상세는 각 Skill 참고)

## 4. 트리거 예시 (Maestro 내부)

| 사용자 말 | Maestro 동작 |
|-----------|--------------|
| "접수에 필터 추가" | CodeGuardian + DesignPulse + **ConfigCurator** + RoleQA |
| "server만 수정" | CodeGuardian + RoleQA (+ DbSentinel) |
| "새 mod_ 기능" | PlatformOps + CodeGuardian + ConfigCurator(if UI) + RoleQA |

## 5. GuideRosie

가이드 HTML/MD만 — Maestro 기본 파이프라인 **미포함**. 사용자가 「가이드 갱신」 요청 시.

## 6. 활동 기록

`activity-log.jsonl` · `ACTIVITY_LOG.md` · `reports/*.md`
