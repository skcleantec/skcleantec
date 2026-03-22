import { useState, useEffect } from 'react';
import { getInquiries, updateInquiry } from '../../api/inquiries';
import { assignInquiry } from '../../api/assignments';
import { getTeamLeaders, type TeamLeader } from '../../api/users';
import { getToken } from '../../stores/auth';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

interface InquiryItem {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  status: string;
  source: string | null;
  memo: string | null;
  claimMemo: string | null;
  createdAt: string;
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
}

export function AdminInquiriesPage() {
  const token = getToken();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [editItem, setEditItem] = useState<InquiryItem | null>(null);
  const [editForm, setEditForm] = useState({ preferredDate: '', preferredTime: '', memo: '', teamLeaderId: '', status: '' });
  const [claimItem, setClaimItem] = useState<InquiryItem | null>(null);
  const [claimMemo, setClaimMemo] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const refresh = (showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    getInquiries(token, Object.keys(params).length ? params : undefined)
      .then((res: { items: InquiryItem[]; total: number }) => {
        setItems(res.items);
        setTotal(res.total);
        setApiError(null);
      })
      .catch((err) => {
        setItems([]);
        setTotal(0);
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => refresh(true), searchQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [token, statusFilter, searchQuery]);

  const handleAssign = async (inquiryId: string, teamLeaderId: string) => {
    if (!token || !teamLeaderId) return;
    setAssigningId(inquiryId);
    try {
      await assignInquiry(token, inquiryId, teamLeaderId);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '분배에 실패했습니다.');
    } finally {
      setAssigningId(null);
    }
  };

  const openEdit = (item: InquiryItem) => {
    setEditItem(item);
    setEditForm({
      preferredDate: item.preferredDate ? item.preferredDate.slice(0, 10) : '',
      preferredTime: item.preferredTime || '',
      memo: item.memo || '',
      teamLeaderId: item.assignments[0]?.teamLeader?.id ?? '',
      status: item.status,
    });
  };

  const openClaim = (item: InquiryItem) => {
    setClaimItem(item);
    setClaimMemo(item.claimMemo || '');
  };

  const handleSaveClaim = async () => {
    if (!token || !claimItem) return;
    setSaving(true);
    try {
      await updateInquiry(token, claimItem.id, {
        claimMemo: claimMemo || null,
        status: 'CS_PROCESSING',
      });
      setClaimItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    if (!token) return;
    setSaving(true);
    try {
      await updateInquiry(token, inquiryId, { status: newStatus });
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!token || !editItem) return;
    setSaving(true);
    try {
      await updateInquiry(token, editItem.id, {
        preferredDate: editForm.preferredDate || null,
        preferredTime: editForm.preferredTime || null,
        memo: editForm.memo || null,
        status: editForm.status || undefined,
      });
      if (editForm.teamLeaderId) {
        await assignInquiry(token, editItem.id, editForm.teamLeaderId);
      }
      setEditItem(null);
      refresh(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatRoomInfo = (r: number | null, b: number | null, v: number | null) => {
    const parts = [];
    if (r != null) parts.push(`${r}방`);
    if (b != null) parts.push(`${b}화`);
    if (v != null) parts.push(`${v}베`);
    return parts.length ? parts.join(' ') : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-800">문의 목록</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="고객명·연락처 검색"
            className="px-3 py-2 border border-gray-300 rounded text-sm flex-1 min-w-0"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 문의가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-100 z-10 border-r border-gray-200">접수일</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">고객</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">연락처</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 min-w-[90px]">주소</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">평수</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">방화베</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">예약일</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">상태</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">담당</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-2 px-2 font-medium text-gray-900 whitespace-nowrap">
                      {item.customerName}
                      {item.claimMemo && (
                        <span className="ml-1 text-orange-600" title={item.claimMemo}>●</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap break-all">{item.customerPhone}</td>
                    <td className="py-2 px-2 text-gray-600 min-w-[90px] max-w-[130px] truncate" title={item.address}>
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{item.areaPyeong ?? '-'}</td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                      {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}
                    </td>
                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{formatDate(item.preferredDate)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        disabled={saving}
                        className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[72px]"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.assignments[0]?.teamLeader?.id ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(item.id, v);
                        }}
                        disabled={assigningId === item.id}
                        className="px-2 py-1 border border-gray-300 rounded text-xs min-w-[70px]"
                      >
                        <option value="">선택</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>{tl.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-xs">
                          수정
                        </button>
                        <button onClick={() => openClaim(item)} className="text-orange-600 hover:underline text-xs">
                          클레임
                        </button>
                        {item.status === 'CS_PROCESSING' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'COMPLETED')}
                            disabled={saving}
                            className="text-green-600 hover:underline text-xs font-medium"
                          >
                            완료
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            총 {total}건 · 모바일에서 가로 스크롤 가능
          </div>
        )}
      </div>

      {/* 클레임 등록 모달 */}
      {claimItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              C/S 등록 - {claimItem.customerName}
            </h2>
            <p className="text-xs text-gray-500 mb-2">클레임 내용을 입력하면 상태가 C/S 처리중으로 변경됩니다.</p>
            <textarea
              value={claimMemo}
              onChange={(e) => setClaimMemo(e.target.value)}
              rows={4}
              placeholder="고객 클레임 내용을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveClaim}
                disabled={saving}
                className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : 'C/S 등록'}
              </button>
              <button
                onClick={() => setClaimItem(null)}
                className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              수정 - {editItem.customerName}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약일</label>
                <input
                  type="date"
                  value={editForm.preferredDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">희망 시간대</label>
                <input
                  value={editForm.preferredTime}
                  onChange={(e) => setEditForm((p) => ({ ...p, preferredTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="오전 / 오후"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">상태</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">담당 팀장</label>
                <select
                  value={editForm.teamLeaderId}
                  onChange={(e) => setEditForm((p) => ({ ...p, teamLeaderId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">선택 안 함</option>
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">C/S 내용 (클레임)</label>
                <textarea
                  value={editItem.claimMemo || ''}
                  readOnly
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50"
                  placeholder="없음"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">특이사항</label>
                <textarea
                  value={editForm.memo}
                  onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setEditItem(null)}
                className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
