import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchOrderFollowupCallNotes,
  type OrderFollowupCallNoteItem,
} from '../../api/orderFollowups';
import { ModalCloseButton } from '../admin/ModalCloseButton';

function fmtNoteTime(iso: string): string {
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

function authorLabel(author: OrderFollowupCallNoteItem['author']): string {
  const name = author.name?.trim();
  if (name) return name;
  const email = author.email?.trim();
  if (email) return email.split('@')[0] ?? email;
  return '상담사';
}

function CallNoteBodyPreview({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const trimmed = body.trim();
  const long = trimmed.length > 180 || trimmed.split('\n').length > 4;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!trimmed) return <p className="text-fluid-2xs text-gray-500">내용 없음</p>;

  return (
    <>
      <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-gray-800 line-clamp-4">
        {trimmed}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
        >
          크게 보기
        </button>
      ) : null}
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal
              aria-labelledby="followup-call-note-preview-title"
            >
              <div className="absolute inset-0" aria-hidden onClick={() => setOpen(false)} />
              <div className="relative flex max-h-[min(88vh,720px)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                <ModalCloseButton onClick={() => setOpen(false)} />
                <div className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-4 pr-14">
                  <h2
                    id="followup-call-note-preview-title"
                    className="text-fluid-base font-semibold text-gray-900"
                  >
                    통화 메모
                  </h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
                  <p className="whitespace-pre-wrap break-words text-fluid-sm leading-relaxed text-gray-800">
                    {trimmed}
                  </p>
                </div>
                <div className="shrink-0 border-t border-gray-100 px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-gray-800"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** 부재·보류 화면 — 연락처 기준 통화 메모 이력(조회 전용) */
export function FollowupCallNotesHistory({
  token,
  phone,
  phone2,
}: {
  token: string;
  phone: string;
  phone2?: string | null;
}) {
  const [items, setItems] = useState<OrderFollowupCallNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const digits2 = (phone2 ?? '').replace(/\D/g, '');
  const hasPhone = digits.length >= 4 || digits2.length >= 4;

  const load = useCallback(async () => {
    if (!token || !hasPhone) {
      setItems([]);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchOrderFollowupCallNotes(token, {
        phone: digits.length >= 4 ? digits : digits2,
        phone2: digits.length >= 4 && digits2.length >= 4 && digits !== digits2 ? digits2 : undefined,
      });
      setItems(res.items);
    } catch (e) {
      setItems([]);
      setErr(e instanceof Error ? e.message : '통화 메모를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, digits, digits2, hasPhone]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPhone) {
    return (
      <p className="text-fluid-2xs text-gray-500 leading-snug">
        연락처가 4자리 이상일 때 CRM 통화 메모 이력을 조회할 수 있습니다.
      </p>
    );
  }

  if (loading) {
    return <p className="text-fluid-2xs text-gray-500">통화 메모 불러오는 중…</p>;
  }

  if (err) {
    return <p className="text-fluid-2xs text-red-600">{err}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-fluid-2xs text-gray-500 leading-snug">
        이 연락처로 저장된 CRM 통화 메모가 없습니다. CRM에서 통화 메모를 남기면 여기에 표시됩니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((row) => (
        <li key={row.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
            <span className="tabular-nums text-gray-700">{fmtNoteTime(row.createdAt)}</span>
            <span>· {authorLabel(row.author)}</span>
            {row.phone ? (
              <span className="tabular-nums">· {row.phone}</span>
            ) : null}
          </div>
          <div className="mt-1.5">
            <CallNoteBodyPreview body={row.body} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FollowupDetailTabBar({
  tab,
  onChange,
}: {
  tab: 'followupMemo' | 'callNotes';
  onChange: (tab: 'followupMemo' | 'callNotes') => void;
}) {
  const base =
    'flex-1 rounded-md px-2 py-1.5 text-fluid-2xs font-medium transition-colors whitespace-nowrap';
  return (
    <div
      className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label="메모 종류"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'followupMemo'}
        onClick={() => onChange('followupMemo')}
        className={`${base} ${tab === 'followupMemo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
      >
        부재·보류 메모
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'callNotes'}
        onClick={() => onChange('callNotes')}
        className={`${base} ${tab === 'callNotes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
      >
        통화 메모 이력
      </button>
    </div>
  );
}
