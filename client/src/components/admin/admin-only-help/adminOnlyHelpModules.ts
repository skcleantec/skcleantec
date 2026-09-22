import type { AdminOnlyHelpPage } from './adminOnlyHelpContent';

/** 버튼으로 열린 등록·수정 창 도움말 */
export const ADMIN_ONLY_HELP_MODULES: Record<string, AdminOnlyHelpPage> = {
  'operating-company-create': {
    path: '/admin/team-leaders/operating-companies',
    title: '브랜드 등록',
    intro: '손님에게 보이는 브랜드를 하나 더 만드는 창입니다.\n적고 「등록」을 누르면 목록에 생깁니다.',
    steps: [
      {
        icon: 'pencil',
        title: '표시명',
        body: '우리끼리 부르는 브랜드 이름입니다.\n예: 타나클린',
      },
      {
        icon: 'file',
        title: '영문 표시명',
        body: '영문·숫자로 된 짧은 이름입니다.\n보통 표시명을 적으면 자동으로 채워집니다.',
      },
      {
        icon: 'account',
        title: '고객 화면 표시명',
        body: '손님이 발주서에서 보는 이름입니다.\n비워 두면 표시명이 나갑니다.',
      },
      {
        icon: 'check-list-3',
        title: '접수번호 접두 · 발주서 부제',
        body: '접두는 접수번호 앞에 붙는 글자입니다.\n부제는 발주서 제목 아래 작은 글씨입니다. 없어도 됩니다.',
      },
      {
        icon: 'image',
        title: '브랜드 표시 색상',
        body: '접수·스케줄에 붙는 배지 색입니다.\n고르면 미리보기가 보입니다.',
      },
      {
        icon: 'home',
        title: '사업자 칸',
        body: '이 브랜드만 다른 상호·도장을 쓸 때 적습니다.\n비워 두면 업체의 「사업자정보」를 씁니다.',
      },
      {
        icon: 'link',
        title: '텔레CRM · 숨고 연동',
        body: '이 브랜드로 숨고에 들어갈 아이디·비밀번호입니다.\n안 쓰면 비워 두세요.',
      },
    ],
    faqs: [
      {
        q: '타업체 등록이랑 뭐가 달라요?',
        a: '여기는 우리 회사 안의 브랜드입니다. 다른 청소 업체는 「타업체등록」에서 넣습니다.',
      },
    ],
  },
  'operating-company-edit': {
    path: '/admin/team-leaders/operating-companies',
    title: '브랜드 수정',
    intro: '이미 있는 브랜드를 고치는 창입니다.\n위 탭을 바꿔 가며 적고 「저장」하세요.',
    steps: [
      {
        icon: 'folder',
        title: '기본정보',
        body: '이름, 손님에게 보이는 이름, 색, 사업자를 고칩니다.',
      },
      {
        icon: 'link',
        title: '숨고',
        body: '이 브랜드 숨고 아이디·비밀번호를 넣거나 바꿉니다.\n「이 브랜드 숨고 연동 사용」을 켜야 쓰입니다.',
      },
      {
        icon: 'alert-circle',
        title: '위약금',
        body: '「위약금 정책 사용」을 켜면,\n청소일 며칠 전까지 위약 없이 바꿀 수 있는지 정합니다.',
      },
    ],
    faqs: [
      {
        q: '기본 브랜드는 영문 표시명을 못 바꿔요.',
        a: '처음 만든 기본 브랜드는 영문 표시명을 고정합니다. 다른 칸은 고칠 수 있습니다.',
      },
    ],
  },
  'user-create-team': {
    path: '/admin/team-leaders',
    title: '팀장 등록',
    intro: '현장에 나가 배정을 받는 사람을 새로 넣는 창입니다.',
    steps: [
      {
        icon: 'account-add',
        title: '필수',
        body: '아이디·비밀번호·이름을 적습니다.\n아이디로 로그인합니다.',
      },
      {
        icon: 'folder',
        title: '영업 브랜드 · 권역',
        body: '이 팀장이 어느 브랜드·어느 지역을 맡는지 고릅니다.',
      },
      {
        icon: 'check-list-3',
        title: '정산',
        body: '일반 정산과 추가결재 회사 몫은 접수 정산에 반영됩니다.\n월 고정 급여는 아래 「참고」에 선택으로 적습니다.',
      },
    ],
  },
  'user-create-marketer': {
    path: '/admin/team-leaders',
    title: '마케터 등록',
    intro: '접수·발주서를 다루는 사람을 새로 넣는 창입니다.',
    steps: [
      {
        icon: 'account-add',
        title: '필수',
        body: '아이디·비밀번호·이름을 적습니다.',
      },
      {
        icon: 'folder',
        title: '영업 브랜드',
        body: '이 마케터가 쓰는 브랜드를 고릅니다.',
      },
      {
        icon: 'calendar',
        title: '월급 · 급여일',
        body: '적어도 되고, 안 적어도 됩니다.\n적으면 월정산표 「마케터」에 보입니다.',
      },
    ],
  },
  'user-create-office': {
    path: '/admin/team-leaders',
    title: '사무직 등록',
    intro: '월급만 적는 사람을 넣는 창입니다.\n이 사람은 업무 로그인을 하지 않습니다.',
    steps: [
      {
        icon: 'account-add',
        title: '필수',
        body: '아이디·비밀번호·이름을 적습니다.\n정산 장부에 이름을 남기기 위한 것입니다.',
      },
      {
        icon: 'calendar',
        title: '월급 · 급여일',
        body: '적으면 월정산표 「사무직」에 보입니다.',
      },
    ],
  },
  'user-edit': {
    path: '/admin/team-leaders',
    title: '사용자 수정',
    intro: '이미 있는 사람의 정보를 고치는 창입니다.',
    steps: [
      {
        icon: 'pencil',
        title: '기본',
        body: '아이디·이름·전화를 고칩니다.\n비밀번호는 바꿀 때만 새로 적습니다.',
      },
      {
        icon: 'folder',
        title: '브랜드 · 권역',
        body: '팀장·마케터는 영업 브랜드와 권역을 바꿀 수 있습니다.',
      },
      {
        icon: 'image',
        title: '사원증 사진',
        body: '사진을 올리면 사원증에 쓰입니다.',
      },
      {
        icon: 'file',
        title: '로그인 안내 복사',
        body: '오른쪽 「로그인 안내 복사」로\n앱 설치·로그인 글을 카톡에 보낼 수 있습니다.',
      },
    ],
  },
  'household-deposit-policy': {
    path: '/admin/team-leaders',
    title: '가계부 · 예약금 정책',
    intro: '팀장 가계부에 예약금을 넣을지 정하는 창입니다.',
    steps: [
      {
        icon: 'check-list-3',
        title: '회사 수입 (기본)',
        body: '예약금은 가계부 수입에서 뺍니다.\n잔금·추가결재만 들어갑니다.',
      },
      {
        icon: 'account',
        title: '팀 수입',
        body: '예약금도 가계부 수입에 넣습니다.',
      },
    ],
  },
  'login-credentials-copy': {
    path: '/admin/team-leaders',
    title: '로그인 안내',
    intro: '상대에게 보낼 로그인 글을 모은 창입니다.',
    steps: [
      {
        icon: 'file',
        title: '로그인 안내 복사',
        body: '버튼을 누르면 글이 복사됩니다.\n카톡에 붙여 넣으면 됩니다.',
      },
      {
        icon: 'check-list-3',
        title: '무엇이 들어가나요',
        body: '앱 설치, 업체 코드, 아이디, 비밀번호,\n카카오 연결 방법이 들어 있습니다.',
      },
    ],
  },
  'external-company-create': {
    path: '/admin/team-leaders/external-companies',
    title: '타업체 등록',
    intro: '우리 일을 넘겨 줄 다른 청소 업체를 넣는 창입니다.',
    steps: [
      {
        icon: 'account-add',
        title: '적을 것',
        body: '업체명, 로그인 아이디, 비밀번호만 적습니다.',
      },
      {
        icon: 'pencil',
        title: '나머지는 나중에',
        body: '사업자·담당자는 그 업체가 처음 로그인할 때 적습니다.',
      },
    ],
  },
  'external-company-edit': {
    path: '/admin/team-leaders/external-companies',
    title: '타업체 정보 수정',
    intro: '이미 있는 타업체 정보를 고치는 창입니다.',
    steps: [
      {
        icon: 'pencil',
        title: '고칠 수 있는 것',
        body: '업체명, 사업자, 연락처, 메모, 로그인을 고칩니다.',
      },
      {
        icon: 'alert-circle',
        title: '사용 중지',
        body: '더 안 쓰면 사용 중지로 두면\n배정 목록에서 빠집니다.',
      },
      {
        icon: 'file',
        title: '로그인 안내 복사',
        body: '그 업체에 로그인 글을 보내려면 위 버튼을 누르세요.',
      },
    ],
  },
  'partner-invite': {
    path: '/admin/team-leaders/tenant-partners',
    title: '파트너 초대',
    intro: '청소비서를 쓰는 다른 업체와 손을 잡는 창입니다.',
    steps: [
      {
        icon: 'link',
        title: '업체 코드',
        body: '상대가 로그인할 때 넣는 「업체 코드」를 적습니다.\n옆 버튼으로 맞는지 확인할 수 있습니다.',
      },
      {
        icon: 'pencil',
        title: '메모',
        body: '우리끼리 볼 짧은 메모입니다. 없어도 됩니다.',
      },
      {
        icon: 'check-list-3',
        title: '초대 보내기',
        body: '보내면 상대가 승인하거나 거절합니다.',
      },
    ],
  },
  'team-member-create': {
    path: '/admin/team-leaders/team-members',
    title: '팀원 등록',
    intro: '현장에 나가는 사람을 명단에 넣는 창입니다.\n이 사람은 관리자처럼 로그인하지 않습니다.',
    steps: [
      {
        icon: 'account-add',
        title: '이름 · 연락처',
        body: '국적과 이름, 전화를 적습니다.',
      },
      {
        icon: 'calendar',
        title: '다음에 할 일',
        body: '등록한 뒤 목록에서 휴무일·급여·크루 그룹을 정합니다.',
      },
    ],
  },
  'team-member-edit': {
    path: '/admin/team-leaders/team-members',
    title: '팀원 정보 수정',
    intro: '이미 있는 팀원의 이름·전화·급여를 고치는 창입니다.',
    steps: [
      {
        icon: 'pencil',
        title: '고칠 수 있는 것',
        body: '이름, 연락처, 일당, 급여일, 퇴사일을 고칩니다.',
      },
    ],
  },
  'team-member-dayoff': {
    path: '/admin/team-leaders/team-members',
    title: '휴무일 등록·변경',
    intro: '그 팀원이 쉬는 날을 달력에서 고르는 창입니다.',
    steps: [
      {
        icon: 'calendar',
        title: '날짜를 누르세요',
        body: '한 번 누르면 휴무, 다시 누르면 취소입니다.\n노란색이 휴무일입니다.',
      },
    ],
  },
  'crew-group-create': {
    path: '/admin/team-leaders/team-members',
    title: '크루 그룹 만들기',
    intro: '여러 팀원이 같이 쓰는 그룹을 만드는 창입니다.',
    steps: [
      {
        icon: 'account',
        title: '그룹 이름 · 로그인',
        body: '그룹 이름과, 같이 쓸 로그인 아이디를 적습니다.\n아이디는 영문·숫자만 됩니다.',
      },
      {
        icon: 'alert-circle',
        title: '내 비밀번호',
        body: '실수 방지를 위해 지금 로그인한 내 비밀번호를 한 번 더 넣습니다.',
      },
    ],
  },
  'crew-group-edit': {
    path: '/admin/team-leaders/team-members',
    title: '크루 그룹 편집',
    intro: '이미 있는 그룹의 이름·사람·설정을 고치는 창입니다.',
    steps: [
      {
        icon: 'pencil',
        title: '그룹 정보',
        body: '이름과 공유 로그인을 고칩니다.',
      },
      {
        icon: 'account',
        title: '사람',
        body: '이 그룹에 넣을 팀원을 고르거나 뺍니다.',
      },
    ],
  },
  'external-settlement-pay': {
    path: '/admin/team-leaders/external-settlement',
    title: '정산 처리',
    intro: '타업체에 줄 돈을 기록하는 창입니다.',
    steps: [
      {
        icon: 'check-list-3',
        title: '금액 · 날짜',
        body: '지금 쌓인 미수금이 보입니다.\n이번에 준 금액과 날짜, 메모를 적습니다.',
      },
    ],
  },
  'partner-settlement-pay': {
    path: '/admin/team-leaders/tenant-partner-settlement',
    title: '입금 확인',
    intro: '파트너에게 받은 돈을 기록하는 창입니다.',
    steps: [
      {
        icon: 'check-list-3',
        title: '금액 · 날짜',
        body: '받은 금액과 날짜, 메모를 적습니다.\n상대 「구매」 쪽에도 같은 금액이 자동으로 잡힙니다.',
      },
    ],
  },
};

export function resolveAdminOnlyHelpModule(helpId: string): AdminOnlyHelpPage | null {
  return ADMIN_ONLY_HELP_MODULES[helpId] ?? null;
}
