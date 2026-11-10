import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TaxInvoiceBuyerRow, TaxInvoiceBuyerInput, TaxInvoiceBuyerPatch } from '../../api/taxInvoiceBuyers';
import { LineMdIcon } from '../ui/LineMdIcon';

// ── 타입 ───────────────────────────────────────────────────────────────────

export type { TaxInvoiceBuyerRow };

export type TaxInvoiceBuyerApi = {
  list: (q: string) => Promise<TaxInvoiceBuyerRow[]>;
  upsert: (body: TaxInvoiceBuyerInput) => Promise<TaxInvoiceBuyerRow>;
  update: (id: string, body: TaxInvoiceBuyerPatch) => Promise<TaxInvoiceBuyerRow>;
  remove: (id: string) => Promise<void>;
};

/** 플랫폼 모드에서 공급받는자로 선택 가능한 청소비서 업체 항목 */
export type TenantBuyerItem = {
  id: string;
  name: string;
  corpNum?: string | null;
  corpName?: string | null;
  ceoName?: string | null;
  addr?: string | null;
  bizType?: string | null;
  bizClass?: string | null;
  email?: string | null;
};

type Props = {
  api: TaxInvoiceBuyerApi;
  onPick: (buyer: TaxInvoiceBuyerRow) => void;
  /** API 호환용 — 트리거 레이블로 사용하지 않음 */
  title?: string;
  /** 플랫폼 모드: 드롭다운에 「청소비서 업체」 섹션 추가 */
  tenantBuyers?: TenantBuyerItem[];
  onPickTenant?: (id: string) => void;
};

// ── 사업자번호 포맷 ─────────────────────────────────────────────────────────

