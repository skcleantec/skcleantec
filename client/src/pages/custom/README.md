# L3 커스텀 페이지 (`client/src/pages/custom/`)

업체 전용 화면은 feature `custom_{slug}_*` 가 켜져 있을 때만 라우트·GNB에 노출합니다.

## 구조

```text
pages/custom/
  README.md
  _template/          # 복사용 스켈레ton (선택)
  {slug}/             # 예: acme/AcmeReportPage.tsx
```

`App.tsx` 에서 `useHasTenantFeature('custom_…')` + lazy route 로 등록하세요.

서버 API는 `server/src/modules/custom/{slug}/` 와 `customModuleCatalog.ts` 를 참고하세요.
