# CodeGuardian

- 테넌트: 설정 조회·연락 수정 모두 `tenantId`와 브랜드 소유 확인. `updateMany` where에 `tenantId` + `status: ACTIVE`.
- 수정 API는 관리자만. 바로빌 가입 API를 다시 부르지 않음.
- 카드번호·비밀 없음. 인증서 비밀번호는 바로빌 창에서만.
- 목록 줄 버튼 `min-h-9` → `min-h-11`. 발행 프레임·충전 창 너비 640px.
- 서버 `tsc --noEmit`, 클라이언트 `tsc -b --noEmit` 통과.
- 스키마 변경 없음. 마이그레이션 없음.
