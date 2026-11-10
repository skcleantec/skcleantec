import { useEffect, useState } from 'react';
import { searchPublicHelpCms, type HelpCmsSearchHit } from '../../api/publicHelpCms';
import {
  HELP_HOME_CONTACT,
  HELP_INQUIRY_SUGGEST_ARTICLES,
  helpCmsArticlePath,
} from '@shared/helpHomeConfig';

type Props = {
  title: string;
  onPickArticle: (path: string) => void;
};

/** 문의 작성 — 제목 기반 글 추천 + 급하신가요 + 문의 전 글 */
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
    <div className="space-y-4">
      {hits.length > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-fluid-2xs font-semibold text-sky-900">이 글이 답일 수 있어요</p>
          <ul className="mt-2 space-y-1.5">
            {hits.map((h) => (
              <li key={h.slug}>
                <button
                  type="button"
                  onClick={() => onPickArticle(helpCmsArticlePath(h.categorySlug, h.slug))}
                  className="text-left text-fluid-sm font-medium text-sky-800 hover:underline"
                >
                  {h.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-fluid-sm font-bold text-slate-900">급하신가요?</p>
        <ul className="mt-2 space-y-1.5 text-fluid-sm text-slate-700">
          <li>
            <a
              href={HELP_HOME_CONTACT.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-900 underline"
            >
              카카오톡
            </a>
          </li>
          <li>
            <a href={HELP_HOME_CONTACT.phoneTel} className="font-semibold text-slate-900">
              전화 {HELP_HOME_CONTACT.phone}
            </a>
          </li>
          <li>
            <a href={`mailto:${HELP_HOME_CONTACT.email}`} className="font-semibold text-slate-900">
              {HELP_HOME_CONTACT.email}
            </a>
          </li>
          <li className="text-fluid-2xs text-slate-500">{HELP_HOME_CONTACT.hours}</li>
        </ul>
      </div>

      <div>
        <p className="text-fluid-2xs font-semibold text-slate-500">문의 전에 많이 보는 글</p>
        <ul className="mt-2 space-y-1">
          {HELP_INQUIRY_SUGGEST_ARTICLES.map((row) => (
            <li key={row.slug}>
              <button
                type="button"
                onClick={() => onPickArticle(helpCmsArticlePath(row.section, row.slug))}
                className="text-fluid-sm text-sky-700 hover:underline"
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
