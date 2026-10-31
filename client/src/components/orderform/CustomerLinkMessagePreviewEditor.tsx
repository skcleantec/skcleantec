import { useRef } from 'react';
import type { FormMessagesState } from '../../utils/orderFormCustomerCopy';
import { OrderFormLinkPlaceholderPicker } from './OrderFormLinkPlaceholderPicker';
import {
  customerLinkTemplateToDisplay,
  customerLinkTemplateToStored,
  customerLinkTokenToShown,
} from '../../utils/customerLinkTokenDisplay';

type Props = {
  msgConfig: FormMessagesState;
  onChange: (next: FormMessagesState) => void;
  assembledPreview: string;
  loading?: boolean;
};

/**
 * 게시판 본문처럼 메시지 전체를 한 칸에서 자유롭게 편집.
 * [발주서 링크] 같은 자리를 넣으면 발급 시 채워집니다.
 * 화면에는 [라벨]로 보이고, 저장값은 예전과 같은 {{…}} 그대로 둔다(customerLinkTokenDisplay).
 */
export function CustomerLinkMessagePreviewEditor({
  msgConfig,
  onChange,
  assembledPreview,
  loading,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const template = msgConfig.customerLinkMessageTemplate ?? '';
  /** 화면(textarea)에 보이는 글자 — 저장값의 {{…}}를 [라벨]로 */
  const shownTemplate = customerLinkTemplateToDisplay(template);

  /** 화면 글자를 받아 저장값({{…}})으로 되돌려 넘긴다 */
  const setShownTemplate = (nextShown: string) => {
    onChange({ ...msgConfig, customerLinkMessageTemplate: customerLinkTemplateToStored(nextShown) });
  };

  const insertToken = (token: string) => {
    const shownToken = customerLinkTokenToShown(token);
    const el = taRef.current;
    if (!el) {
      setShownTemplate(`${shownTemplate}${shownToken}`);
      return;
    }
    const start = el.selectionStart ?? shownTemplate.length;
    const end = el.selectionEnd ?? start;
    const next = shownTemplate.slice(0, start) + shownToken + shownTemplate.slice(end);
    setShownTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + shownToken.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fluid-sm font-bold text-slate-900">메시지 본문</h2>
        <OrderFormLinkPlaceholderPicker compact onInsert={insertToken} />
      </div>
      <p className="text-fluid-2xs text-slate-500">
        「청소일시」「페이백 신청」같은 글자는 직접 고치세요. 바뀌는 값만{' '}
        <b className="font-semibold text-[#1f4fb8]">[청소 예약일]</b>·
        <b className="font-semibold text-[#1f4fb8]">[페이백 링크]</b>처럼 대괄호 자리를 넣으면 손님 정보로 바뀝니다.
      </p>

      {loading ? (
        <p className="text-fluid-xs text-slate-500">브랜드 설정 불러오는 중…</p>
      ) : (
        <>
          <textarea
            ref={taRef}
            value={shownTemplate}
            onChange={(e) => setShownTemplate(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full min-h-[280px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 font-sans text-fluid-sm leading-relaxed text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            placeholder="고객에게 보낼 메시지 본문을 입력하세요…"
            aria-label="고객 링크 메시지 본문"
          />

          <div className="space-y-1.5">
            <p className="text-fluid-2xs font-semibold text-slate-600">샘플 미리보기 (손님 정보 넣은 모습)</p>
            <pre className="max-h-[min(32vh,280px)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-fluid-xs leading-relaxed text-slate-800">
              {assembledPreview}
            </pre>
          </div>
        </>
      )}
    </section>
  );
}
