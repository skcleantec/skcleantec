export type AdminOnlyHelpStep = {
  icon: string;
  title: string;
  body: string;
};

export type AdminOnlyHelpFaq = {
  q: string;
  a: string;
};

export type AdminOnlyHelpPage = {
  path: string;
  title: string;
  intro: string;
  steps: AdminOnlyHelpStep[];
  faqs?: AdminOnlyHelpFaq[];
};

export const ADMIN_ONLY_HELP_PAGES: AdminOnlyHelpPage[] = [
  {
    path: '/admin/team-leaders/company-profile/subscription',
    title: '가입정보',
    intro: '우리 업체가 청소비서를 어떻게 쓰고 있는지 보는 화면입니다.',
    steps: [
      {
        icon: 'home',
        title: '무엇을 보나요',
        body: '이용 중인 요금제와\n지금은 쓸 수 있는 기능,\n이번 달 사용량을 한눈에 봅니다.',
      },
      {
        icon: 'check-list-3',
        title: '여기서 바꾸는 일',
        body: '요금제를 직접 바꾸지는 않습니다.\n바꾸고 싶으면 청소비서 담당자에게 말씀해 주세요.',
      },
    ],
    faqs: [
      {
        q: '기능이 안 보여요.',
        a: '이 화면의 기능 목록에 꺼져 있으면, 요금제에 없는 기능입니다. 담당자에게 확인해 주세요.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/company-profile/business',
    title: '사업자정보',
    intro: '견적서·안내에 찍히는 우리 업체 정보를 적는 곳입니다.',
    steps: [
      {
        icon: 'pencil',
        title: '무엇을 적나요',
        body: '상호, 대표자, 사업자번호, 주소, 전화를 적습니다.',
      },
      {
        icon: 'image',
        title: '직인 그림',
        body: '견적서에 찍을 도장 그림을 올리면\n견적 종이에 같이 나갑니다.',
      },
      {
        icon: 'check-list-3',
        title: '저장',
        body: '아래 「저장」을 눌러야 반영됩니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/company-profile/outbound-email',
    title: '발송이메일',
    intro: '손님에게 메일을 보낼 때 쓰는 보내는 주소를 맞추는 화면입니다.',
    steps: [
      {
        icon: 'email',
        title: '보내는 주소',
        body: '손님이 받는 메일함에 보이는\n우리 업체 메일 주소를 넣습니다.',
      },
      {
        icon: 'check-list-3',
        title: '연결 테스트',
        body: '「연결 테스트」로 먼저 보내 보고,\n되면 「저장」하세요.',
      },
    ],
    faqs: [
      {
        q: '비밀번호가 다시 안 보여요.',
        a: '보안 때문에 저장 뒤에는 다시 보여 주지 않습니다. 바꿀 때만 새로 넣으면 됩니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders',
    title: '사용자 등록',
    intro: '로그인해서 일하는 사람을 등록하는 화면입니다.\n현장 인원(팀원)은 「팀원」 메뉴에서 따로 등록합니다.',
    steps: [
      {
        icon: 'account',
        title: '탭을 고르세요',
        body: '「팀장」 — 현장에 나가 배정받는 사람\n「마케터」 — 접수·발주서를 다루는 사람\n「사무직」 — 월급만 적는 사람(로그인 없음)\n「퇴사자」 — 더 이상 안 쓰는 계정',
      },
      {
        icon: 'account-add',
        title: '새로 넣기',
        body: '동그란 「+」를 누르면 등록 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 칸마다 설명이 나옵니다.',
      },
      {
        icon: 'pencil',
        title: '고치기',
        body: '「상세·수정」에서 전화, 영업 브랜드, 사원증 사진을 넣습니다.',
      },
    ],
    faqs: [
      {
        q: '팀장과 팀원이 뭐가 달라요?',
        a: '팀장은 로그인해서 배정·현장을 봅니다. 팀원은 사람 수·휴무를 세기 위해 「팀원」 메뉴에 올립니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/operating-companies',
    title: '영업브랜드',
    intro: '한 업체 안에서 손님에게 보이는 브랜드를 여러 개 둘 때 씁니다.',
    steps: [
      {
        icon: 'folder',
        title: '브랜드 등록',
        body: '「브랜드 등록」을 누르면 새 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 칸마다 설명이 나옵니다.',
      },
      {
        icon: 'account',
        title: '사람과 연결',
        body: '팀장·마케터는 「사용자 등록」에서\n어떤 브랜드인지 지정합니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/external-companies',
    title: '타업체등록',
    intro: '우리 일을 넘겨 주는 다른 청소 업체를 등록하는 화면입니다.',
    steps: [
      {
        icon: 'account-add',
        title: '타업체 추가',
        body: '「타업체 등록」을 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 칸마다 설명이 나옵니다.',
      },
      {
        icon: 'pencil',
        title: '수정·비활성',
        body: '더 안 쓰면 「비활성」으로 두면\n배정 목록에서 빠집니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/tenant-partners',
    title: '파트너연결',
    intro: '청소비서를 쓰는 다른 업체와 손을 잡는 화면입니다.',
    steps: [
      {
        icon: 'link',
        title: '파트너 초대',
        body: '「파트너 초대」를 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 칸마다 설명이 나옵니다.',
      },
      {
        icon: 'check-list-3',
        title: '승인·거절',
        body: '상대가 보낸 요청은\n「승인」 또는 「거절」하면 됩니다.',
      },
    ],
    faqs: [
      {
        q: '연결되면 뭐가 되나요?',
        a: '접수를 넘기거나 받을 수 있고, 돈 정리는 「파트너정산」에서 봅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/e-contracts',
    title: '전자계약',
    intro: '종이 없이 서명받는 계약서를 만들고 보내는 화면입니다.',
    steps: [
      {
        icon: 'file',
        title: '새 계약서',
        body: '제목을 적고 받는 사람을 「팀장」 또는 「마케터」로 고른 뒤 「등록」합니다.',
      },
      {
        icon: 'pencil',
        title: '내용 고치기',
        body: '목록에서 계약서를 누르면 글과 칸을 고칩니다.\n먼저 「발행측(갑) 정보」를 채워 두세요.',
      },
      {
        icon: 'link',
        title: '서명 받기',
        body: '팀장은 자기 화면에서,\n마케터는 보내 준 링크로 서명합니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/external-settlement',
    title: '타업체정산',
    intro: '타업체에 넘긴 일의 수수료와 보낸 돈을 정리하는 화면입니다.',
    steps: [
      {
        icon: 'cash',
        title: '목록을 봐요',
        body: '업체마다 쌓인 금액, 보낸 금액, 남은 금액이 보입니다.',
      },
      {
        icon: 'pencil',
        title: '지급 기록',
        body: '「정산」을 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 설명이 나옵니다.',
      },
      {
        icon: 'list-3',
        title: '정산 내역',
        body: '건마다 수수료가 어떻게 잡혔는지 봅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/tenant-partner-settlement',
    title: '파트너정산',
    intro: '파트너와 주고받을 수수료를 정리하는 화면입니다.',
    steps: [
      {
        icon: 'folder',
        title: '탭을 고르세요',
        body: '「판매 (받을 금액)」 — 우리가 받을 돈\n「구매 (지급할 금액)」 — 우리가 줄 돈',
      },
      {
        icon: 'cash',
        title: '수금·지급 기록',
        body: '「입금 확인」을 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 설명이 나옵니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/payroll',
    title: '월정산표',
    intro: '한 달 치 수당·월급·손익을 탭으로 나눠 보는 화면입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '달을 고르세요',
        body: '위쪽에서 보고 싶은 달을 고른 뒤\n「새로고침」을 누릅니다.',
      },
      {
        icon: 'list-3',
        title: '탭',
        body: '「팀원」 「수입·지출」 「팀장」 「마케터」\n「사무직」 「정산」 「미정산현황」\n보고 싶은 칸을 누르면 됩니다.',
      },
      {
        icon: 'pencil',
        title: '자세히 보기',
        body: '줄을 누르면 건마다 금액을 보고 고칠 수 있습니다.',
      },
    ],
    faqs: [
      {
        q: '금액이 비어 있어요.',
        a: '그달에 끝난 일이 없거나, 「사용자 등록」에서 정산 비율을 아직 안 넣었을 수 있습니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/household-ledger',
    title: '팀장 가계부',
    intro: '팀장이 자기 돈 출납을 적은 내용을 관리자가 보는 화면입니다.',
    steps: [
      {
        icon: 'account',
        title: '팀장을 고르세요',
        body: '보고 싶은 팀장을 고르면\n그 사람의 수입·지출이 나옵니다.',
      },
      {
        icon: 'calendar',
        title: '기간',
        body: '보고 싶은 달을 맞춘 뒤 목록을 봅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/leader-stats',
    title: '팀장',
    intro: '팀장마다 한 달 동안 몇 건을 받고 끝냈는지 보는 화면입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '조회 월',
        body: '보고 싶은 달을 고른 뒤 「조회」를 누릅니다.',
      },
      {
        icon: 'list-3',
        title: '숫자 뜻',
        body: '「배정」 — 맡은 건\n「완료」 — 끝난 건\n「미완료」 — 아직 진행 중\n「취소」 — 취소된 건',
      },
    ],
  },
  {
    path: '/admin/team-leaders/team-members',
    title: '팀원',
    intro: '현장에 나가는 인원을 올리는 화면입니다.\n로그인하는 팀장은 「사용자 등록」입니다.',
    steps: [
      {
        icon: 'account-add',
        title: '팀원 넣기',
        body: '「팀원 등록」을 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 칸마다 설명이 나옵니다.',
      },
      {
        icon: 'calendar',
        title: '휴무',
        body: '「휴무일」을 누르면 달력 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 설명이 나옵니다.',
      },
      {
        icon: 'folder',
        title: '크루 그룹',
        body: '「새 그룹」을 누르면 창이 열립니다.\n그 창 제목 옆 ? 를 누르면 설명이 나옵니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/holiday-calendar',
    title: '휴일캘린더',
    intro: '누가 언제 쉬는지 달력으로 보는 화면입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '색',
        body: '노란 칸 — 팀장 휴무\n하늘색 칸 — 팀원 휴무\n분홍 칸 — 공휴일(참고)',
      },
      {
        icon: 'pencil',
        title: '날짜를 누르면',
        body: '그날 쉬는 사람 이름이 나옵니다.\n휴무를 새로 넣는 곳은 「팀원」 또는 팀장 화면입니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/page-settings',
    title: '페이지설정',
    intro: '접수가 들어올 때 위쪽에 뜨는 축하 문구를 이 컴퓨터에만 저장합니다.',
    steps: [
      {
        icon: 'pencil',
        title: '문구 두 가지',
        body: '발주서로 들어온 경우 / 그 외 접수.\n칸에 적고 「저장」하세요.',
      },
      {
        icon: 'check-list-3',
        title: '테스트 표시',
        body: '「테스트 표시」로 미리 보고,\n「기본값으로 되돌리기」로 처음 문구로 돌립니다.',
      },
    ],
    faqs: [
      {
        q: '다른 컴퓨터에도 같나요?',
        a: '이 컴퓨터·이 브라우저에만 저장됩니다. 다른 자리에서는 다시 적어 주세요.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/staff-access',
    title: '직원권한',
    intro: '마케터에게 관리 메뉴를 얼마나 보여줄지 설명하는 화면입니다.\n실제 설정은 「사용자 등록」의 「마케터」 탭에서 합니다.',
    steps: [
      {
        icon: 'account',
        title: '단계',
        body: '「없음」 — 접수·발주만\n「일부」 — 배정·삭제 등 일부 관리\n「전체」 — 관리자 업무 메뉴까지',
      },
      {
        icon: 'pencil',
        title: '바꾸는 곳',
        body: '「사용자 등록 · 마케터 탭으로 이동」을 누른 뒤\n그 사람 「상세·수정」에서 「관리자 권한」을 고릅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/operating-policy',
    title: '브랜드정책',
    intro: '여러 영업 브랜드가 있을 때, 배정과 목록을 어떻게 나눌지 정하는 화면입니다.',
    steps: [
      {
        icon: 'cog',
        title: '고르는 항목',
        body: '배정을 브랜드에 맞출지,\n마케터가 볼 팀장 범위,\n새 접수의 기본 브랜드를 정합니다.',
      },
      {
        icon: 'check-list-3',
        title: '저장',
        body: '바꾼 뒤 「저장」해야 다음 배정부터 적용됩니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/notification-policy',
    title: '알림설정',
    intro: '휴대폰 앱으로 오는 알림을 켜고 끄는 화면입니다.',
    steps: [
      {
        icon: 'bell',
        title: '알림 사용',
        body: '종류마다 「알림 사용」을 켜면 그 알림이 갑니다.',
      },
      {
        icon: 'cog',
        title: '팀장 필수',
        body: '켜면 팀장이 앱에서 그 알림을 끌 수 없습니다.',
      },
      {
        icon: 'check-list-3',
        title: '저장',
        body: '아래 「저장」을 눌러야 적용됩니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/alimtalk',
    title: '알림톡',
    intro: '카카오 알림톡을 얼마나 쓸 수 있는지 보고, 어떤 알림을 보낼지 정하는 화면입니다.',
    steps: [
      {
        icon: 'home',
        title: '이용 현황',
        body: '이번 달 무료 건수와 남은 건수,\n충전해 둔 잔액이 보입니다.',
      },
      {
        icon: 'cash',
        title: '충전 신청',
        body: '건수가 부족하면 「충전 신청」을 합니다.',
      },
      {
        icon: 'bell',
        title: '알림톡 종류',
        body: '보내고 싶지 않은 종류만 끄세요.\n끈 것은 자동·수동 모두 안 갑니다.',
      },
      {
        icon: 'check-list-3',
        title: '설정 저장',
        body: '바꾼 뒤 「설정 저장」을 누릅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/inspection-template',
    title: '검수템플릿',
    intro: '팀장이 현장에서 체크하는 항목을 만드는 화면입니다.',
    steps: [
      {
        icon: 'folder',
        title: '공간을 고르세요',
        body: '왼쪽에서 현관·주방처럼 공간을 고릅니다.',
      },
      {
        icon: 'pencil',
        title: '항목 고치기',
        body: '항목을 더하거나 이름을 바꾸고 순서를 옮깁니다.',
      },
      {
        icon: 'check-list-3',
        title: '저장',
        body: '「저장」한 뒤부터 새로 여는 검수에 반영됩니다.\n「기본값으로 되돌리기」는 처음 목록으로 돌아갑니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/team-leader-training',
    title: '팀장교육자료',
    intro: '팀장에게 보여 줄 교육 자료를 올리는 화면입니다.',
    steps: [
      {
        icon: 'file',
        title: '자료 올리기',
        body: '파일(주로 PDF)을 올리면 팀장 화면에서 볼 수 있습니다.',
      },
      {
        icon: 'trash',
        title: '빼기',
        body: '더 안 쓰는 자료는 목록에서 지웁니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/inquiry-trash',
    title: '휴지통',
    intro: '지운 접수가 잠깐 머무는 곳입니다.\n30일이 지나면 완전히 사라집니다.',
    steps: [
      {
        icon: 'list-3',
        title: '목록',
        body: '휴지통에 있는 접수 이름과 날짜가 보입니다.',
      },
      {
        icon: 'check-list-3',
        title: '복구',
        body: '「복구」를 누르면 다시 접수 목록으로 돌아갑니다.',
      },
      {
        icon: 'trash',
        title: '영구 삭제',
        body: '「영구 삭제」는 바로 없앱니다.\n비밀번호를 한 번 더 묻습니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/change-history',
    title: '변경 이력',
    intro: '접수에서 누가 무엇을 바꿨는지 모아 보는 화면입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '기록일',
        body: '보고 싶은 날짜 구간을 고릅니다.',
      },
      {
        icon: 'pencil',
        title: '검색',
        body: '손님 이름이나 접수번호로 찾을 수 있습니다.',
      },
      {
        icon: 'list-3',
        title: '자세히',
        body: '줄을 누르면 바뀐 내용을 자세히 봅니다.',
      },
    ],
  },
  {
    path: '/admin/team-leaders/inquiry-delete',
    title: '접수 삭제',
    intro: '하루 또는 한 달 접수를 한꺼번에 휴지통으로 보내는 화면입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '날짜를 고르세요',
        body: '지울 날 또는 달을 고릅니다.',
      },
      {
        icon: 'alert-circle',
        title: '비밀번호',
        body: '실수 방지를 위해 내 비밀번호를 한 번 더 넣습니다.',
      },
      {
        icon: 'trash',
        title: '휴지통으로',
        body: '바로 영원히 지워지지 않고 휴지통으로 갑니다.\n살리고 싶으면 「휴지통」에서 「복구」하세요.',
      },
    ],
  },
];

export function resolveAdminOnlyHelpPage(pathname: string): AdminOnlyHelpPage {
  const path = pathname.split('?')[0] ?? pathname;
  const exact = ADMIN_ONLY_HELP_PAGES.find((p) => p.path === path);
  if (exact) return exact;
  const prefixed = ADMIN_ONLY_HELP_PAGES.filter((p) => path.startsWith(`${p.path}/`)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return prefixed ?? ADMIN_ONLY_HELP_PAGES.find((p) => p.path === '/admin/team-leaders')!;
}
