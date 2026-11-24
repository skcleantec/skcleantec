import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  PDF_MAX_BYTES,
  PDF_MAX_COUNT,
  isOrphanAttachment,
  linksForTarget,
  messageBodyError,
  messageListPreview,
  missingAttachmentIds,
  noticeIsRead,
  pdfPageCount,
  remindBlockMinutes,
  validateUploadBatch,
  type UploadFileMeta,
} from './messageAttachment.logic.js';

function file(name: string, size: number, mime = ''): UploadFileMeta {
  return { originalname: name, mimetype: mime, size };
}

describe('메시지 첨부', () => {
  it('장수·크기·형식을 막는다', () => {
    assert.equal(validateUploadBatch([]), '파일을 올려 주세요.');
    assert.equal(validateUploadBatch([file('a.txt', 10, 'text/plain')]), '사진(jpg, png, webp, heic)이나 PDF만 올릴 수 있어요.');
    assert.equal(validateUploadBatch([file('a.jpg', IMAGE_MAX_BYTES + 1, 'image/jpeg')]), '사진은 한 장에 25MB까지예요.');
    assert.equal(validateUploadBatch([file('a.pdf', PDF_MAX_BYTES + 1, 'application/pdf')]), 'PDF는 한 개에 20MB까지예요.');
    assert.match(
      validateUploadBatch(Array.from({ length: IMAGE_MAX_COUNT + 1 }, (_, i) => file(`${i}.png`, 10, 'image/png'))) ?? '',
      /30장/,
    );
    assert.match(
      validateUploadBatch(Array.from({ length: PDF_MAX_COUNT + 1 }, (_, i) => file(`${i}.pdf`, 10, 'application/pdf'))) ?? '',
      /5개/,
    );
    assert.equal(validateUploadBatch([file('a.heic', 100, 'image/heic'), file('b.pdf', 100, 'application/pdf')]), null);
  });

  it('글이 없어도 첨부가 있으면 보낼 수 있다', () => {
    assert.equal(messageBodyError('', ['a']), null);
    assert.equal(messageBodyError('  ', []), '내용이나 사진·파일을 넣어 주세요.');
    assert.equal(messageBodyError('안녕', []), null);
  });

  it('공지 첨부는 받는 사람 수만큼 복사하지 않는다', () => {
    const links = linksForTarget(['file-1', 'file-2'], { batchId: 'batch-1' });
    const recipients = 12;
    assert.equal(links.length, 2);
    assert.notEqual(links.length, 2 * recipients);
    assert.deepEqual(
      links.map((link) => link.attachmentId),
      ['file-1', 'file-2'],
    );
    assert.equal(links.every((link) => link.batchId === 'batch-1' && link.messageId == null), true);
    const again = linksForTarget(['file-1'], { batchId: 'batch-2' });
    assert.equal(again[0]?.attachmentId, 'file-1');
    assert.notEqual(again[0]?.batchId, links[0]?.batchId);
  });

  it('사진이 있는 공지는 열람해야 읽음이고, 없는 공지는 방을 열면 읽음이다', () => {
    const opened = new Date('2026-11-24T00:00:00.000Z');
    assert.equal(noticeIsRead({ hasAttachments: false, readAt: opened, attachmentsViewedAt: null }), true);
    assert.equal(noticeIsRead({ hasAttachments: false, readAt: null, attachmentsViewedAt: null }), false);
    assert.equal(noticeIsRead({ hasAttachments: true, readAt: opened, attachmentsViewedAt: null }), false);
    assert.equal(noticeIsRead({ hasAttachments: true, readAt: null, attachmentsViewedAt: opened }), true);
  });

  it('같은 공지는 1시간 안에 다시 알리지 않는다', () => {
    const now = new Date('2026-11-24T03:00:00.000Z');
    assert.equal(remindBlockMinutes(null, now), null);
    assert.equal(remindBlockMinutes(new Date(now.getTime() - 60 * 60 * 1000), now), null);
    const left = remindBlockMinutes(new Date(now.getTime() - 30 * 60 * 1000), now);
    assert.equal(left, 30);
  });

  it('다른 업체 첨부 id는 빠진다', () => {
    assert.deepEqual(missingAttachmentIds(['ours', 'theirs'], ['ours']), ['theirs']);
    assert.deepEqual(missingAttachmentIds(['ours'], ['ours']), []);
  });

  it('미리보기 문구를 조립한다', () => {
    assert.equal(messageListPreview('교육 자료입니다', 7, 1), '교육 자료입니다 · 사진 7장 · 파일 1개');
    assert.equal(messageListPreview('', 7, 0), '사진 7장');
    assert.equal(messageListPreview('', 0, 1), '파일 1개');
  });

  it('붙지 않은 지 24시간이 지난 파일만 지운다', () => {
    const now = new Date('2026-11-24T00:00:00.000Z');
    const old = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fresh = new Date(now.getTime() - 60 * 60 * 1000);
    assert.equal(isOrphanAttachment(old, 0, now), true);
    assert.equal(isOrphanAttachment(old, 1, now), false);
    assert.equal(isOrphanAttachment(fresh, 0, now), false);
  });

  it('PDF 쪽 수를 본문에서 센다', () => {
    const pdf = Buffer.from('1 0 obj << /Type /Page >> endobj 2 0 obj << /Type /Pages /Count 1 >> endobj');
    assert.equal(pdfPageCount(pdf), 1);
    assert.equal(pdfPageCount(Buffer.from('not a pdf')), null);
  });
});
