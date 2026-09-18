# 2026-09-18 일반 등록 · 청소할 에어컨

스테이징 실검 P1 두 가지를 로컬에서 맞춤.

1. `AdminListIntakeModal`이 `inquiryFormHasSystemField`로 평수·구조·희망날짜를 가림.
2. `InquiryEditCustomAnswersSection`에서 `ac_units`를 `OrderFormAcUnitsField`로 편집.

부재·보류 건은 커스텀 JSON을 못 넣음. 입금대기·입금완료로 접수 만들 때만 에어컨 대수 저장.
