import { useEffect, useState } from 'react';
import { searchPublicHelpCms, type HelpCmsSearchHit } from '../../api/publicHelpCms';
import { HELP_HOME_CONTACT, helpCmsArticlePath } from '@shared/helpHomeConfig';
import { HelpCategoryIcon } from '../help-cms/HelpCategoryIcon';

type Props = {
  title: string;
  onPickArticle: (path: string) => void;
};

const STEPS = [
  '문의를 남기면 청소비서 담당자에게 바로 알림이 가요.',
  '답변은 적어 주신 이메일로 보내 드리고, 이 문의 글에도 남겨요.',
  '더 궁금하면 받은 답변 메일에 그대로 답장하시면 돼요.',
] as const;

/** 1:1 문의 쓰기 오른쪽 — 이 글이 답일 수 있어요 · 답변은 이렇게 와요 · 급하신가요? */
export function HelpInquiryComposeAssist({ title, onPickArticle }: Props) {
  const [hits, setHits] = useState<HelpCmsSearchHit[]>([]);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchPublicHelpCms(q, 3)
        .then(setHits)
        .catch(() => setHits([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [title]);

  return (
    <div className="flex flex-col gap-3.5">
      {hits.length > 0 ? (
        <div className="rounded-2xl bg-[#f0f9ff] px-5 py-[18px]">
          <h2 className="mb-2 text-fluid-sm font-bold text-[#0369a1]">이 글이 답일 수 있어요</h2>
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={h.slug}>
                <a
                  href={helpCmsArticlePath(h.categorySlug, h.slug)}
                  onClick={(e) => {
                    e.preventDefault();
                    onPickArticle(helpCmsArticlePath(h.categorySlug, h.slug));
                  }}
                  className="flex items-center gap-2 text-fluid-sm text-[#0369a1] hover:text-[#075985]"
                >
                  <HelpCategoryIcon slug={h.categorySlug} size={22} />
                  <span className="min-w-0">{h.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white px-5 py-[18px] shadow-card">
        <h2 className="mb-3 text-fluid-sm font-bold text-slate-900">답변은 이렇게 와요</h2>
        <ol className="flex flex-col gap-3 text-fluid-sm text-slate-700">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs font-bold text-white">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-1.5 rounded-2xl bg-white px-5 py-[18px] shadow-card">
        <h2 className="text-fluid-sm font-bold text-slate-900">급하신가요?</h2>
        <a href={HELP_HOME_CONTACT.phoneTel} className="text-fluid-sm font-bold text-[#0369a1]">
          전화 {HELP_HOME_CONTACT.phone}
        </a>
        <span className="text-fluid-xs text-slate-500">평일 오전 10시~오후 7시</span>
      </div>
    </div>
  );
}
