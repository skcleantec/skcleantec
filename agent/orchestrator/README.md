# 오케스트라 — 한 업무 = 한 팩

사용자는 업무만 말한다. 에이전트 이름을 부를 필요 없다.

## 지금 볼 것 (이 3개만)

| 파일 | 용도 |
|------|------|
| **[BRIEF_REPORT.md](BRIEF_REPORT.md)** | 방금 끝난 일의 **유일한** 사용자용 요약 (≤40줄) |
| **[ACTIVITY_LOG.md](ACTIVITY_LOG.md)** | 최근 작업 한 줄 |
| **[reports/packs/](reports/packs/)** | 이번 일의 점검 메모 (폴더 1개) |

`reports/` 루트에 날짜 파일을 더 뿌리지 않는다. 예전 파일은 히스토리로 둔다.

## 한 일이 끝나면

1. `reports/packs/YYYY-MM-DD-<slug>/` 폴더 **하나**에만 메모를 쓴다.  
   예: `app-scout.md`, `code-guardian.md`, `role-qa.md` — 해당할 때만.
2. **BRIEF_REPORT.md**를 그 일로 **덮어쓴다**.
3. ACTIVITY_LOG · activity-log.jsonl에 **한 줄** 추가.

## 배치 (내부)

- 화면·방법이 바뀌면 타 앱 조사 먼저.
- 그다음 코드 점검 · (UI면) 표시 등록 · 역할별 확인.
- 카드결제는 해당 도메인 스킬. Prisma면 테넌트 격리.

## 하지 말 것

- 같은 일을 타임스탬프만 바꿔 리포트 5~10개로 쪼개 루트에 쌓기
- 사용자에게 에이전트 이름을 부르라고 하기
- `main` 푸시·공유 DB migrate를 말 없이 하기
