# Maestro — 자동 오케스트레이션 정책 (2026-09-01)

## 사용자 요구

> 설정을 Maestro에게 따로 지시하지 않는다.  
> 「A 기능 만들어줘」하면 각 에이전트가 **본인 역할에 맞게** 해당 주제에 대해 **모두** 일한다.

## 정책 요약

1. **단일 진입:** 사용자 → 업무 언어만 (기능·버그·배포).
2. **Maestro:** 배치표로 specialist **전부** 기동; 빠짐 = 미완료.
3. **ConfigCurator:** `client/` UI 기능의 **기본 동반** — registry·설정·help.
4. **BRIEF:** 2차 에이전트 지시 **금지**; 에이전트별 결과는 **보고만**.

## 신규 기능 자동 파이프라인

```
사용자: A 기능 만들어줘
    → CodeGuardian (구현·룰·tsc)
    → DesignPulse (UI)
    → ConfigCurator (표시·설정·카탈로그·help)
    → RoleQA (마케터·관리자·팀장)
    → PlatformOps (mod_* / 과금 해당 시)
    → DbSentinel (DB/PII 해당 시)
    → BRIEF_REPORT.md
```

## 문서·Skill 반영 목록

- `maestro-orchestrator/SKILL.md` — 자동 배치표, BRIEF 금지 문구
- `agent-orchestration.mdc` — alwaysApply
- `docs/AGENT_ORCHESTRATION.md` — 사용자 한국어 가이드
- `ORCHESTRATOR.md`, `.cursor/AGENTS.md`, `registry.json`
- All 6 specialist skills — Maestro auto-invoke header

## ConfigCurator 역할 (자동)

신 기능에 배지·색 추가 시 **사용자 추가 지시 없이**:

- `display-indicator-registry.json` 등록
- 설정 위치 (로드맵 `/admin/settings/display`)
- help·범례
- RoleQA 「1분 이해」 시나리오 제안

## 아직 앱에 없는 것

**설정 → 화면 표시** UI — 다음에 `화면 표시 설정 페이지 만들어줘` 한 줄이면 Maestro가 ConfigCurator+DesignPulse+CodeGuardian으로 **자동** 구현.
