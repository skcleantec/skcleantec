# RoleQA — 1인 사장 본인 변경 푸시

코드 추적. 실기기 FCM은 보내지 않음.

## 1인 사장이 직접 일정 변경

관리자 접수 수정은 `actorId`가 그 관리자고, 배정이 없으면 `affectedTeamLeaderIds`가 비어 `resolveFieldOwnerIds`로 간다. `omitSoloActor`가 1인 업체에서만 그 `actorId`를 뺀다. 사장이 유일한 관리자면 수신자가 없어 휴대폰 푸시가 나가지 않는다.

## 고객 발주서 수정 또는 다른 관리자

발주서 제출 알림은 `actorId`를 넘기지 않는다. `omitSoloActor`는 그때 목록을 그대로 두므로 사장에게 푸시가 간다. 다른 관리자가 고치면 그 사람의 id만 빠지고 사장 id는 남는다.

## 본사 (배정 ON)

`isSoloOperatorTenant`가 아니면 `omitSoloActor`는 목록을 바꾸지 않는다. 배정이 있으면 `affectedTeamLeaderIds` 분기만 타고, 그 분기는 이 필터를 호출하지 않는다.
