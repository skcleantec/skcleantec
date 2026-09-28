# CodeGuardian

- 공통 필드 `StaffIdCardPhotoField` — `AdminTeamLeadersPage` 비대화 방지.
- 다운로드는 `downloadRemoteImage` 한곳. CORS 실패 시 새 탭.
- `triggerRef`로 미리보기 = 썸네일 클릭과 동일.
- 업로드·삭제 API·tenant 스코프 변경 없음.
- 클라이언트 `tsc -b --noEmit` 통과.
- 팀원 화면(`AdminTeamsPage`) 정적 이미지는 그대로 (사용자 등록만 요청).
