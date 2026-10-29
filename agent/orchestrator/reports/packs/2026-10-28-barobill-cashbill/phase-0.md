# Phase 0 — 바로빌 공통 클라이언트

작업 트리: `feat/barobill-cashbill` (`C:\skcleantec-wt-barobill-cashbill`). 기준 `origin/staging`. AppScout는 지시서대로 생략. Phase 2는 시작하지 않음.

## CodeGuardian

- `soap`는 서버 `package.json`에만 추가. 클라이언트 소스에 `soap`, `BAROBILL_CERTKEY`, `server/src/lib/barobill` import 없음.
- WSDL은 노트에 있는 test/prod 호스트만 사용. 기본 env는 test. 이번 작업의 ping·가입 스크립트·설정 API는 test가 아니면 거부.
- 타임아웃 20초. 음수 코드는 GetErrString을 로그용 detail로만 남기고, 화면 문구는 코드가 붙은 짧은 한국어.
- `debug.disable('soap')`로 SOAP XML에 인증키가 찍히지 않게 함. 사업자번호·전화는 로그에서 가림.
- 서버 `tsc --noEmit` 통과. 클라이언트 `tsc -b --noEmit` 통과.

## PlatformOps

- 단가는 `shared/barobillPolicy.ts`와 서버 `policy.ts`에 맞춤. 현금영수증 22원(원가 11), 세금계산서 150원(원가 110). 휴폐업 조회는 업체 차감 없음.
- 기능 모듈 `mod_cashbill`은 Phase 1에서 Standard 이상에만 넣음. Free 목록에는 없음.
- 인증키는 코드·리포트에 없음. 로컬 `.env`, Railway staging·production `clean solution` 변수 모두 `BAROBILL_CERTKEY` 없음.

## 관문

- test 호출: 키가 없어 `GetBalanceCostAmountOfInterOPEx`, `CheckCorpIsMember` 모두 호출 전에 중단. 출력은 `BAROBILL_CERTKEY 가 없습니다.` 파트너 사업자번호는 `13887*****`만 표시.
- staging DB migrate는 하지 않음.
