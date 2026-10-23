import { useState } from 'react';
import type { TenantPgCredentialSlot } from '../../../api/cardPayment';
import { openSellerCenterLoggedIn } from '../../../utils/openSellerCenterLogin';
import { LineMdIcon } from '../../ui/LineMdIcon';

export type SellerCenterView = {
  portalUrl: string;
  loginId: string;
  password: string;
  businessName: string;
};

function cell(label: string, value: string) {
  return (
    <div className="min-w-0 px-3 py-2">
      <p className="text-fluid-2xs text-slate-500">{label}</p>
      <p className="mt-0.5 break-all text-fluid-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

function slotLine(slot: TenantPgCredentialSlot | undefined) {
  if (!slot?.connected) return '아직 없음';
  return [
    slot.mid ? `MID ${slot.mid}` : null,
    slot.oid ? `OID ${slot.oid}` : null,
    slot.tidMasked ? `TID ${slot.tidMasked}` : null,
    slot.apiKeyLast4 ? `키 끝 ${slot.apiKeyLast4}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || '연결됨';
}

/** 관리자 PG 연동 — 가맹 정보와 판매자센터 로그인을 한 서식으로 보여 준다. */
export function PgConnectionSheet({
  businessName,
  keyin,
  link,
  seller,
}: {
  businessName: string;
  keyin?: TenantPgCredentialSlot;
  link?: TenantPgCredentialSlot;
  seller: SellerCenterView | null;
}) {
  const [openError, setOpenError] = useState<string | null>(null);
  const canOpen = Boolean(seller?.loginId && seller?.password);

  const openPortal = () => {
    if (!seller?.loginId || !seller.password) return;
    const opened = openSellerCenterLoggedIn(seller.loginId, seller.password);
    setOpenError(opened ? null : '팝업이 막혀 원성페이를 열지 못했습니다. 브라우저에서 팝업을 허용해 주세요.');
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <LineMdIcon name="link" className="size-5 text-slate-700" />
        <h2 className="min-w-0 flex-1 text-fluid-sm font-semibold text-slate-900">선샤인페이 판매자센터</h2>
        <button
          type="button"
          onClick={openPortal}
          disabled={!canOpen}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <LineMdIcon name="external-link" className="size-4" />
          원성페이접속
        </button>
      </div>
      <div className="grid sm:grid-cols-2">
        {cell('상호명', seller?.businessName || businessName)}
        {cell('접속주소', seller?.portalUrl || 'https://wspay.net')}
        {cell('아이디', seller?.loginId || '')}
        {cell('비밀번호', seller?.password || '')}
        {cell('수기결재', slotLine(keyin))}
        {cell('인증결재', slotLine(link))}
      </div>
      {openError ? <p className="border-t border-red-100 px-3 py-2 text-fluid-2xs text-red-700">{openError}</p> : null}
      <p className="border-t border-slate-100 px-3 py-2 text-fluid-2xs leading-snug text-slate-500">
        원성페이접속을 누르면 새 창에서 위 아이디로 판매자센터에 로그인됩니다. 당일 결재만 취소할 수 있습니다.
      </p>
    </section>
  );
}
