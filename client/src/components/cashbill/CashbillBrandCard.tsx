import { useState } from 'react';
import { BAROBILL_MEMBER_STATUS_LABEL } from '@shared/barobillPolicy';
import { formatBizNumberDisplay } from '@shared/authSignup';
import { isBlankSupplierField } from '@shared/supplierFieldText';
import type { CashbillSettings } from '../../api/cashbill';
import { SupplierInfoModal } from '../taxinvoice/SupplierInfoModal';
import { CashbillCertRegisterModal } from './CashbillCertRegisterModal';
import { CashbillLinkForm } from './CashbillLinkForm';
import { certDaysLeft, certExpireLabel, maskPhone } from './cashbillCertDisplay';

const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none max-lg:w-full';
const PRIMARY =
  'min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none max-lg:w-full';

type Brand = CashbillSettings['brands'][number];

export function CashbillBrandCard({
  brand,
  prefill,
  canRegister,
  onDone,
  onCert,
  onIssue,
}: {
  brand: Brand;
  prefill: CashbillSettings['prefill'];
  canRegister: boolean;
  onDone: (message: string) => void;
  onCert: (expireDate: string | null) => void;
  onIssue: () => void;
}) {
  const member = brand.member;
  const linked = Boolean(member?.linked);
  const active = member?.status === 'ACTIVE' && linked;
  const [certOpen, setCertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(!member || member.status === 'FAILED');
  const days = certDaysLeft(member?.certExpireDate);
  const soon = Boolean(member?.certValid) && days != null && days <= 30;
  const taxReady = Boolean(member?.certValid) && member?.taxType !== '2' && !soon;
  const corp = formatBizNumberDisplay(member?.corpNum || prefill.corpNum);
  const name = member?.corpName || prefill.corpName || brand.name;

  const banner = !active && member && member.status !== 'FAILED'
    ? member.status === 'REJECTED'
      ? { tone: 'border-red-200 bg-red-50 text-red-800', text: member.rejectReason || '반려되었습니다.', action: '다시 제출' }
      : member.status === 'LINK_REQUIRED'
        ? { tone: 'border-amber-200 bg-amber-50 text-amber-950', text: member.lastError || '연결이 필요합니다.', action: '연결하기' }
        : member.status === 'PENDING_REVIEW'
          ? { tone: 'border-slate-200 bg-slate-100 text-slate-800', text: '검토 중입니다. 승인 전에는 연결하지 않습니다.', action: '' }
          : member.status === 'PROCESSING'
            ? { tone: 'border-slate-200 bg-slate-100 text-slate-800', text: '처리 중입니다.', action: '' }
            : null
    : member?.status === 'FAILED'
      ? { tone: 'border-red-200 bg-red-50 text-red-800', text: member.lastError || '가입에 실패했습니다.', action: '' }
      : null;

  return (
    <section className="max-w-[640px] space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={brand.name}>{brand.name}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-slate-700">{brand.isDefault ? '기본 브랜드' : '추가 브랜드'}</span>
        <span className={`rounded-full px-2 py-0.5 text-fluid-2xs ${member?.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          {member ? BAROBILL_MEMBER_STATUS_LABEL[member.status] : '미가입'}
        </span>
      </div>
      <p className="text-fluid-xs text-slate-700">{name} · {corp || '사업자번호 없음'}</p>
      {banner ? (
        <div className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-fluid-xs sm:flex-row sm:items-center sm:justify-between ${banner.tone}`}>
          <p>{banner.text}</p>
          {banner.action ? (
            <button type="button" className={PRIMARY} onClick={() => setFormOpen(true)}>{banner.action}</button>
          ) : null}
        </div>
      ) : null}
      {active ? (
        <div className="space-y-2 text-fluid-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p><span className="text-emerald-700">●</span> 현금영수증 · 사용 가능</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {member?.taxType === '2' ? (
              <p className="text-slate-600">세금계산서 · 간이과세자는 발행할 수 없습니다</p>
            ) : soon ? (
              <p className="text-amber-800">세금계산서 · 곧 만료 · {certExpireLabel(member?.certExpireDate)}</p>
            ) : taxReady ? (
              <p><span className="text-emerald-700">●</span> 세금계산서 · 사용 가능 · 인증서 {certExpireLabel(member?.certExpireDate)} 만료</p>
            ) : (
              <p><span className="text-amber-700">●</span> 세금계산서 · 공동인증서 필요</p>
            )}
            {member?.taxType === '2' ? null : (
              <button type="button" className={soon || taxReady ? GHOST : PRIMARY} onClick={() => setCertOpen(true)}>
                {soon || taxReady ? '다시 등록' : '공동인증서 등록'}
              </button>
            )}
          </div>
          <div className="flex items-start justify-between gap-2 border-t border-slate-100 pt-2">
            <p className="min-w-0 flex-1 break-all text-slate-700">
              업태 {member?.bizType || '없음'} · 종목 {member?.bizClass || '없음'} · 담당 {maskPhone(member?.contactTel)} · {member?.contactEmail || '이메일 없음'}
            </p>
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-[4.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-fluid-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isBlankSupplierField(member?.ceoName) || isBlankSupplierField(member?.addr1) ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-300 hover:bg-amber-100 focus-visible:ring-amber-400' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400'}`}
              onClick={() => setEditOpen(true)}
            >
              수정
            </button>
          </div>
        </div>
      ) : null}
      {formOpen && !active ? (
        <CashbillLinkForm brand={brand} prefill={prefill} canRegister={canRegister} mode="join" onDone={onDone} />
      ) : null}
      {editOpen && member ? (
        <SupplierInfoModal
          operatingCompanyId={brand.operatingCompanyId}
          corpNum={member.corpNum}
          initial={{
            corpName: member.corpName,
            ceoName: member.ceoName,
            addr: member.addr1,
            bizType: member.bizType,
            bizClass: member.bizClass,
            email: member.contactEmail,
            tel: member.contactTel,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onDone(`${brand.name}: 공급자 정보를 저장했습니다.`);
          }}
        />
      ) : null}
      {certOpen ? (
        <CashbillCertRegisterModal
          operatingCompanyId={brand.operatingCompanyId}
          onClose={() => setCertOpen(false)}
          onRegistered={(status) => onCert(status.expireDate)}
          onIssue={onIssue}
        />
      ) : null}
    </section>
  );
}
