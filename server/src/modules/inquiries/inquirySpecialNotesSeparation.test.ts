import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONE_ROOM_SPECIAL_NOTES_PHRASE } from '../orderform/orderFormOneRoom.js';
import {
  buildPrefillFromPayload,
  customerSpecialNotesFromPrefill,
  customerSpecialNotesUpdateFromPrefill,
  inquiryUpdateDataFromPrefillMap,
} from '../orderform/orderFormPrefill.js';
import {
  customerOrderNotesAfterOneRoomChange,
  planCustomerOrderNotesSave,
} from './inquiryCustomerOrderNotes.helpers.js';
import {
  effectiveAdminTeamSpecialNotes,
  effectiveCustomerOrderNotes,
} from '../../../../client/src/utils/inquirySpecialNotesDisplay.ts';
import { buildInquiryQuotationPrefill } from '../../../../client/src/components/quotations/inquiryQuotationPrefill.ts';
import {
  isSubmittedCustomerNotesMixedWithInternal,
  snapshotSubmittedSpecialNotes,
} from '../../../scripts/find-mixed-customer-special-notes.ts';

const INTERNAL = '내부메모A';
const INTERNAL_NEXT = '내부메모B';

test('가: 내부 메모만 고치면 고객 특이사항 저장 계획이 생기지 않고, 이전 내부 메모를 복사하지 않는다', () => {
  const plan = planCustomerOrderNotesSave({
    body: { specialNotes: INTERNAL_NEXT },
    orderForm: {
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      customerSpecialNotes: null,
      customerSubmissionSnapshot: { fields: { specialNotes: '' } },
    },
    isOneRoom: false,
    omitAutoPhrase: false,
  });
  assert.equal(plan, null);

  const routes = readFileSync(new URL('./inquiries.routes.ts', import.meta.url), 'utf8');
  assert.equal(routes.includes('customerSpecialNotes: prevSn'), false);
  assert.equal(routes.includes('inquiry.specialNotes?.trim()'), false);
});

test('나: 원룸 변경은 고객 특이사항만 다루고, 비어 있으면 원룸 문구만 넣는다', () => {
  const phraseOnly = customerOrderNotesAfterOneRoomChange(null, true, false);
  assert.equal(phraseOnly, ONE_ROOM_SPECIAL_NOTES_PHRASE);
  assert.equal(phraseOnly?.includes(INTERNAL), false);

  const kept = customerOrderNotesAfterOneRoomChange('고객 요청', true, false);
  assert.equal(kept, `고객 요청\n${ONE_ROOM_SPECIAL_NOTES_PHRASE}`);
  assert.equal(kept?.includes(INTERNAL), false);

  assert.equal(customerOrderNotesAfterOneRoomChange('   ', false, false), null);
});

test('다: 발주서 선입력 특이사항은 접수 내부 메모 패치에 들어가지 않는다', () => {
  const prefill = { specialNotes: '  고객 선입력  ', roomCount: '2' };
  const patch = inquiryUpdateDataFromPrefillMap(prefill);
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'specialNotes'), false);
  assert.equal(patch.roomCount, 2);
  assert.equal(customerSpecialNotesFromPrefill(prefill), '고객 선입력');
  assert.equal(customerSpecialNotesFromPrefill({ roomCount: 1 }), undefined);
  assert.equal(customerSpecialNotesFromPrefill({ specialNotes: '   ' }), null);
});

test('고객 임시 저장 특이사항은 특이사항 없는 미리 채움으로 지워지지 않는다', () => {
  const draft = '고객 임시 저장';
  const prefill = buildPrefillFromPayload({ customerName: '홍길동', roomCount: 2 }, []);
  assert.equal(Object.prototype.hasOwnProperty.call(prefill, 'specialNotes'), false);
  const update = customerSpecialNotesUpdateFromPrefill(prefill);
  assert.equal(update, undefined);
  const kept = update === undefined ? draft : update.customerSpecialNotes;
  assert.equal(kept, draft);
  assert.deepEqual(customerSpecialNotesUpdateFromPrefill({ specialNotes: '마케터 문구' }), {
    customerSpecialNotes: '마케터 문구',
  });
});

