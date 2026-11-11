import type { PlatformBoardReply } from '../../api/publicCustomerBoard';
import { HelpCmsArticleBody } from '../help-cms/HelpCmsArticleBody';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 공개 문의 글 아래 — 담당자 답변과 고객 추가 질문을 시간순으로 */
export function HelpInquiryReplies({ replies }: { replies: PlatformBoardReply[] }) {
  if (replies.length === 0) {
    return (
      <p className="mt-6 rounded-xl bg-field px-4 py-3 text-fluid-sm text-slate-600">
        아직 답변 전이에요. 답변은 남기신 이메일로도 보내 드려요.
      </p>
    );
  }
  return (
    <section className="mt-6 flex flex-col gap-3" aria-label="답변">
      {replies.map((r) => {
        const admin = r.authorType === 'ADMIN';
        return (
          <div
            key={r.id}
            className={`rounded-xl px-4 py-3.5 ${admin ? 'bg-[#f0f9ff]' : 'bg-field'}`}
          >
            <p className="mb-1.5 flex items-center gap-2 text-fluid-xs">
              <span className={`font-bold ${admin ? 'text-[#0369a1]' : 'text-slate-700'}`}>
                {admin ? '청소비서 답변' : '추가 질문'}
              </span>
              <span className="text-slate-500">{formatWhen(r.createdAt)}</span>
            </p>
            <HelpCmsArticleBody html={r.bodyHtml} />
          </div>
        );
      })}
    </section>
  );
}
