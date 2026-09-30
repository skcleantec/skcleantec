import type { AiDispatchJob, AiDispatchLeader, AiDispatchManualJob, AiDispatchProposal } from '../../../api/aiDispatch';

const detail: AiDispatchLeader['detail'] = {
  windowDays: 14,
  workedDays: 3,
  jobCount: 6,
  restDays: 1,
  sinceRest: true,
  normalWorkDays: 6,
  normalJobs: 12,
  loopKm: null,
  teamLoopKm: null,
  betweenDeltaKm: null,
  distanceSinceRestKm: 42,
  largeJobs: 0,
  soloJobs: 0,
};

export const AI_DISPATCH_HELP_LEADERS: AiDispatchLeader[] = [
  {
    id: 'leader-a',
    name: '김○○',
    jobsPerDay: 2,
    sizePolicy: 'UNRESTRICTED',
    homeAddress: '인천 ○○',
    homeAddressDetail: '',
    homeLat: 37.456,
    homeLng: 126.705,
    band: '보통',
    fatigue: 36,
    note: '휴무 다음 3일',
    usedJobs: 0,
    remainingJobs: 2,
    detail,
  },
];

export const AI_DISPATCH_HELP_JOBS: AiDispatchJob[] = [
  {
    id: 'job-am',
    customerName: '이○○',
    areaLabel: '인천 서구 원당동',
    pyeong: 15,
    isOneRoom: false,
    tone: 'NORMAL',
    lat: 37.594,
    lng: 126.71,
    slot: 'AM',
    requiredLeaders: 1,
    preferredTime: '오전',
    blockedReason: null,
  },
  {
    id: 'job-pm',
    customerName: '박○○',
    areaLabel: '인천 서구 당하동',
    pyeong: 29,
    isOneRoom: false,
    tone: 'NORMAL',
    lat: 37.589,
    lng: 126.675,
    slot: 'PM',
    requiredLeaders: 1,
    preferredTime: '오후',
    blockedReason: null,
  },
];

export const AI_DISPATCH_HELP_MANUAL: AiDispatchManualJob[] = [
  {
    id: 'job-manual',
    customerName: '최○○',
    areaLabel: '인천 계양구',
    pyeong: 24,
    lat: 37.57,
    lng: 126.73,
    slot: 'AM',
    teamLeaderId: 'leader-b',
    teamLeaderName: '정○○',
  },
];

export const AI_DISPATCH_HELP_PROPOSALS: AiDispatchProposal[] = [
  {
    id: 'proposal-am',
    inquiryId: 'job-am',
    customerName: '이○○',
    teamLeaderId: 'leader-a',
    teamLeaderName: '김○○',
    slot: 'AM',
    reason: '두 곳 4.2km · 피로가 보통이라 가까운 하루',
    status: 'DRAFT',
    fromHomeKm: 18.4,
  },
  {
    id: 'proposal-pm',
    inquiryId: 'job-pm',
    customerName: '박○○',
    teamLeaderId: 'leader-a',
    teamLeaderName: '김○○',
    slot: 'PM',
    reason: '두 곳 4.2km · 피로가 보통이라 가까운 하루',
    status: 'DRAFT',
    fromHomeKm: 22.1,
  },
];
