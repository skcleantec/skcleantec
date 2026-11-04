import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '../../ui/Toast';
import type { CrmIntakeSubmitResult } from './crmIntakeSubmit';

export type CrmIntakeSaveFlash = {
  id: number;
  tone: 'ok' | 'err';
  text: string;
};

/** 화면 상단 가운데. 3초 뒤 사라진다. */
export function CrmIntakeSaveNotice({
  notice,
  onDone,
}: {
  notice: CrmIntakeSaveFlash | null;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => onDoneRef.current(), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const err = notice.tone === 'err';
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[140] flex justify-center px-3">
      <p
        role="status"
        className={`max-w-lg rounded-lg border px-3 py-2 text-center text-fluid-sm font-medium shadow-lg ${
          err ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-white text-slate-900'
        }`}
      >
        {notice.text}
      </p>
    </div>,
    document.body,
  );
}

function formatRegisteredDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function phoneTail(contactPhone: string, safePhone: string): string {
  const digits = (contactPhone.replace(/\D/g, '') || safePhone.replace(/\D/g, '')).slice(-4);
  return digits.length === 4 ? digits : '—';
}

/** 이미 저장된 건 — 확인 하나. 기존 CRM 안내 창과 같은 크기. */
export function confirmAlreadySavedIntake(input: {
  result: CrmIntakeSubmitResult;
  contactPhone: string;
  safePhone: string;
}): Promise<void> {
  const name = input.result.customerName.trim() || '고객';
  const handler = input.result.existingSummary?.handlerName?.trim() || '미지정';
  const tail = phoneTail(input.contactPhone, input.safePhone);
  const registered = formatRegisteredDay(input.result.existingSummary?.registeredAt);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    toast.info({
      title: '이미 저장된 건입니다',
      body: (
        <div className="space-y-1.5">
          <p className="flex flex-wrap items-center justify-center gap-x-1">
            <span className="whitespace-nowrap">{name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{tail}</span>
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-1">
            <span className="whitespace-nowrap">처음 등록 {registered}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">담당 {handler}</span>
          </p>
          <p>방금 입력한 내용은 기존 건에 이어서 저장했어요.</p>
        </div>
      ),
      duration: 0,
      onClose: finish,
    });
  });
}
