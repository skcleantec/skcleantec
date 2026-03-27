import { useState, useEffect, useCallback } from 'react';
import { getToken } from '../../stores/auth';
import {
  getAllProfessionalOptions,
  createProfessionalOption,
  updateProfessionalOption,
  deleteProfessionalOption,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';

/** 발주서 설정 탭 — 전문 시공 옵션 CRUD (고객 발주서·스케줄 동그라미와 동일 데이터) */
export function AdminOrderFormSpecialtySettingsPage() {
  const token = getToken();
  const [items, setItems] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newPriceHint, setNewPriceHint] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [newColor, setNewColor] = useState('#2563eb');
  const [newSortOrder, setNewSortOrder] = useState('0');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    label: '',
    priceHint: '',
    emoji: '',
    color: '#2563eb',
    sortOrder: '0',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getAllProfessionalOptions(token);
      setItems(list);
    } catch {
      setError('목록을 불러올 수 없습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!token || !newLabel.trim()) {
      setError('항목명을 입력해주세요.');
      return;
    }
    setError(null);
    try {
      await createProfessionalOption(token, {
        label: newLabel.trim(),
        priceHint: newPriceHint.trim() || undefined,
        emoji: newEmoji.trim() || undefined,
        color: newColor,
        sortOrder: parseInt(newSortOrder, 10) || 0,
      });
      setNewLabel('');
      setNewPriceHint('');
      setNewEmoji('');
      setNewColor('#2563eb');
      setNewSortOrder('0');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    }
  };

  const handleToggle = async (opt: ProfessionalSpecialtyOptionDto) => {
    if (!token) return;
    setError(null);
    try {
      await updateProfessionalOption(token, opt.id, { isActive: !opt.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    }
  };

  const handleDelete = async (opt: ProfessionalSpecialtyOptionDto) => {
    if (!token) return;
    if (
      !confirm(
        `"${opt.label}" 항목을 삭제할까요? 이미 접수에 저장된 선택은 스케줄에서 회색 점으로만 보일 수 있습니다.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteProfessionalOption(token, opt.id);
      if (editingId === opt.id) setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const startEdit = (opt: ProfessionalSpecialtyOptionDto) => {
    setEditingId(opt.id);
    setEditDraft({
      label: opt.label,
      priceHint: opt.priceHint,
      emoji: opt.emoji ?? '',
      color: opt.color,
      sortOrder: String(opt.sortOrder),
    });
  };

  const saveEdit = async () => {
    if (!token || !editingId) return;
    if (!editDraft.label.trim()) {
      setError('항목명을 입력해주세요.');
      return;
    }
    setError(null);
    try {
      await updateProfessionalOption(token, editingId, {
        label: editDraft.label.trim(),
        priceHint: editDraft.priceHint.trim(),
        emoji: editDraft.emoji.trim(),
        color: editDraft.color,
        sortOrder: parseInt(editDraft.sortOrder, 10) || 0,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  };

  if (!token) {
    return <p className="text-sm text-gray-600">로그인이 필요합니다.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="p-4 bg-white border border-gray-200 rounded">
        <h2 className="text-base font-medium text-gray-900 mb-2">전문 시공 옵션</h2>
        <p className="text-sm text-gray-600 mb-4">
          항목명·금액 안내 문구·색상을 설정합니다. <strong>활성</strong>인 항목만 고객 발주서에 표시되며,
          스케줄 표에서는 선택된 항목 색의 작은 동그라미로 표시됩니다. 정렬 숫자가 작을수록 위에
          나옵니다.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="border border-gray-200 rounded p-3 bg-gray-50 mb-6">
          <h3 className="text-sm font-medium text-gray-800 mb-3">새 항목 추가</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">항목명</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="예: 새집증후군"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-600 mb-1">금액 안내</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newPriceHint}
                onChange={(e) => setNewPriceHint(e.target.value)}
                placeholder="예: 150,000원~"
              />
            </div>
            <div className="w-16">
              <label className="block text-xs text-gray-600 mb-1">이모지</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                placeholder="🟢"
                maxLength={8}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">색</label>
              <div className="flex gap-1 items-center">
                <input
                  type="color"
                  className="h-9 w-10 border border-gray-300 rounded cursor-pointer p-0.5 bg-white"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  aria-label="색상"
                />
                <input
                  type="text"
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="#2563eb"
                />
              </div>
            </div>
            <div className="w-20">
              <label className="block text-xs text-gray-600 mb-1">순서</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="px-4 py-2 bg-gray-800 text-white text-sm rounded"
            >
              추가
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((opt) => (
              <li
                key={opt.id}
                className="border border-gray-200 rounded p-3 bg-white"
              >
                {editingId === opt.id ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        className="flex-1 min-w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                        value={editDraft.label}
                        onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                        value={editDraft.priceHint}
                        onChange={(e) => setEditDraft((d) => ({ ...d, priceHint: e.target.value }))}
                        placeholder="금액 안내"
                      />
                      <input
                        type="text"
                        className="w-14 px-1 py-1.5 border border-gray-300 rounded text-sm text-center"
                        value={editDraft.emoji}
                        onChange={(e) => setEditDraft((d) => ({ ...d, emoji: e.target.value }))}
                        placeholder="🟢"
                        maxLength={8}
                        aria-label="이모지"
                      />
                      <input
                        type="color"
                        className="h-9 w-10 border border-gray-300 rounded"
                        value={editDraft.color}
                        onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                        aria-label="색상"
                      />
                      <input
                        type="text"
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                        value={editDraft.color}
                        onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                      />
                      <input
                        type="number"
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm"
                        value={editDraft.sortOrder}
                        onChange={(e) => setEditDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-gray-300 text-sm rounded"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0 mt-1 border border-gray-300"
                        style={{ backgroundColor: opt.color }}
                        aria-hidden
                      />
                      <div>
                        <p className={`text-sm font-medium ${opt.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {opt.emoji ? <span className="mr-1">{opt.emoji}</span> : null}
                          {opt.label}
                        </p>
                        {opt.priceHint ? (
                          <p className="text-xs text-gray-500">({opt.priceHint})</p>
                        ) : null}
                        <p className="text-xs text-gray-400 mt-0.5">
                          순서 {opt.sortOrder} · ID {opt.id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(opt)}
                        className="text-xs text-gray-700 px-2 py-1 border border-gray-300 rounded"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(opt)}
                        className="text-xs text-gray-600 px-2 py-1 border border-gray-300 rounded"
                      >
                        {opt.isActive ? '비활성' : '활성'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(opt)}
                        className="text-xs text-red-600 px-2 py-1 border border-red-200 rounded"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500">등록된 항목이 없습니다. 위에서 추가해 주세요.</p>
        )}
      </section>
    </div>
  );
}
