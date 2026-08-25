# 재접촉 · 이모지/견적조회 — 중지 후 이어하기

> **버전:** v1.0.22+  
> **참고 구현:** `features/feature_run_queue.py`, `features/stale_chat_queue.py`

---

## 사용 방법

1. **재접촉** 또는 **이모지/견적조회** 실행
2. 잘못된 이미지·텍스트를 발견하면 **「중지」**
3. **「설정」**에서 텍스트·전송 순서·이미지 폴더 수정 후 저장 (`config.json` 동기화)
4. **「이어하기」** — 남은 채팅만 **현재 설정**으로 처리

| 기능 | 이어하기 버튼 | 큐 파일 |
|------|---------------|---------|
| 재접촉 | 재접촉 카드 | `%LOCALAPPDATA%\Cbiseo\SoomgoAutomation\recontact_queue.json` |
| 이모지/견적 | 통합 카드 | `%LOCALAPPDATA%\Cbiseo\SoomgoAutomation\combined_queue.json` |

---

## 동작 요약

- 중지 시 **미처리 채팅 목록**을 JSON 큐에 저장 (`interrupted: true`)
- **완료된 채팅**은 `done`으로 표시 — 이어하기 시 스킵
- **이모지/견적:** 당일 처리 기록(`ProcessedTracker`)도 큐에 함께 저장
- **이어하기**는 실행 시점의 **최신 GUI 설정**을 사용 (큐 생성 당시 설정 아님)
- 전체 완료 시 큐 파일 자동 삭제

---

## 주의

- **채팅방 안에서 일부만 보낸 뒤 중지**한 경우, 이미 나간 말풍선은 자동 삭제되지 않습니다. 숨고에서 수동 정리 후 이어하기하세요.
- **채팅 1건 단위** resume입니다. (전송 순서 항목 단위 resume는 추후 Phase 2)
- **기록 초기화**(통합 카드) 시 combined 큐도 함께 삭제됩니다.
- 재접촉 **수집만 하고 중지**한 경우에도 수집 목록이 큐에 저장됩니다 (구버전처럼 구 설정으로 자동 전송하지 않음).

---

## 개발 참고

| 파일 | 역할 |
|------|------|
| `features/feature_run_queue.py` | 큐 CRUD·pending·tracker 직렬화 |
| `features/recontact.py` | `run(resume=True)` |
| `features/combined_feature.py` | `run(resume=True)` + tracker 복원 |
| `main.py` | 「이어하기」 버튼·`persist_app_config()` |

---

*이모지 전송·CDP 상세: `docs/EMOJI_DEVELOPMENT.md`*
