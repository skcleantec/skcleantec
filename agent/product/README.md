# Product Help Builder

도움말/QnA 페이지용 정적 데이터를 생성합니다.

## 입력 (에이전트 산출물)

| 파일 | 설명 |
|------|------|
| `output/captures.json` | 화면 메타 + 스크린샷 파일명 |
| `output/descriptions.json` | path 기준 summary·markdown |
| `output/assets/screenshots/*.png` | 캡처 이미지 |

## 출력 (앱에 포함)

| 파일 | 설명 |
|------|------|
| `client/public/help/data.json` | HelpPage 가 fetch |
| `client/public/help/screenshots/` | PNG 복사본 |

## 실행

```bash
cd agent/product
npm install
npm run build

# 또는 저장소 루트
npm run build:help
```

## captures.json

```json
{
  "role": "admin",
  "module": "대시보드",
  "moduleOrder": 1,
  "title": "관리자 대시보드",
  "path": "/admin/dashboard",
  "screenshotFile": "admin_대시보드_대시보드.png"
}
```

## descriptions.json

`path` 로 captures 와 병합됩니다.

```json
{
  "path": "/admin/dashboard",
  "summary": "한 줄 요약",
  "markdown": "## 화면 소개\n..."
}
```
