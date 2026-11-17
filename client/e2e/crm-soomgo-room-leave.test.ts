import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideSoomgoRoomLeave, type SoomgoRoomSnapshot } from '../src/utils/crmSoomgoRoomLeave.ts';

const room = (chatId: string): SoomgoRoomSnapshot => ({ inRoom: true, chatId });
const list: SoomgoRoomSnapshot = { inRoom: false, chatId: null };

describe('decideSoomgoRoomLeave', () => {
  it('방A→목록(내용 있음)=비움', () => {
    assert.equal(
      decideSoomgoRoomLeave({ prev: room('a'), next: list, hasContent: true, busy: false, selfNav: null }),
      'clear-list',
    );
  });

  it('목록→목록=유지', () => {
    assert.equal(
      decideSoomgoRoomLeave({ prev: list, next: list, hasContent: true, busy: false, selfNav: null }),
      'keep',
    );
  });

  it('방A→방B(사용자)=비움', () => {
    assert.equal(
      decideSoomgoRoomLeave({
        prev: room('a'),
        next: room('b'),
        hasContent: true,
        busy: false,
        selfNav: null,
      }),
      'clear-room',
    );
  });

  it('CRM이 연 방→목록=비움', () => {
    assert.equal(
      decideSoomgoRoomLeave({
        prev: room('a'),
        next: list,
        hasContent: true,
        busy: false,
        selfNav: 'open-room',
      }),
      'clear-list',
    );
    assert.equal(
      decideSoomgoRoomLeave({
        prev: room('a'),
        next: room('b'),
        hasContent: true,
        busy: false,
        selfNav: 'open-room',
      }),
      'keep',
    );
  });

  it('브릿지 재시작 직후=유지', () => {
    assert.equal(
      decideSoomgoRoomLeave({ prev: null, next: list, hasContent: true, busy: false, selfNav: null }),
      'keep',
    );
  });

  it('extract 중=보류', () => {
    assert.equal(
      decideSoomgoRoomLeave({ prev: room('a'), next: list, hasContent: true, busy: true, selfNav: null }),
      'defer',
    );
  });

  it('내용 없음=아무것도 안 함', () => {
    assert.equal(
      decideSoomgoRoomLeave({ prev: room('a'), next: list, hasContent: false, busy: false, selfNav: null }),
      'noop',
    );
  });
});
