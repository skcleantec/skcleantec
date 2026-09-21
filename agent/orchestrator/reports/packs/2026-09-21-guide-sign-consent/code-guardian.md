# CodeGuardian — 안내사항 서명 동의

## Scope
고객 발주서 안내 동의만. 날짜·시간대 ACK 유지. 스키마 마이그레이션 없음(consents JSON).

## Findings
- 서버는 PNG 매직·크기 검사 후 R2/저장소에 올리고 URL만 스냅샷에 남김. 클라이언트 URL 위조 불가.
- 임시저장에 서명 픽셀 없음.
- `tenantId`는 기존 token→orderForm 경로. 새 테이블 없음.
- 전자계약 `SignaturePad` 재사용. 페이지에 100줄+ 서명 UI 안 넣음.
- client/server `tsc --noEmit` 통과.

## Residual
- 저장소 미설정 시 제출 503. 현장 사진은 원래 동일.
- 브라우저 실기기 검증은 스테이징 배포 후.
