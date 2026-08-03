import { useRef } from 'react';
import type { FormMessagesState } from '../../utils/orderFormCustomerCopy';
import { OrderFormLinkPlaceholderPicker } from './OrderFormLinkPlaceholderPicker';

type Props = {
  msgConfig: FormMessagesState;
  onChange: (next: FormMessagesState) => void;
  assembledPreview: string;
  loading?: boolean;
};

/**
 * 게시판 본문처럼 메시지 전체를 한 칸에서 자유롭게 편집.
 * {{orderLink}} 등 치환을 넣으면 발급 시 채워집니다.
 */
export function CustomerLinkMessagePreviewEditor({
  msgConfig,
  onChange,
  assembledPreview,
  loading,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const template = msgConfig.customerLinkMessageTemplate ?? '';

  const setTemplate = (next: string) => {
    onChange({ ...msgConfig, customerLinkMessageTemplate: next });
  };

  const insertToken = (token: string) => {
    const el = taRef.current;
    if (!el) {
      setTemplate(`${template}${token}`);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? start;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fluid-xs font-semibold text-gray-800">메시지 본문</h2>
        <OrderFormLinkPlaceholderPicker compact onInsert={insertToken} />
      </div>
      <p className="text-fluid-2xs text-gray-500">
        「청소일시」「페이백 신청」같은 글자는 직접 고치세요. 바뀌는 값만{' '}
        <code className="text-fluid-2xs">{'{{date}}'}</code>·
        <code className="text-fluid-2xs">{'{{paybackLink}}'}</code> 를 넣으면 됩니다.
      </p>

      {loading ? (
        <p className="text-fluid-xs text-gray-500">브랜드 설정 불러오는 중…</p>
      ) : (
        <>
          <textarea
            ref={taRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full min-h-[280px] resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 font-sans text-fluid-sm leading-relaxed text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="고객에게 보낼 메시지 본문을 입력하세요…"
            aria-label="고객 링크 메시지 본문"
          />

          <div className="space-y-1.5">
            <p className="text-fluid-2xs font-medium text-gray-600">샘플 미리보기 (치환 적용)</p>
            <pre className="max-h-[min(32vh,280px)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-violet-200/70 bg-white p-3 text-fluid-xs leading-relaxed text-gray-800">
              {assembledPreview}
            </pre>
          </div>
        </>
      )}
    </section>
  );
}
