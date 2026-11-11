import { useState } from 'react';
import {
  createPlatformCustomerBoardReply,
  resendPlatformCustomerBoardReply,
  uploadPlatformCustomerBoardImage,
  type PlatformBoardPost,
  type PlatformBoardReply,
} from '../../api/platformCustomerBoard';
import { HelpCmsRichEditor } from '../help-cms/HelpCmsRichEditor';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isEmptyHtml(html: string): boolean {
  return !html.replace(/<img\b/gi, 'IMG').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** 플랫폼 문의 글 — 연락처 · 답변·추가 질문 타임라인 · 답변 쓰기 */
export function PlatformInquiryReplyPanel({
  post,
  onChanged,
}: {
  post: PlatformBoardPost;
  onChanged: () => void;
}) {
  const [replies, setReplies] = useState<PlatformBoardReply[]>(post.replies ?? []);
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [editorKey, setEditorKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const send = async () => {
    if (isEmptyHtml(bodyHtml)) {
      toast.error('답변 내용을 적어 주세요.');
      return;
    }
    setSending(true);
    try {
      const reply = await createPlatformCustomerBoardReply(post.id, bodyHtml);
      setReplies((prev) => [...prev, reply]);
      setBodyHtml('<p></p>');
      setEditorKey((k) => k + 1);
      if (reply.emailSentAt) toast.success(`답변을 ${post.authorEmail ?? '고객'} 로 보냈어요.`);
      else toast.error('답변은 남겼지만 메일을 보내지 못했어요. 아래에서 다시 보내 주세요.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '답변을 남기지 못했어요.');
    } finally {
      setSending(false);
    }
  };

  const resend = async (replyId: string) => {
    setResendingId(replyId);
    try {
      const reply = await resendPlatformCustomerBoardReply(post.id, replyId);
      setReplies((prev) => prev.map((r) => (r.id === reply.id ? reply : r)));
      if (reply.emailSentAt) toast.success('메일을 다시 보냈어요.');
      else toast.error(reply.emailError ?? '메일을 보내지 못했어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '메일을 보내지 못했어요.');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-field px-4 py-3 text-fluid-sm">
        <dt className="text-slate-500">이름</dt>
        <dd className="text-slate-900">{post.authorName ?? '—'}</dd>
        <dt className="text-slate-500">휴대폰</dt>
        <dd className="text-slate-900">
          {post.authorPhone ? <a href={`tel:${post.authorPhone.replace(/\D/g, '')}`}>{post.authorPhone}</a> : '—'}
        </dd>
        <dt className="text-slate-500">이메일</dt>
        <dd className="break-all text-slate-900">{post.authorEmail ?? '—'}</dd>
        {post.tenantName ? (
          <>
            <dt className="text-slate-500">업체</dt>
            <dd className="text-slate-900">{post.tenantName}</dd>
          </>
        ) : null}
        <dt className="text-slate-500">문의 번호</dt>
        <dd className="text-slate-900">{post.replyToken ? `#${post.replyToken}` : '—'}</dd>
      </dl>

      <section className="flex flex-col gap-2.5" aria-label="답변·추가 질문">
        <h3 className="text-fluid-sm font-bold text-slate-900">답변·추가 질문</h3>
        {replies.length === 0 ? (
          <p className="text-fluid-sm text-slate-500">아직 답변이 없어요.</p>
        ) : (
          replies.map((r) => {
            const admin = r.authorType === 'ADMIN';
            const failed = admin && !r.emailSentAt && Boolean(r.emailError);
            return (
              <div key={r.id} className={`rounded-xl px-4 py-3 ${admin ? 'bg-[#f0f9ff]' : 'bg-field'}`}>
                <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-fluid-xs">
                  <span className={`font-bold ${admin ? 'text-[#0369a1]' : 'text-slate-700'}`}>
                    {admin ? '청소비서 답변' : '고객 추가 질문'}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-fluid-2xs text-slate-600">
                    {r.source === 'EMAIL' ? '메일' : '플랫폼'}
                  </span>
                  <span className="text-slate-500">{formatWhen(r.createdAt)}</span>
                  {r.fromEmail ? <span className="text-slate-500">{r.fromEmail}</span> : null}
                  {admin && r.emailSentAt ? <span className="text-slate-500">· 고객 메일 보냄</span> : null}
                </p>
                <div
                  className="prose prose-slate max-w-none text-fluid-sm"
                  dangerouslySetInnerHTML={{ __html: r.bodyHtml }}
                />
                {failed ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-fluid-xs text-rose-600">
                    메일 못 보냄
                    <button
                      type="button"
                      disabled={resendingId === r.id}
                      onClick={() => void resend(r.id)}
                      className="font-bold underline disabled:opacity-50"
                    >
                      {resendingId === r.id ? '보내는 중…' : '다시 보내기'}
                    </button>
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-fluid-sm font-bold text-slate-900">답변 쓰기</h3>
        <p className="text-fluid-xs text-slate-500">
          보내면 {post.authorEmail ?? '고객'} 로 답변 메일이 가고, 문의 상태가 「답변완료」로 바뀌어요.
        </p>
        <HelpCmsRichEditor
          key={editorKey}
          editorKey={`platform-inquiry-reply-${post.id}-${editorKey}`}
          value={bodyHtml}
          onChange={setBodyHtml}
          enterAsLineBreak
          onUploadImage={(file) => uploadPlatformCustomerBoardImage(post.boardSlug, file)}
          placeholder="고객에게 보낼 답변을 적어 주세요."
        />
        <div>
          <Button variant="primary" disabled={sending} onClick={() => void send()}>
            {sending ? '보내는 중…' : '답변 보내기'}
          </Button>
        </div>
      </section>
    </div>
  );
}
