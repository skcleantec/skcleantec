# Maestro 요약 레포트

**일시:** 2026-09-01 15:05 (KST)  
**요청:** 에이전트를 사용자가 따로 부르지 않고, 기능 만들 때 Maestro가 알아서 전부 돌리게  
**상태:** ✅ **오케스트라 규칙 전면 수정 완료**

---

## 한 줄 결론

이제 **업무만 말하면 됩니다** (`OO 기능 만들어줘`). Maestro가 코드·UI·**화면 표시·설정(ConfigCurator)**·역할 테스트 등 **필요한 에이전트를 자동 기동**합니다. ConfigCurator나 Maestro: 를 **따로 지시할 필요 없습니다**.

---

## 바뀐 점

| 이전 | 이후 |
|------|------|
| `ConfigCurator: …` 따로 호출 | UI 기능 시 Maestro가 **자동** |
| `Maestro:` 권장 | **접두어 없이** 업무 한 줄만 |
| BRIEF에 「에이전트 호출하세요」 | **금지** — Maestro가 끝까지 |

---

## 당신이 쓰는 말 (예시)

```
접수 목록에 OO 추가해줘
스케줄 전화 버튼 버그 고쳐줘
스테이징 푸시
```

---

## 수정한 파일

- `.cursor/skills/maestro-orchestrator/SKILL.md` — 자동 배치표
- `.cursor/rules/agent-orchestration.mdc`
- `docs/AGENT_ORCHESTRATION.md`
- 전 specialist Skill — 「Maestro가 자동 배치」

---

## 상세

- [자동 오케스트레이션 정책](reports/2026-09-01-1505-auto-orchestration-policy.md)
