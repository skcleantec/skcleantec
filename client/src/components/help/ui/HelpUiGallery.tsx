import { HELP_UI_TOKENS } from '@shared/helpUiTokens';
import { HELP_UI_REGISTRY } from './helpUiRegistry';

/** 편집 권한자용 — 등록된 UI 미리보기 갤러리 (실제 컴포넌트와 동기화) */
export function HelpUiGallery() {
  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">UI 미리보기 갤러리</h2>
      <p className="mt-1 text-fluid-sm text-slate-600">
        도움말 본문의 <code className="rounded bg-slate-100 px-1">{`{{ui:…}}`}</code> 토큰은 아래와 같은
        **실제 화면 컴포넌트**를 그립니다. 앱 UI가 바뀌면 도움말도 함께 맞춰집니다.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {HELP_UI_TOKENS.map((tokenId) => (
          <li
            key={tokenId}
            className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
          >
            <code className="text-fluid-2xs text-slate-500">{`{{ui:${tokenId}}}`}</code>
            <div className="min-h-[2rem] flex flex-wrap items-center">{HELP_UI_REGISTRY[tokenId]()}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
