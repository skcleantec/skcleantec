# L3 커스텀 모듈 (`server/src/modules/custom/`)

업체 전용 API·로직은 **feature flag** `custom_{slug}_*` 와 이 폴더에 격리합니다.

## 새 커스텀 모듈 체크리스트

1. `customModuleCatalog.ts` — slug별 `moduleId`·label 등록
2. `modules/custom/{slug}/routes.ts` — 라우트 구현 (`requireFeature('custom_…')` + tenant 스코프)
3. `custom/index.ts` — `mountCustomModuleRoutes`에 등록
4. 플랫폼 업체 상세 → 기능 모듈 탭에서 on/off
5. (선택) `client/src/pages/custom/{slug}/` — 전용 화면

## `_template/` 폴더

복사해 `{slug}/` 로 시작하는 스켈레ton입니다.

```text
custom/
  README.md
  customModuleCatalog.ts
  index.ts
  _template/
    routes.ts
  {slug}/
    routes.ts
```

## 규칙

- 분기는 `hasFeature('custom_…')` 한곳으로 모음
- 코어 테이블은 반드시 `tenantId` where
- 커스텀 모듈은 **코드 배포 + feature flag** (동적 플러그인 없음)
