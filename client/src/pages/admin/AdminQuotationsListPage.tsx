import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  deleteQuotation,
  listQuotations,
  type QuotationDto,
  type QuotationStatus,
} from '../../api/quotations';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';

const PAGE_SIZE = 30;

const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: '작성 중',
  FINALIZED: '확정',
  SENT: '발송됨',
};

export function AdminQuotationsListPage() {
  const token = getToken();
  const [items, setItems] = useState<QuotationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<QuotationDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listQuotations(token, {
        limit: PAGE_SIZE,
        offset,
        customerName: appliedSearch || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, offset, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setAppliedSearch(searchName.trim());
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteQuotation(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">견적서</h1>
        <Link
          to="/admin/inquiries/quotations/new"
          className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 견적서
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded px-2 py-1.5 text-sm"
          placeholder="상대 이름 검색"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <button type="submit" className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
          검색
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">견적서가 없습니다.</p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2">견적번호</th>
                  <th className="px-3 py-2">상대</th>
                  <th className="px-3 py-2">합계</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">작성일</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{row.quoteNumber}</td>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2">{row.total.toLocaleString('ko-KR')}원</td>
                    <td className="px-3 py-2">{STATUS_LABEL[row.status]}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/inquiries/quotations/${row.id}`}
                        className="text-blue-600 hover:underline mr-2"
                      >
                        열기
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(row);
                          setDeletePassword('');
                        }}
                        className="text-red-600 hover:underline text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="sm:hidden space-y-2">
            {items.map((row) => (
              <li key={row.id} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{row.customerName}</span>
                  <span className="text-xs text-gray-500">{STATUS_LABEL[row.status]}</span>
                </div>
                <div className="text-xs font-mono text-gray-500 mt-0.5">{row.quoteNumber}</div>
                <div className="text-sm mt-1">{row.total.toLocaleString('ko-KR')}원</div>
                <div className="flex gap-2 mt-2">
                  <Link
                    to={`/admin/inquiries/quotations/${row.id}`}
                    className="text-sm text-blue-600"
                  >
                    열기
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(row);
                      setDeletePassword('');
                    }}
                    className="text-sm text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4 text-sm">
              <button
                type="button"
                disabled={offset <= 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                이전
              </button>
              <span>
                {page} / {totalPages} ({total}건)
              </span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-xl sm:rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-red-700">견적서 삭제</h2>
              <ModalCloseButton onClick={() => setDeleteTarget(null)} />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {deleteTarget.quoteNumber} — {deleteTarget.customerName}
            </p>
            <input
              type="password"
              className="w-full border rounded px-2 py-1.5 text-sm mb-3"
              placeholder="로그인 비밀번호"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="w-full py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제 확인'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
