import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvalNoticeBody,
  brandChannelNoticeSubject,
  rejectionNoticeBody,
} from './alimtalkBrandChannel.notify.js';

test('같은 브랜드 승인 3종은 제목 하나와 본문 한 통으로 묶는다', () => {
  const subject = brandChannelNoticeSubject('approved', 'SK클린텍', '@skcleantec');
  assert.equal(subject, '[청소비서] 카카오 채널 서식 승인 — SK클린텍(@skcleantec)');
  const body = approvalNoticeBody({
    tenantName: 'SK클린텍',
    brandName: 'SK클린텍',
    searchId: '@skcleantec',
    approvedNames: ['발주 제출 완료 (자동)', '발주서 링크', '방문 이틀 전'],
    remaining: [{ name: '결제 안내', status: 'IN_REVIEW' }],
  });
  assert.match(body, /SK클린텍 · SK클린텍 · @skcleantec/);
  assert.match(body, /· 발주 제출 완료 \(자동\)/);
  assert.match(body, /· 발주서 링크/);
  assert.match(body, /· 방문 이틀 전/);
  assert.match(body, /· 결제 안내 · 심사 중/);
  assert.match(body, /이제 승인된 서식은 이 채널로 보냅니다\./);
  assert.equal(body.includes('바로빌'), false);
});

test('반려는 사유를 한 통에 담는다', () => {
  const subject = brandChannelNoticeSubject('rejected', 'SK클린텍', '@skcleantec');
  assert.equal(subject, '[청소비서] 카카오 채널 서식 반려 — SK클린텍(@skcleantec)');
  const body = rejectionNoticeBody({
    tenantName: 'SK클린텍',
    brandName: 'SK클린텍',
    searchId: '@skcleantec',
    rejected: [{ name: '방문 이틀 전', reason: '버튼 주소가 열리지 않습니다.' }],
  });
  assert.match(body, /버튼 주소가 열리지 않습니다/);
});
