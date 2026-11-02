import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import {
  CRM_MESSAGE_FIELD_MENUS,
  crmMessageFieldsOf,
  fillCrmMessageFields,
  type CrmMessageFieldsMenu,
} from './crmMessageFields';

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} 복사했어요 — 글 쓰는 칸에 붙여넣기 하세요`);
  } catch {
    toast.error('복사하지 못했어요. 직접 입력해 주세요.');
  }
}

/** 「{고객명}」 부분을 보라색 표시로 */
function renderFields(text: string): ReactNode {
  return text.split(/(\{[^{}]+\})/g).map((part, i) => {
    const m = /^\{([^{}]+)\}$/.exec(part);
    if (!m) return <Fragment key={i}>{part}</Fragment>;
    return (
      <span key={i} className="rounded-lg bg-violet-100 px-1 font-semibold text-violet-700">
        {part}
      </span>
    );
  });
}

/** 「치환코드 보기」 — 누르면 이 메뉴에서 쓸 수 있는 칸·뜻·예시를 모달로 보여 줌 */
export function CrmMessageFieldsButton({ menu, className = '' }: { menu: CrmMessageFieldsMenu; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className={`!h-7 shrink-0 ${className}`}>
        치환코드 보기
      </Button>
      {open ? <CrmMessageFieldsModal menu={menu} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function CrmMessageFieldsModal({ menu, onClose }: { menu: CrmMessageFieldsMenu; onClose: () => void }) {
  const def = CRM_MESSAGE_FIELD_MENUS[menu];
  const fields = crmMessageFieldsOf(menu);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`치환코드 — ${def.title}`}
        className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-fluid-base font-semibold text-slate-900">치환코드 — {def.title}</p>
            <p className="mt-0.5 text-fluid-xs text-slate-500">{def.when}</p>
          </div>
          <Button size="sm" variant="quiet" onClick={onClose}>
            닫기
          </Button>
        </div>

        <p className="mt-3 text-fluid-xs leading-relaxed text-slate-700">
          글에 <span className="rounded-lg bg-violet-100 px-1 font-semibold text-violet-700">{'{고객명}'}</span>처럼
          중괄호로 감싸 쓰면, 보낼 때 실제 값으로 바뀌어요. <b>아래 목록에 없는 코드는 바뀌지 않고 글자 그대로 나가요.</b>
        </p>

        <table className="mt-3 w-full text-fluid-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-fluid-2xs text-slate-500">
              <th className="py-1.5 pr-2 font-medium">코드</th>
              <th className="py-1.5 pr-2 font-medium">무엇으로 바뀌나요</th>
              <th className="py-1.5 pr-2 font-medium">예시</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key} className="border-b border-slate-100 align-middle">
                <td className="whitespace-nowrap py-1.5 pr-2">
                  <span className="rounded-lg bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">{`{${f.key}}`}</span>
                </td>
                <td className="py-1.5 pr-2 text-slate-600">{f.meaning}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 font-medium text-slate-800">{f.sample}</td>
                <td className="py-1.5 text-right">
                  <Button size="sm" className="!h-6 !px-2" onClick={() => void copyText(`{${f.key}}`, `「{${f.key}}」`)}>
                    복사
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-fluid-2xs font-semibold text-slate-600">이렇게 쓰면</p>
              <Button size="sm" variant="quiet" className="!h-6 !px-1.5" onClick={() => void copyText(def.example, '예시 문구를')}>
                복사
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-fluid-xs leading-relaxed text-slate-800">{renderFields(def.example)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-2.5">
            <p className="mb-1 text-fluid-2xs font-semibold text-slate-600">고객은 이렇게 받아요</p>
            <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-3 py-1.5 text-fluid-xs leading-relaxed text-slate-800 shadow-sm">
              {fillCrmMessageFields(def.example, menu)}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