function formatBizNum(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

// ── 거래처 편집 폼 ──────────────────────────────────────────────────────────

type EditFormProps = {
  initial?: TaxInvoiceBuyerRow;
  onSave: (data: TaxInvoiceBuyerInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string;
};

function BuyerEditForm({ initial, onSave, onCancel, saving, error }: EditFormProps) {
  const [bizNumber, setBizNumber] = useState(initial?.bizNumber ?? '');
  const [corpName, setCorpName] = useState(initial?.corpName ?? '');
  const [ceoName, setCeoName] = useState(initial?.ceoName ?? '');
  const [addr, setAddr] = useState(initial?.addr ?? '');
  const [bizType, setBizType] = useState(initial?.bizType ?? '');
  const [bizClass, setBizClass] = useState(initial?.bizClass ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [email2, setEmail2] = useState(initial?.email2 ?? '');
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [tel, setTel] = useState(initial?.tel ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      bizNumber: bizNumber.replace(/\D/g, ''),
      corpName,
      ceoName,
      addr,
      bizType,
      bizClass,
      email,
      email2,
      contactName,
      tel,
      memo,
    });
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white';
  const labelCls = 'text-xs font-medium text-slate-500 mb-0.5 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>사업자등록번호 *</label>
          <input
            className={inputCls}
            value={formatBizNum(bizNumber)}
            onChange={(e) => setBizNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="000-00-00000"
            disabled={!!initial}
            maxLength={12}
            required
          />
        </div>
        <div>
          <label className={labelCls}>상호(법인명) *</label>
          <input className={inputCls} value={corpName} onChange={(e) => setCorpName(e.target.value)} placeholder="상호" required />
        </div>
        <div>
          <label className={labelCls}>대표자명</label>
          <input className={inputCls} value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="홍길동" />
        </div>
        <div>
          <label className={labelCls}>연락처(전화)</label>
          <input className={inputCls} value={tel} onChange={(e) => setTel(e.target.value)} placeholder="02-0000-0000" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>주소</label>
          <input className={inputCls} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="서울특별시 강남구 ..." />
        </div>
        <div>
          <label className={labelCls}>업태</label>
          <input className={inputCls} value={bizType} onChange={(e) => setBizType(e.target.value)} placeholder="서비스" />
        </div>
        <div>
          <label className={labelCls}>종목</label>
          <input className={inputCls} value={bizClass} onChange={(e) => setBizClass(e.target.value)} placeholder="청소업" />
        </div>
        <div>
          <label className={labelCls}>이메일</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
        <div>
          <label className={labelCls}>이메일 2</label>
          <input className={inputCls} type="email" value={email2} onChange={(e) => setEmail2(e.target.value)} placeholder="user2@example.com" />
        </div>
        <div>
          <label className={labelCls}>담당자명</label>
          <input className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="담당자" />
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모" />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function TaxInvoiceBuyerPicker({ api, onPick, tenantBuyers, onPickTenant }: Props) {
  // ── 인라인 검색 콤보박스 상태 ──
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TaxInvoiceBuyerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  // ── 거래처 관리 모달 상태 ──
  const [manageOpen, setManageOpen] = useState(false);
  const [manageQ, setManageQ] = useState('');
  const [manageItems, setManageItems] = useState<TaxInvoiceBuyerRow[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState('');
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<TaxInvoiceBuyerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TaxInvoiceBuyerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 청소비서 업체 필터링 ──
  const matchedTenants = React.useMemo(() => {
    if (!tenantBuyers || q.trim().length < 2) return [];
    const lq = q.toLowerCase();
    const ld = q.replace(/\D/g, '');
    return tenantBuyers.filter((t) =>
      (t.name || '').toLowerCase().includes(lq) ||
      (t.corpName || '').toLowerCase().includes(lq) ||
      (ld.length >= 2 && (t.corpNum || '').replace(/\D/g, '').includes(ld)),
    );
  }, [tenantBuyers, q]);

  // ── 디바운스 검색 ──
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setDropOpen(false);
      return;
    }
    setDropOpen(true);
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    setLoading(true);
    fetchTimerRef.current = setTimeout(async () => {
      try {
        const rows = await api.list(trimmed);
        setItems(rows.slice(0, 8));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [q, api]);

  // ── 바깥 클릭으로 드롭다운 닫기 ──
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── 관리 모달: 목록 로드 ──
  const loadManage = useCallback(
    async (search: string) => {
      setManageLoading(true);
      setManageError('');
      try {
        const rows = await api.list(search);
        setManageItems(rows);
      } catch (e) {
        setManageError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
      } finally {
        setManageLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (!manageOpen) return;
    void loadManage(manageQ);
  }, [manageOpen, manageQ, loadManage]);

  // ── 핸들러 ──
  function handlePick(buyer: TaxInvoiceBuyerRow) {
    onPick(buyer);
    setDropOpen(false);
    setQ('');
    setItems([]);
  }

  function handlePickTenant(id: string) {
    onPickTenant?.(id);
    setDropOpen(false);
    setQ('');
  }

  function openManage() {
    setManageOpen(true);
    setMode('list');
    setManageQ('');
    setSaveError('');
    setDeleteTarget(null);
    setDropOpen(false);
  }

  function closeManage() {
    setManageOpen(false);
    setMode('list');
    setEditTarget(null);
    setSaveError('');
    setDeleteTarget(null);
  }

  async function handleSave(data: TaxInvoiceBuyerInput) {
    setSaving(true);
    setSaveError('');
    try {
      if (mode === 'edit' && editTarget) {
        const { bizNumber: _bn, ...patch } = data;
        await api.update(editTarget.id, patch);
      } else {
        await api.upsert(data);
      }
      setMode('list');
      setEditTarget(null);
      void loadManage(manageQ);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.remove(deleteTarget.id);
      setDeleteTarget(null);
      void loadManage(manageQ);
    } catch (e) {
      setManageError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* 인라인 검색 콤보박스 */}
      <div ref={containerRef} className="relative">
        <div className="relative w-[240px]">
          <LineMdIcon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => { if (q.trim().length >= 2) setDropOpen(true); }}
            placeholder="거래처 상호·사업자번호"
            className="h-[30px] w-[240px] rounded-[8px] border-0 bg-[#F4F6FA] pl-8 pr-3 text-[12px] text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          />
        </div>

        {/* 드롭다운 */}
        {dropOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-[320px] overflow-hidden rounded-[10px] bg-white shadow-[0_4px_24px_rgba(17,24,39,.12)] ring-1 ring-slate-100">
            {/* 청소비서 업체 섹션 */}
            {matchedTenants.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-medium text-[#94A3B8]">청소비서 업체</div>
                {matchedTenants.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                    onClick={() => handlePickTenant(t.id)}
                  >
                    <div className="text-[13px] font-medium text-slate-800">{t.corpName || t.name}</div>
                    <div className="text-[12px] text-[#64748B]">
                      {[t.corpNum ? formatBizNum(t.corpNum) : null, t.ceoName].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
                {items.length > 0 && <div className="mx-3 border-t border-slate-100" />}
              </>
            )}

            {/* 일반 거래처 목록 */}
            <div className="max-h-[240px] overflow-y-auto">
              {loading && (
                <div className="px-3 py-4 text-center text-[12px] text-slate-400">불러오는 중…</div>
              )}
              {!loading && items.length === 0 && matchedTenants.length === 0 && (
                <div className="px-3 py-4 text-center text-[12px] text-slate-400">검색 결과가 없습니다</div>
              )}
              {!loading && items.map((buyer) => (
                <button
                  key={buyer.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  onClick={() => handlePick(buyer)}
                >
                  <div className="text-[13px] font-medium text-slate-800">{buyer.corpName}</div>
                  <div className="text-[12px] text-[#64748B]">
                    {[formatBizNum(buyer.bizNumber), buyer.ceoName].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))}
            </div>

            {/* 푸터 — 거래처 관리 */}
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                className="text-[11px] text-[#64748B] hover:text-slate-900 focus-visible:outline-none"
                onClick={openManage}
              >
                거래처 관리
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 거래처 관리 모달 */}
      {manageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeManage(); }}
        >
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">
                {mode === 'list' && '거래처 관리'}
                {mode === 'add' && '거래처 추가'}
                {mode === 'edit' && '거래처 수정'}
              </h2>
              <button
                onClick={closeManage}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* 목록 모드 */}
              {mode === 'list' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        value={manageQ}
                        onChange={(e) => setManageQ(e.target.value)}
                        placeholder="상호 또는 사업자번호 검색"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMode('add'); setSaveError(''); }}
                      className="px-3 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                      + 추가
                    </button>
                  </div>

                  {manageLoading && <div className="text-center py-8 text-sm text-slate-400">불러오는 중…</div>}
                  {!manageLoading && manageError && <div className="text-center py-8 text-sm text-red-500">{manageError}</div>}
                  {!manageLoading && !manageError && manageItems.length === 0 && (
                    <div className="text-center py-10 text-sm text-slate-400">
                      {manageQ ? '검색 결과가 없습니다.' : '저장된 거래처가 없습니다. + 추가를 눌러 등록하세요.'}
                    </div>
                  )}
                  {!manageLoading && manageItems.map((buyer) => (
                    <div key={buyer.id} className="flex items-start gap-2 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group">
                      <button
                        type="button"
                        className="flex-1 text-left min-w-0"
                        onClick={() => { handlePick(buyer); closeManage(); }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-800">{buyer.corpName}</span>
                          <span className="text-xs text-slate-400">{formatBizNum(buyer.bizNumber)}</span>
                          {buyer.useCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{buyer.useCount}회</span>
                          )}
                        </div>
                        {(buyer.ceoName || buyer.addr) && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            {[buyer.ceoName, buyer.addr].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditTarget(buyer); setMode('edit'); setSaveError(''); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                          title="수정"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(buyer); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                          title="삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 추가 / 수정 모드 */}
              {(mode === 'add' || mode === 'edit') && (
                <BuyerEditForm
                  initial={editTarget ?? undefined}
                  onSave={handleSave}
                  onCancel={() => { setMode('list'); setEditTarget(null); setSaveError(''); }}
                  saving={saving}
                  error={saveError}
                />
              )}
            </div>

            {/* 삭제 확인 오버레이 */}
            {deleteTarget && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-t-2xl sm:rounded-2xl">
                <div className="bg-white rounded-xl shadow-xl p-5 mx-4 w-full max-w-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">거래처 삭제</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    <strong>{deleteTarget.corpName}</strong> ({formatBizNum(deleteTarget.bizNumber)})을(를) 삭제하시겠습니까?
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:pointer-events-none"
                    >
                      {deleting ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
