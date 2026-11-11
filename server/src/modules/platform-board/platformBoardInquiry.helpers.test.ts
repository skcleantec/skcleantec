import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InquiryValidationError,
  classifyInquirySender,
  extractReplyToken,
  generateReplyToken,
  htmlToPlainText,
  normalizeKrMobile,
  parseNotifyEmails,
  stripQuotedReply,
  validateInquiryInput,
} from './platformBoardInquiry.helpers.js';

const ok = {
  categoryId: 'cat-1',
  authorName: '홍길동',
  authorPhone: '01012345678',
  authorEmail: 'name@example.com',
  title: '발행 버튼이 안 눌려요',
  bodyText: '현금영수증 화면에서요',
  privacyConsent: true,
  consentVersion: 'inquiry-2026-11-11',
};

function fieldOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof InquiryValidationError ? e.field : 'OTHER';
  }
}

test('문의 등록 검증: 정상 입력은 휴대폰을 하이픈 형식으로 바꾼다', () => {
  const r = validateInquiryInput(ok);
  assert.equal(r.authorPhone, '010-1234-5678');
});

test('문의 등록 검증: 휴대폰·동의·이메일이 빠지면 칸 이름으로 막는다', () => {
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, authorPhone: '' })), 'authorPhone');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, authorPhone: '02-123-4567' })), 'authorPhone');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, authorPhone: '0101234' })), 'authorPhone');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, privacyConsent: false })), 'privacyConsent');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, privacyConsent: 'true' })), 'privacyConsent');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, consentVersion: '' })), 'privacyConsent');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, authorEmail: 'name@' })), 'authorEmail');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, authorName: ' ' })), 'authorName');
  assert.equal(fieldOf(() => validateInquiryInput({ ...ok, bodyText: '' })), 'bodyHtml');
});

test('휴대폰 형식: 10·11자리 01X만 통과', () => {
  assert.equal(normalizeKrMobile('010-1234-5678'), '010-1234-5678');
  assert.equal(normalizeKrMobile('0111234567'), '011-123-4567');
  assert.equal(normalizeKrMobile('01212345678'), null);
  assert.equal(normalizeKrMobile('031-123-4567'), null);
});

test('메일 제목 번호: 만들고 다시 찾는다', () => {
  for (let i = 0; i < 50; i += 1) {
    const t = generateReplyToken();
    assert.match(t, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(extractReplyToken(`Re: [청소비서 문의 #${t}] 제목`), t);
  }
  assert.equal(extractReplyToken('RE: [청소비서 문의 #k7q2x9] 제목'), 'K7Q2X9');
  assert.equal(extractReplyToken('그냥 메일'), null);
  assert.equal(extractReplyToken('#K7Q2X9A 너무 김'), null);
});

test('인용 잘라내기: Gmail·네이버·아웃룩·서명', () => {
  assert.equal(
    stripQuotedReply('바로빌 연결을 먼저 해 주세요.\n\nOn Tue, Nov 11, 2026 at 11:52 AM 청소비서 <a@b.com> wrote:\n> 원문'),
    '바로빌 연결을 먼저 해 주세요.',
  );
  assert.equal(
    stripQuotedReply('확인했습니다.\nOn Tue, Nov 11, 2026 at 11:52 AM 청소비서 <a@b.com>\nwrote:\n> 원문'),
    '확인했습니다.',
  );
  assert.equal(stripQuotedReply('네 감사합니다\n\n-----원본 메시지-----\n보낸 사람: x'), '네 감사합니다');
  assert.equal(stripQuotedReply('답변입니다\n-----Original Message-----\nFrom: x'), '답변입니다');
  assert.equal(stripQuotedReply('답변입니다\n\n2026. 11. 11. 오전 11:52, 청소비서 <a@b.com> 작성:\n> 원문'), '답변입니다');
  assert.equal(stripQuotedReply('답변\n보낸 사람: 청소비서\n받는 사람: 나'), '답변');
  assert.equal(stripQuotedReply('답변 본문\n-- \n홍길동 드림\n010-0000-0000'), '답변 본문');
  assert.equal(stripQuotedReply('> 원문만 있음'), '');
});

test('HTML 메일은 글로 바꾸고 스크립트·인용을 버린다', () => {
  const html =
    '<div>첫 줄<br>둘째 줄</div><script>alert(1)</script><img src="http://x/y.png"><blockquote>예전 내용</blockquote>';
  const text = stripQuotedReply(htmlToPlainText(html));
  assert.equal(text, '첫 줄\n둘째 줄');
});

test('발신자 구분: 담당자·작성자·모르는 사람', () => {
  const admins = ['cs@cbiseo.com', 'Boss@Naver.com'];
  assert.equal(classifyInquirySender('boss@naver.com', admins, 'kim@a.com'), 'ADMIN');
  assert.equal(classifyInquirySender('KIM@a.com', admins, 'kim@a.com'), 'CUSTOMER');
  assert.equal(classifyInquirySender('evil@x.com', admins, 'kim@a.com'), 'UNKNOWN');
  assert.equal(classifyInquirySender('', admins, 'kim@a.com'), 'UNKNOWN');
});

test('알림 메일 목록: 예전 notifyEmail 하나도 읽고, 중복·잘못된 주소는 뺀다', () => {
  assert.deepEqual(parseNotifyEmails({ notifyEmail: 'a@b.com' }), ['a@b.com']);
  assert.deepEqual(
    parseNotifyEmails({ notifyEmails: ['a@b.com', 'A@B.com', 'bad', 'c@d.co.kr'], notifyEmail: 'z@z.com' }),
    ['a@b.com', 'c@d.co.kr'],
  );
  assert.equal(parseNotifyEmails({ notifyEmails: Array.from({ length: 15 }, (_, i) => `u${i}@x.com`) }).length, 10);
});
