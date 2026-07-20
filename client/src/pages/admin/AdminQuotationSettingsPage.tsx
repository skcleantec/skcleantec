import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createQuotationServiceItem,
  deleteQuotationServiceItem,
  fetchQuotationConfig,
  listQuotationServiceItems,
  moveQuotationServiceItem,
  updateQuotationConfig,
  updateQuotationServiceItem,
  type QuotationServiceItemDto,
} from '../../api/quotations';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { qUi } from '../../components/quotations/quotationUi';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const HELP =
  '견적서 작성 시 불러올 서비스 항목(이름·단가)을 등록합니다.\n' +
  '발주서 견적 옵션과 별도로 관리됩니다.\n' +
  '삭제 시 로그인 비밀번호 확인이 필요합니다.';

function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type FormState = { name: string; unitPrice: string; description: string; isActive: boolean };

function emptyForm(): FormState {
  return { name: '', unitPrice: '', description: '', isActive: true };
}

export function AdminQuotationSettingsPage() {
  const token = getToken();
  const [items, setItems] = useState<QuotationServiceItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationServiceItemDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuotationServiceItemDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [footerNotice, setFooterNotice] = useState('');
  const [receiptFooterNotice, setReceiptFooterNotice] = useState('');
  const [defaultEmailSubject, setDefaultEmailSubject] = useState('');
  const [defaultEmailBody, setDefaultEmailBody] = useState('');
  const [defaultValidDays, setDefaultValidDays] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, config] = await Promise.all([
        listQuotationServiceItems(token, { includeInactive: true }),
        fetchQuotationConfig(token),
      ]);
      setItems(list);
      setFooterNotice(config.footerNotice ?? '');
      setReceiptFooterNotice(config.receiptFooterNotice ?? '');
      setDefaultEmailSubject(config.defaultEmailSubject ?? '');
      setDefaultEmailBody(config.defaultEmailBody ?? '');
      setDefaultValidDays(
        config.defaultValidDays != null ? String(config.defaultValidDays) : '',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: QuotationServiceItemDto) {
    setEditing(row);
    setForm({
      name: row.name,
      unitPrice: String(row.unitPrice),
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (!form.name.trim()) {
      alert('서비스명을 입력해 주세요.');
      return;
    }
    const unitPrice = parsePriceInt(form.unitPrice);
    if (unitPrice == null) {
      alert('단가(원)를 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateQuotationServiceItem(token, editing.id, {
          name: form.name.trim(),
          unitPrice,
          description: form.description.trim() || null,
          isActive: form.isActive,
        });
      } else {
        await createQuotationServiceItem(token, {
          name: form.name.trim(),
          unitPrice,
          description: form.description.trim() || null,
          sortOrder: items.length,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConfig() {
    if (!token) return;
    const daysRaw = defaultValidDays.trim();
    let defaultValidDaysVal: number | null = null;
    if (daysRaw) {
      const n = parseInt(daysRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        alert('기본 유효기간(일)을 올바르게 입력해 주세요.');
        return;
      }
      defaultValidDaysVal = n;
    }
    setConfigSaving(true);
    try {
      await updateQuotationConfig(token, {
        footerNotice: footerNotice.trim() || null,
        receiptFooterNotice: receiptFooterNotice.trim() || null,
        defaultEmailSubject: defaultEmailSubject.trim() || null,
        defaultEmailBody: defaultEmailBody.trim() || null,
        defaultValidDays: defaultValidDaysVal,
      });
      alert('서식 설정을 저장했습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    if (!token) return;
    setMovingId(id);
    try {
      const list = await moveQuotationServiceItem(token, id, direction);
      setItems(list);
    } catch (e) {
      alert(e instanceof Error ? e.message : '순서 변경에 실패했습니다.');
    } finally {
      setMovingId(null);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await deleteQuotationServiceItem(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={qUi.pageRootNarrow}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={qUi.breadcrumb}>
            <Link to="/admin/inquiries/quotations" className={qUi.breadcrumbLink}>
              견적 목록
            </Link>
            {' · '}
            설정
          </p>
          <div className="flex items-center gap-2">
            <h1 className={qUi.pageTitle}>견적 설정</h1>
            <HelpTooltip text={HELP} />
          </div>
          <p className={qUi.pageDesc}>
            PDF 서식·이메일 기본값과 견적 작성 시 사용할 서비스 항목 카탈로그를 관리합니다.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={`${qUi.btnPrimary} shrink-0`}>
          + 항목 추가
        </button>
      </div>

      {error && <p className={qUi.alertError} role="alert">{error}</p>}

      <section className={`${qUi.cardBody} space-y-5`}>
        <div>
          <h2 className={qUi.sectionTitle}>PDF 서식</h2>
          <p className={`${qUi.sectionSubtitle} mt-0.5`}>견적서 PDF와 이메일 발송 기본값입니다.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-fluid-xs text-slate-600">
          문서 제목은 선택한 <strong className="font-semibold text-slate-800">영업 브랜드명 + 견적서/영수증</strong>
          로 자동 표시됩니다. (예: SK클린텍 견적서)
        </div>

        <label className="block">
          <span className={qUi.label}>견적서 하단 고정 안내</span>
          <textarea
            className={qUi.textarea}
            rows={3}
            placeholder="예: 본 견적은 발행일로부터 7일간 유효합니다."
            value={footerNotice}
            onChange={(e) => setFooterNotice(e.target.value)}
          />
        </label>

        <label className="block">
          <span className={qUi.label}>영수증 하단 고정 안내</span>
          <textarea
            className={qUi.textarea}
            rows={3}
            placeholder="예: 위 금액을 정히 영수함."
            value={receiptFooterNotice}
            onChange={(e) => setReceiptFooterNotice(e.target.value)}
          />
        </label>

        <label className="block sm:max-w-xs">
          <span className={qUi.label}>새 견적 기본 유효기간(일)</span>
          <input
            className={qUi.input}
            inputMode="numeric"
            placeholder="비워 두면 미적용"
            value={defaultValidDays}
            onChange={(e) => setDefaultValidDays(e.target.value)}
          />
        </label>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">이메일 기본값</h3>
            <p className="text-fluid-2xs text-slate-500 mt-1">
              치환: {'{{customerName}}'}, {'{{quoteNumber}}'}, {'{{total}}'}, {'{{companyName}}'},{' '}
              {'{{validUntil}}'}, {'{{documentLabel}}'} (견적서·영수증)
            </p>
          </div>

          <label className="block">
            <span className={qUi.label}>기본 제목</span>
            <input
              className={qUi.input}
              placeholder="비워 두면 시스템 기본값"
              maxLength={200}
              value={defaultEmailSubject}
              onChange={(e) => setDefaultEmailSubject(e.target.value)}
            />
          </label>

          <label className="block">
            <span className={qUi.label}>기본 본문</span>
            <textarea
              className={qUi.textarea}
              rows={5}
              placeholder="비워 두면 시스템 기본값"
              value={defaultEmailBody}
              onChange={(e) => setDefaultEmailBody(e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          disabled={configSaving || loading}
          onClick={() => void handleSaveConfig()}
          className={qUi.btnPrimary}
        >
          {configSaving ? '저장 중…' : '서식 저장'}
        </button>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className={qUi.sectionTitle}>서비스 항목</h2>
          <p className={`${qUi.sectionSubtitle} mt-0.5`}>
            견적 작성 시 카탈로그에서 불러올 항목입니다. 순서는 ↑↓로 조정합니다.
          </p>
        </div>

        <div className={qUi.card}>
          {loading ? (
            <p className={qUi.emptyState}>불러오는 중…</p>
          ) : items.length === 0 ? (
            <div className={qUi.emptyState}>
              <p>등록된 서비스 항목이 없습니다.</p>
              <button type="button" onClick={openCreate} className={`${qUi.btnPrimary} mt-4`}>
                첫 항목 추가
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((row, idx) => (
                <li
                  key={row.id}
                  className={`px-4 py-4 sm:px-5 flex flex-wrap gap-3 items-center ${!row.isActive ? 'opacity-60 bg-slate-50/50' : ''}`}
                >
                  <span className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={movingId != null || idx === 0}
                      onClick={() => void handleMove(row.id, 'up')}
                      className={`${qUi.btnChip} !px-2 !py-0.5`}
                      aria-label="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={movingId != null || idx === items.length - 1}
                      onClick={() => void handleMove(row.id, 'down')}
                      className={`${qUi.btnChip} !px-2 !py-0.5`}
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                  </span>

                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{row.name}</span>
                      {!row.isActive && (
                        <span className="text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="text-fluid-sm text-slate-600 mt-0.5 tabular-nums">
                      {row.unitPrice.toLocaleString('ko-KR')}원
                    </p>
                    {row.description && (
                      <p className="text-fluid-xs text-slate-500 mt-0.5">{row.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => openEdit(row)} className={qUi.btnSecondary}>
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(row);
                        setDeletePassword('');
                      }}
                      className={qUi.btnDanger}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {modalOpen && (
        <div
          className={qUi.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <div
            className={`${qUi.modalPanel} max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setModalOpen(false)} disabled={saving} />
            <div className={qUi.modalHeader}>
              <h2 className="font-semibold text-slate-900">{editing ? '항목 수정' : '항목 추가'}</h2>
            </div>
            <div className="p-4 space-y-4">
              <label className="block">
                <span className={qUi.label}>서비스명 *</span>
                <input
                  className={qUi.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className={qUi.label}>단가(원) *</span>
                <input
                  className={qUi.input}
                  inputMode="numeric"
                  value={form.unitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className={qUi.label}>설명 (선택)</span>
                <textarea
                  className={qUi.textarea}
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              {editing && (
                <label className="flex items-center gap-2 text-fluid-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  사용 중
                </label>
              )}
            </div>
            <div className={qUi.modalFooter}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className={qUi.btnSecondary}
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className={qUi.btnPrimary}
              >
                {saving ? '저장 중…' : editing ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className={qUi.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setDeleteTarget(null);
          }}
        >
          <div className={`${qUi.modalPanel} sm:max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <ModalCloseButton onClick={() => setDeleteTarget(null)} disabled={saving} />
            <div className={qUi.modalHeader}>
              <h2 className="font-semibold text-rose-700">항목 삭제</h2>
            </div>
            <div className="p-4">
              <p className="text-fluid-sm text-slate-600 mb-3">
                「{deleteTarget.name}」을(를) 삭제합니다. 비밀번호를 입력해 주세요.
              </p>
              <label className="block">
                <span className={qUi.label}>로그인 비밀번호</span>
                <input
                  type="password"
                  className={qUi.input}
                  placeholder="비밀번호 입력"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </label>
            </div>
            <div className={qUi.modalFooter}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteTarget(null)}
                className={qUi.btnSecondary}
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
