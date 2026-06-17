import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createQuotation,
  downloadQuotationPdf,
  getQuotation,
  listQuotationServiceItems,
  sendQuotationEmail,
  updateQuotation,
  type QuotationLineItemDto,
  type QuotationServiceItemDto,
} from '../../api/quotations';

type EditableLine = {
  key: string;
  catalogItemId: string | null;
  label: string;
  unitPrice: string;
  quantity: string;
};

function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseQty(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function newLineKey(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLine(catalog?: QuotationServiceItemDto): EditableLine {
  return {
    key: newLineKey(),
    catalogItemId: catalog?.id ?? null,
    label: catalog?.name ?? '',
    unitPrice: catalog ? String(catalog.unitPrice) : '',
    quantity: '1',
  };
}

export function AdminQuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const token = getToken();

  const [catalog, setCatalog] = useState<QuotationServiceItemDto[]>([]);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const items = await listQuotationServiceItems(token);
      setCatalog(items);
    } catch {
      /* catalog optional */
    }
  }, [token]);

  const loadQuotation = useCallback(async () => {
    if (!token || isNew || !id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getQuotation(token, id);
      setQuoteNumber(row.quoteNumber);
      setStatus(row.status);
      setCustomerName(row.customerName);
      setCustomerPhone(row.customerPhone ?? '');
      setCustomerEmail(row.customerEmail ?? '');
      setEmailTo(row.customerEmail ?? '');
      setCustomerAddress(row.customerAddress ?? '');
      setMemo(row.memo ?? '');
      setDiscountAmount(row.discountAmount > 0 ? String(row.discountAmount) : '');
      setValidUntil(row.validUntil ?? '');
      setLines(
        row.lineItems.length > 0
          ? row.lineItems.map((li) => ({
              key: li.id ?? newLineKey(),
              catalogItemId: li.catalogItemId ?? null,
              label: li.label,
              unitPrice: String(li.unitPrice),
              quantity: String(li.quantity),
            }))
          : [emptyLine()],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적서를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, isNew, id]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadQuotation();
  }, [loadQuotation]);

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const li of lines) {
      const p = parsePriceInt(li.unitPrice);
      const q = parseQty(li.quantity);
      if (p != null && q != null) subtotal += p * q;
    }
    const disc = parsePriceInt(discountAmount) ?? 0;
    return { subtotal, total: Math.max(0, subtotal - disc) };
  }, [lines, discountAmount]);

  function buildLinePayload(): QuotationLineItemDto[] | null {
    const out: QuotationLineItemDto[] = [];
    for (const li of lines) {
      if (!li.label.trim()) continue;
      const unitPrice = parsePriceInt(li.unitPrice);
      const quantity = parseQty(li.quantity);
      if (unitPrice == null || quantity == null) return null;
      out.push({
        catalogItemId: li.catalogItemId,
        label: li.label.trim(),
        unitPrice,
        quantity,
      });
    }
    return out;
  }

  async function handleSave(finalize = false) {
    if (!token) return;
    if (!customerName.trim()) {
      alert('상대 이름을 입력해 주세요.');
      return;
    }
    const lineItems = buildLinePayload();
    if (lineItems == null) {
      alert('단가·수량을 올바르게 입력해 주세요.');
      return;
    }
    if (lineItems.length === 0) {
      alert('견적 항목을 1개 이상 추가해 주세요.');
      return;
    }

    const disc = parsePriceInt(discountAmount) ?? 0;
    setSaving(true);
    try {
      const body = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim() || null,
        memo: memo.trim() || null,
        discountAmount: disc,
        validUntil: validUntil.trim() || null,
        lineItems,
        ...(finalize ? { status: 'FINALIZED' as const } : {}),
      };

      if (isNew) {
        const created = await createQuotation(token, body);
        navigate(`/admin/inquiries/quotations/${created.id}`, { replace: true });
      } else if (id) {
        const updated = await updateQuotation(token, id, body);
        setQuoteNumber(updated.quoteNumber);
        setStatus(updated.status);
        alert('저장되었습니다.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!token || isNew || !id) {
      alert('먼저 저장해 주세요.');
      return;
    }
    try {
      const blob = await downloadQuotationPdf(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적서_${quoteNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 다운로드에 실패했습니다.');
    }
  }

  async function handleSendEmail() {
    if (!token || isNew || !id) {
      alert('먼저 저장해 주세요.');
      return;
    }
    const to = emailTo.trim() || customerEmail.trim();
    if (!to) {
      alert('수신 이메일을 입력해 주세요.');
      return;
    }
    setSendingEmail(true);
    try {
      const updated = await sendQuotationEmail(token, id, to);
      setStatus(updated.status);
      setCustomerEmail(updated.customerEmail ?? to);
      alert('이메일을 발송했습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '이메일 발송에 실패했습니다.');
    } finally {
      setSendingEmail(false);
    }
  }

  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    setLines((prev) => [...prev, emptyLine(item)]);
  }

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 sm:px-4 pb-24">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/admin/inquiries/quotations" className="text-sm text-blue-600 hover:underline">
          ← 목록
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 ml-1">
          {isNew ? '새 견적서' : quoteNumber ?? '견적서'}
        </h1>
        {!isNew && status === 'SENT' && (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">발송됨</span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <section className="space-y-3 mb-6">
        <label className="block text-sm">
          <span className="text-gray-700">상대 이름 *</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-700">연락처</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">이메일</span>
            <input
              type="email"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">주소</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">유효기간</span>
          <input
            type="date"
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>
      </section>

      <section className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="font-medium text-gray-900">견적 항목</h2>
          {catalog.length > 0 && (
            <select
              className="text-sm border rounded px-2 py-1 ml-auto max-w-[200px]"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addFromCatalog(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">카탈로그에서 추가…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.unitPrice.toLocaleString()}원)
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
          >
            + 행 추가
          </button>
        </div>

        <ul className="space-y-2">
          {lines.map((li, idx) => (
            <li key={li.key} className="border rounded-lg p-2 bg-white">
              <div className="flex gap-2 items-start">
                <span className="text-xs text-gray-400 pt-2 w-5">{idx + 1}</span>
                <div className="flex-1 grid gap-2 sm:grid-cols-4">
                  <input
                    className="sm:col-span-2 border rounded px-2 py-1 text-sm"
                    placeholder="항목명"
                    value={li.label}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === li.key ? { ...row, label: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="단가"
                    inputMode="numeric"
                    value={li.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === li.key ? { ...row, unitPrice: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    placeholder="수량"
                    inputMode="numeric"
                    value={li.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === li.key ? { ...row, quantity: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={lines.length <= 1}
                  onClick={() => setLines((prev) => prev.filter((row) => row.key !== li.key))}
                  className="text-xs text-red-600 px-1 disabled:opacity-30"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border rounded-lg p-3 bg-gray-50 mb-6 text-sm space-y-1">
        <div className="flex justify-between">
          <span>소계</span>
          <span>{totals.subtotal.toLocaleString('ko-KR')}원</span>
        </div>
        <label className="flex justify-between items-center gap-2">
          <span>할인</span>
          <input
            className="w-28 border rounded px-2 py-1 text-right"
            inputMode="numeric"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
          />
        </label>
        <div className="flex justify-between font-semibold text-base pt-1 border-t">
          <span>합계 (VAT 별도)</span>
          <span>{totals.total.toLocaleString('ko-KR')}원</span>
        </div>
      </section>

      <label className="block text-sm mb-6">
        <span className="text-gray-700">비고</span>
        <textarea
          className="mt-1 w-full border rounded px-2 py-1.5"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      {!isNew && (
        <section className="border rounded-lg p-3 mb-6">
          <h2 className="font-medium text-sm mb-2">이메일 발송</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              className="flex-1 min-w-[160px] border rounded px-2 py-1.5 text-sm"
              placeholder="수신 이메일"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
            />
            <button
              type="button"
              disabled={sendingEmail}
              onClick={() => void handleSendEmail()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
            >
              {sendingEmail ? '발송 중…' : 'PDF 첨부 발송'}
            </button>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex flex-wrap gap-2 justify-center sm:static sm:border-0 sm:p-0 sm:justify-start">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave(false)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave(true)}
          className="px-4 py-2 border rounded text-sm disabled:opacity-50"
        >
          확정 저장
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            className="px-4 py-2 border rounded text-sm"
          >
            PDF 다운로드
          </button>
        )}
      </div>
    </div>
  );
}
