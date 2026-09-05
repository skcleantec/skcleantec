# CodeGuardian

설정 패널을 발급 폼과 분리했다. `issueSection`으로 칸을 가리던 분기는 제거해 발급 시 전체 양식이 다시 보인다. URL은 `?issueView=settings`만 쓰고, 옛 `issueSection`은 지운다. 클라이언트 `tsc` 통과. 서버·Prisma 변경 없음.
