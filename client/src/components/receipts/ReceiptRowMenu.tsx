import { ReceiptCopyButtons } from './ReceiptCopyButtons';
import { AnchoredMenu } from '../ui/AnchoredMenu';

const ITEM =
  'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none';
const DANGER =
  'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs font-medium text-[#b42318] hover:bg-[#fdecea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 disabled:pointer-events-none';

export function ReceiptRowMenu({
  kind,
  issueId,
  official,
  publicToken,
  copyReady,
  canCancel,
  cancelling,
  onCancel,
  onLinkInquiry,
  onModify,
}: {
  kind: 'cashbill' | 'taxinvoice';
  issueId: string;
  official: boolean;
  publicToken: string | null;
  copyReady: boolean;
  canCancel: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onLinkInquiry?: () => void;
  onModify?: () => void;
}) {
  return (
    <AnchoredMenu label="더 보기">
      {(close) => (
        <>
          <ReceiptCopyButtons kind={kind} issueId={issueId} official={official} publicToken={publicToken} copyReady={copyReady} menu />
          {onLinkInquiry ? (
            <button type="button" className={ITEM} onClick={() => { close(); onLinkInquiry(); }}>접수 연결</button>
          ) : null}
          {canCancel ? (
            <>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className={ITEM} disabled={cancelling} onClick={() => { close(); onCancel(); }}>
                {cancelling ? '취소 중…' : '발급 취소'}
              </button>
            </>
          ) : null}
          {onModify ? (
            <>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className={DANGER} onClick={() => { close(); onModify(); }}>수정 발급 (취소·금액 변경)</button>
            </>
          ) : null}
        </>
      )}
    </AnchoredMenu>
  );
}
