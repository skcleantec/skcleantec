import { useState, useEffect } from 'react';
import { getCsReports, updateCsReport, type CsReport } from '../../api/cs';
import { getToken } from '../../stores/auth';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '접수' },
  { value: 'PROCESSING', label: '처리중' },
  { value: 'DONE', label: '완료' },
];

export function AdminCsPage() {
  const token = getToken();
  const [items, setItems] = useState<CsReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CsReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    getCsReports(token)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [token]);

  const openDetail = (item: CsReport) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
  };

  const closeDetail = () => {
    setSelected(null);
  };

  const handleSave = async () => {
    if (!token || !selected) return;
    setSaving(true);
    try {
      const updated = await updateCsReport(token, selected.id, { status: editStatus, memo: editMemo });
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const csLink = `${window.location.origin}/cs`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">C/S 관리</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">고객 링크:</span>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded">{csLink}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(csLink)}
            className="text-sm px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          >
            복사
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4 bg-gray-50 px-3 py-2 rounded">
        고객에게 아래와 같이 안내하실 수 있습니다. 링크를 복사해 메시지에 붙여 넣어 주세요.
        <br />
        <strong>예시:</strong> "불편 사항이 있으시면 아래 링크에서 접수해 주세요. 사진 첨부가 가능합니다. [링크]"
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">접수된 C/S가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center p-3 font-medium text-gray-700">날짜</th>
                <th className="text-center p-3 font-medium text-gray-700">성함</th>
                <th className="text-center p-3 font-medium text-gray-700">연락처</th>
                <th className="text-center p-3 font-medium text-gray-700">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetail(item)}
                >
                  <td className="p-3 text-[11px] text-gray-700 tabular-nums whitespace-nowrap">
                    {formatDateTimeCompactWithWeekday(item.createdAt)}
                  </td>
                  <td className="p-3">{item.customerName}</td>
                  <td className="p-3">{item.customerPhone}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        item.status === 'DONE' ? 'bg-green-100 text-green-800' : item.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_OPTIONS.find((s) => s.value === item.status)?.label ?? item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={closeDetail} />
            <div className="p-4 border-b pr-12">
              <h2 className="font-semibold">C/S 상세</h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <span className="text-gray-500 text-sm">성함</span>
                <p className="font-medium">{selected.customerName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">연락처</span>
                <p className="font-medium">{selected.customerPhone}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">내용</span>
                <p className="whitespace-pre-wrap text-sm">{selected.content}</p>
              </div>
              {selected.imageUrls?.length ? (
                <div>
                  <span className="text-gray-500 text-sm block mb-2">첨부 사진</span>
                  <div className="flex flex-wrap gap-2">
                    {selected.imageUrls.map((url, i) => (
                      <ImageThumbLightbox
                        key={i}
                        src={url}
                        alt={`첨부 ${i + 1}`}
                        thumbClassName="w-6 h-6 object-cover rounded border border-gray-200"
                        buttonClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                  placeholder="내부 메모"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