test('라: 고객 특이사항을 저장해도 내부 메모를 비우거나 이전 값으로 쓰지 않는다', () => {
  const plan = planCustomerOrderNotesSave({
    body: { customerSpecialNotes: '고객 새 문구' },
    orderForm: {
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      customerSpecialNotes: null,
      customerSubmissionSnapshot: { fields: { specialNotes: null } },
    },
    isOneRoom: false,
    omitAutoPhrase: false,
  });
  assert.ok(plan && !('error' in plan));
  if (!plan || 'error' in plan) return;
  assert.equal(plan.next, '고객 새 문구');
  assert.equal(Object.prototype.hasOwnProperty.call(plan, 'legacyClearInquirySpecialNotes'), false);
  assert.equal(plan.changeLine, '고객 발주서 특이사항: (없음) → 고객 새 문구');
  assert.equal(plan.changeLine?.includes(INTERNAL), false);
});

test('마: 견적서 비고 미리채움은 내부 메모와 상담 메모를 가져오지 않는다', () => {
  const prefill = buildInquiryQuotationPrefill({
    customerName: '홍길동',
    customerPhone: '010-0000-0000',
    address: '서울시 중구',
    specialNotes: INTERNAL,
    consultationMemo: '상담내용',
  });
  assert.equal(prefill.memo, '');
  assert.equal(prefill.customerName, '홍길동');
});

test('화면 표시는 고객 칸과 내부 메모를 섞지 않는다', () => {
  const submitted = {
    id: 'of-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
    customerSpecialNotes: null as string | null,
  };
  assert.equal(
    effectiveCustomerOrderNotes({ specialNotes: INTERNAL, orderForm: submitted }),
    '',
  );
  assert.equal(
    effectiveAdminTeamSpecialNotes({ specialNotes: INTERNAL, orderForm: submitted }),
    INTERNAL,
  );
  assert.equal(
    effectiveCustomerOrderNotes({
      specialNotes: INTERNAL,
      orderForm: { ...submitted, customerSpecialNotes: '고객 문구' },
    }),
    '고객 문구',
  );
  assert.equal(
    effectiveAdminTeamSpecialNotes({
      specialNotes: `  ${INTERNAL_NEXT}  `,
      orderForm: { ...submitted, customerSpecialNotes: '고객 문구' },
    }),
    INTERNAL_NEXT,
  );
});

test('조회 조건: 제출값과 다르고 내부 메모와 같거나 그 일부인 경우만', () => {
  assert.equal(
    snapshotSubmittedSpecialNotes({ fields: { specialNotes: ' 제출값 ' } }),
    '제출값',
  );
  assert.equal(snapshotSubmittedSpecialNotes(null), '');
  assert.equal(
    isSubmittedCustomerNotesMixedWithInternal({
      customerSpecialNotes: INTERNAL,
      submittedSpecialNotes: '',
      inquirySpecialNotes: INTERNAL,
    }),
    true,
  );
  assert.equal(
    isSubmittedCustomerNotesMixedWithInternal({
      customerSpecialNotes: '일부',
      submittedSpecialNotes: '',
      inquirySpecialNotes: `머리 ${'일부'} 꼬리`,
    }),
    true,
  );
  assert.equal(
    isSubmittedCustomerNotesMixedWithInternal({
      customerSpecialNotes: '제출값',
      submittedSpecialNotes: '제출값',
      inquirySpecialNotes: '제출값',
    }),
    false,
  );
  assert.equal(
    isSubmittedCustomerNotesMixedWithInternal({
      customerSpecialNotes: '고객만',
      submittedSpecialNotes: '',
      inquirySpecialNotes: INTERNAL,
    }),
    false,
  );
});
