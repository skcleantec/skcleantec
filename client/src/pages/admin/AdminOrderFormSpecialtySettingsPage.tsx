import { useState, useEffect, useCallback, useMemo } from 'react';
import { getToken } from '../../stores/auth';
import {
  getAllProfessionalOptions,
  createProfessionalOption,
  updateProfessionalOption,
  deleteProfessionalOption,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';
import {
  listProfChildren,
  listProfRootNodes,
  profDepthFromRoot,
} from '../../constants/professionalSpecialtyOptions';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const SPECIALTY_SETTINGS_HELP =
  '① 맨 위「대분류 추가」에서 섹션 제목만 만든 뒤, 생긴 카드 안 맨 아래 「+ 상세 옵션(가격) 추가」를 누르면 항목명·가격(원) 입력란이 열립니다(예: 가전내부분해).\n\n' +
  '② 그 상세 한 줄 아래 들여쓴 영역에서 「+ 하위 금액 항목 추가」로 전자레인지·냉장고처럼 금액 리프를 더 넣을 수 있습니다(최대 3단).\n\n' +
  '고객 발주서에서는 대분류 → 상세 → 금액 순으로 펼쳐서 고릅니다. 이미 만든 단일 루트에도 같은 카드 안에서 상세를 추가할 수 있습니다.';

function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 발주서 설정 탭 — 전문 시공: 대분류 + 상세 옵션(가격) */
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

  const [childParentId, setChildParentId] = useState<string | null>(null);
  const [childLabel, setChildLabel] = useState('');
  const [childPriceHint, setChildPriceHint] = useState('');
  const [childPriceAmount, setChildPriceAmount] = useState('');
  const [childEmoji, setChildEmoji] = useState('');
  const [childColor, setChildColor] = useState('#6b7280');
  const [childSortOrder, setChildSortOrder] = useState('0');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    label: '',
    priceHint: '',
    priceAmount: '',
    emoji: '',
    color: '#2563eb',
    sortOrder: '0',
    isGroup: false,
  });

  const roots = useMemo(() => listProfRootNodes(items), [items]);

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

  const handleAddRoot = async () => {
    if (!token || !newLabel.trim()) {
      setError('항목명을 입력해주세요.');
      return;
    }
    setError(null);
    try {
      await createProfessionalOption(token, {
        label: newLabel.trim(),
        isGroup: true,
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

  const handleAddChild = async (parentId: string) => {
    if (!token || !childLabel.trim()) {
      setError('상세 항목명을 입력해주세요.');
      return;
    }
    setError(null);
    const pa = parsePriceInt(childPriceAmount);
    try {
      await createProfessionalOption(token, {
        parentId,
        label: childLabel.trim(),
        priceHint: childPriceHint.trim() || undefined,
        priceAmount: pa ?? undefined,
        emoji: childEmoji.trim() || undefined,
        color: childColor,
        sortOrder: parseInt(childSortOrder, 10) || 0,
      });
      setChildParentId(null);
      setChildLabel('');
      setChildPriceHint('');
      setChildPriceAmount('');
      setChildEmoji('');
      setChildColor('#6b7280');
      setChildSortOrder('0');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '상세 추가 실패');
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
        `"${opt.label}" 항목을 삭제할까요? 하위 상세가 있으면 함께 삭제됩니다. 이미 접수에 저장된 선택은 스케줄에서 회색 점으로만 보일 수 있습니다.`
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
      priceHint: opt.priceHint ?? '',
      priceAmount: opt.priceAmount != null ? String(opt.priceAmount) : '',
      emoji: opt.emoji ?? '',
      color: opt.color,
      sortOrder: String(opt.sortOrder),
      isGroup: opt.parentId ? false : opt.isGroup,
    });
  };

  const saveEdit = async () => {
    if (!token || !editingId) return;
    if (!editDraft.label.trim()) {
      setError('항목명을 입력해주세요.');
      return;
    }
    setError(null);
    const pa = parsePriceInt(editDraft.priceAmount);
    try {
      await updateProfessionalOption(token, editingId, {
        label: editDraft.label.trim(),
        priceHint: editDraft.priceHint.trim(),
        priceAmount: pa,
        emoji: editDraft.emoji.trim(),
        color: editDraft.color,
        sortOrder: parseInt(editDraft.sortOrder, 10) || 0,
        isGroup: !items.find((x) => x.id === editingId)?.parentId ? editDraft.isGroup : undefined,
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-medium text-gray-900">전문 시공 옵션</h2>
          <HelpTooltip className="shrink-0" text={SPECIALTY_SETTINGS_HELP} />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="border border-gray-200 rounded p-3 bg-gray-50 mb-6">
          <h3 className="text-sm font-medium text-gray-800 mb-1">대분류 추가</h3>
          <p className="text-xs text-gray-500 mb-3">
            섹션 제목만 여기서 만듭니다. 가격·세부 항목은 아래에 생긴 카드 안에서「+ 상세 옵션」으로 넣습니다.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">항목명</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="예: 창호·샷시"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-600 mb-1">보조 안내 (선택)</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newPriceHint}
                onChange={(e) => setNewPriceHint(e.target.value)}
                placeholder="섹션 설명"
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
              onClick={handleAddRoot}
              className="px-4 py-2 bg-gray-800 text-white text-sm rounded"
            >
              추가
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : (
          <ul className="space-y-3">
            {roots.map((root) => {
              const children = listProfChildren(items, root.id);
              const isSection = root.isGroup || children.length > 0;
              return (
                <li
                  key={root.id}
                  className="border border-gray-200 rounded p-3 bg-white"
                >
                  {editingId === root.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          className="flex-1 min-w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                          value={editDraft.label}
                          onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                        />
                        {!root.parentId && (
                          <label className="flex items-center gap-1.5 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={editDraft.isGroup}
                              onChange={(e) => setEditDraft((d) => ({ ...d, isGroup: e.target.checked }))}
                            />
                            대분류
                          </label>
                        )}
                        {!editDraft.isGroup && (
                          <>
                            <input
                              type="text"
                              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right tabular-nums"
                              value={editDraft.priceAmount}
                              onChange={(e) => setEditDraft((d) => ({ ...d, priceAmount: e.target.value }))}
                              placeholder="가격(원)"
                              inputMode="numeric"
                            />
                            <input
                              type="text"
                              className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                              value={editDraft.priceHint}
                              onChange={(e) => setEditDraft((d) => ({ ...d, priceHint: e.target.value }))}
                              placeholder="금액 안내"
                            />
                          </>
                        )}
                        {editDraft.isGroup && (
                          <input
                            type="text"
                            className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                            value={editDraft.priceHint}
                            onChange={(e) => setEditDraft((d) => ({ ...d, priceHint: e.target.value }))}
                            placeholder="보조 안내"
                          />
                        )}
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
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0 mt-1 border border-gray-300"
                            style={{ backgroundColor: root.color }}
                            aria-hidden
                          />
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                root.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                              }`}
                            >
                              {isSection && (
                                <span className="text-xs font-normal text-gray-500 mr-1">[대분류]</span>
                              )}
                              {root.emoji ? <span className="mr-1">{root.emoji}</span> : null}
                              {root.label}
                            </p>
                            {root.isGroup && (
                              <p className="text-xs text-gray-500">섹션 제목 · 하위에서 가격 설정</p>
                            )}
                            {!root.isGroup && (root.priceAmount != null || root.priceHint) && (
                              <p className="text-xs text-gray-500">
                                {root.priceAmount != null && root.priceAmount > 0
                                  ? `${root.priceAmount.toLocaleString('ko-KR')}원`
                                  : ''}
                                {root.priceHint ? (root.priceAmount != null && root.priceAmount > 0 ? ' · ' : '') + root.priceHint : ''}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              순서 {root.sortOrder} · ID {root.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(root)}
                            className="text-xs text-gray-700 px-2 py-1 border border-gray-300 rounded"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(root)}
                            className="text-xs text-gray-600 px-2 py-1 border border-gray-300 rounded"
                          >
                            {root.isActive ? '비활성' : '활성'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(root)}
                            className="text-xs text-red-600 px-2 py-1 border border-red-200 rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pl-2 border-l-2 border-gray-200 space-y-2">
                          {children.length === 0 ? (
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                              아직 상세가 없습니다. 아래 <strong>+ 상세 옵션(가격) 추가</strong>에서 항목명과
                              가격(원)을 입력해 저장하세요. (루트를 대분류로 만들지 않았어도, 상세를 넣으면
                              고객 화면에서 섹션처럼 동작합니다.)
                            </p>
                          ) : null}
                          {children.map((ch) => {
                            const canAddGrandchild = profDepthFromRoot(items, ch.id) <= 1;
                            const grandkids = listProfChildren(items, ch.id);
                            return (
                              <div key={ch.id} className="space-y-1.5">
                                {editingId === ch.id ? (
                                  <div className="space-y-1 bg-gray-50 p-2 rounded">
                                    <div className="flex flex-wrap gap-1">
                                      <input
                                        type="text"
                                        className="flex-1 min-w-[120px] text-xs px-2 py-1 border border-gray-300 rounded"
                                        value={editDraft.label}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                                      />
                                      <input
                                        type="text"
                                        className="w-20 text-xs px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                                        value={editDraft.priceAmount}
                                        onChange={(e) =>
                                          setEditDraft((d) => ({ ...d, priceAmount: e.target.value }))
                                        }
                                        placeholder="원"
                                        inputMode="numeric"
                                      />
                                      <input
                                        type="text"
                                        className="w-20 text-xs px-2 py-1 border border-gray-300 rounded"
                                        value={editDraft.emoji}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, emoji: e.target.value }))}
                                        maxLength={8}
                                      />
                                      <input
                                        type="color"
                                        className="h-7 w-8 border border-gray-300 rounded p-0"
                                        value={editDraft.color}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                                      />
                                      <button
                                        type="button"
                                        className="text-xs px-2 py-1 bg-gray-800 text-white rounded"
                                        onClick={saveEdit}
                                      >
                                        저장
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs px-2 py-1 border border-gray-300 rounded"
                                        onClick={() => setEditingId(null)}
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span
                                      className={ch.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}
                                    >
                                      <span
                                        className="inline-block w-2 h-2 rounded-full mr-1 border border-gray-200 align-middle"
                                        style={{ backgroundColor: ch.color }}
                                      />
                                      {ch.emoji ? `${ch.emoji} ` : null}
                                      {ch.label}
                                      {ch.priceAmount != null && ch.priceAmount > 0 && (
                                        <span className="text-gray-500 ml-1">
                                          {ch.priceAmount.toLocaleString('ko-KR')}원
                                        </span>
                                      )}
                                      {ch.priceHint ? (
                                        <span className="text-gray-500"> · {ch.priceHint}</span>
                                      ) : null}
                                    </span>
                                    <span className="flex gap-1 shrink-0">
                                      <button
                                        type="button"
                                        className="text-gray-600 px-1.5 py-0.5 border border-gray-200 rounded"
                                        onClick={() => startEdit(ch)}
                                      >
                                        수정
                                      </button>
                                      <button
                                        type="button"
                                        className="text-gray-500 px-1.5 py-0.5 border border-gray-200 rounded"
                                        onClick={() => handleToggle(ch)}
                                      >
                                        {ch.isActive ? '끄기' : '켜기'}
                                      </button>
                                      <button
                                        type="button"
                                        className="text-red-600 px-1.5 py-0.5 border border-red-100 rounded"
                                        onClick={() => handleDelete(ch)}
                                      >
                                        삭제
                                      </button>
                                    </span>
                                  </div>
                                )}

                                <div className="ml-2 pl-2 border-l border-gray-100 space-y-1.5">
                                  {grandkids.map((gc) =>
                                    editingId === gc.id ? (
                                      <div key={gc.id} className="space-y-1 bg-amber-50/50 p-2 rounded">
                                        <div className="flex flex-wrap gap-1">
                                          <input
                                            type="text"
                                            className="flex-1 min-w-[100px] text-xs px-2 py-1 border border-gray-300 rounded"
                                            value={editDraft.label}
                                            onChange={(e) =>
                                              setEditDraft((d) => ({ ...d, label: e.target.value }))
                                            }
                                          />
                                          <input
                                            type="text"
                                            className="w-20 text-xs px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                                            value={editDraft.priceAmount}
                                            onChange={(e) =>
                                              setEditDraft((d) => ({ ...d, priceAmount: e.target.value }))
                                            }
                                            placeholder="원"
                                            inputMode="numeric"
                                          />
                                          <input
                                            type="text"
                                            className="w-16 text-xs px-2 py-1 border border-gray-300 rounded"
                                            value={editDraft.emoji}
                                            onChange={(e) =>
                                              setEditDraft((d) => ({ ...d, emoji: e.target.value }))
                                            }
                                            maxLength={8}
                                          />
                                          <input
                                            type="color"
                                            className="h-7 w-8 border border-gray-300 rounded p-0"
                                            value={editDraft.color}
                                            onChange={(e) =>
                                              setEditDraft((d) => ({ ...d, color: e.target.value }))
                                            }
                                          />
                                          <button
                                            type="button"
                                            className="text-xs px-2 py-1 bg-gray-800 text-white rounded"
                                            onClick={saveEdit}
                                          >
                                            저장
                                          </button>
                                          <button
                                            type="button"
                                            className="text-xs px-2 py-1 border border-gray-300 rounded"
                                            onClick={() => setEditingId(null)}
                                          >
                                            취소
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        key={gc.id}
                                        className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                      >
                                        <span
                                          className={
                                            gc.isActive ? 'text-gray-700' : 'text-gray-400 line-through'
                                          }
                                        >
                                          <span
                                            className="inline-block w-2 h-2 rounded-full mr-1 border border-gray-200 align-middle"
                                            style={{ backgroundColor: gc.color }}
                                          />
                                          {gc.emoji ? `${gc.emoji} ` : null}
                                          {gc.label}
                                          {gc.priceAmount != null && gc.priceAmount > 0 && (
                                            <span className="text-gray-500 ml-1">
                                              {gc.priceAmount.toLocaleString('ko-KR')}원
                                            </span>
                                          )}
                                          {gc.priceHint ? (
                                            <span className="text-gray-500"> · {gc.priceHint}</span>
                                          ) : null}
                                        </span>
                                        <span className="flex gap-1 shrink-0">
                                          <button
                                            type="button"
                                            className="text-gray-600 px-1 py-0.5 border border-gray-200 rounded"
                                            onClick={() => startEdit(gc)}
                                          >
                                            수정
                                          </button>
                                          <button
                                            type="button"
                                            className="text-gray-500 px-1 py-0.5 border border-gray-200 rounded"
                                            onClick={() => handleToggle(gc)}
                                          >
                                            {gc.isActive ? '끄기' : '켜기'}
                                          </button>
                                          <button
                                            type="button"
                                            className="text-red-600 px-1 py-0.5 border border-red-100 rounded"
                                            onClick={() => handleDelete(gc)}
                                          >
                                            삭제
                                          </button>
                                        </span>
                                      </div>
                                    )
                                  )}

                                  {canAddGrandchild ? (
                                    childParentId === ch.id ? (
                                      <div className="p-2 bg-amber-50/80 border border-amber-200 rounded text-[11px] space-y-2">
                                        <p className="font-medium text-gray-800">
                                          「{ch.label}」 아래 — 금액 세부 항목 추가
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-2">
                                          <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                              항목명 (필수)
                                            </label>
                                            <input
                                              type="text"
                                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                              value={childLabel}
                                              onChange={(e) => setChildLabel(e.target.value)}
                                              placeholder="예: 전자레인지"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                              가격 (원)
                                            </label>
                                            <input
                                              type="text"
                                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-right tabular-nums"
                                              value={childPriceAmount}
                                              onChange={(e) => setChildPriceAmount(e.target.value)}
                                              placeholder="50000"
                                              inputMode="numeric"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                              보조 문구 (선택)
                                            </label>
                                            <input
                                              type="text"
                                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                              value={childPriceHint}
                                              onChange={(e) => setChildPriceHint(e.target.value)}
                                              placeholder="5만원~"
                                            />
                                          </div>
                                          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                                            <div>
                                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                                이모지
                                              </label>
                                              <input
                                                type="text"
                                                className="w-10 px-1 py-1.5 border border-gray-300 rounded text-center text-xs"
                                                value={childEmoji}
                                                onChange={(e) => setChildEmoji(e.target.value)}
                                                maxLength={8}
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                                색
                                              </label>
                                              <input
                                                type="color"
                                                className="h-8 w-10 border border-gray-200 rounded"
                                                value={childColor}
                                                onChange={(e) => setChildColor(e.target.value)}
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                                순서
                                              </label>
                                              <input
                                                type="number"
                                                className="w-16 px-1 py-1.5 border border-gray-300 rounded text-xs"
                                                value={childSortOrder}
                                                onChange={(e) => setChildSortOrder(e.target.value)}
                                              />
                                            </div>
                                            <div className="flex gap-1 pt-3 sm:ml-auto">
                                              <button
                                                type="button"
                                                className="px-2 py-1.5 bg-gray-800 text-white rounded text-xs"
                                                onClick={() => handleAddChild(ch.id)}
                                              >
                                                저장
                                              </button>
                                              <button
                                                type="button"
                                                className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                                                onClick={() => setChildParentId(null)}
                                              >
                                                취소
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="mt-1 w-full text-left text-[11px] font-medium text-blue-800 border border-dashed border-blue-300 rounded px-2 py-1.5 bg-blue-50/50 hover:bg-blue-50"
                                        onClick={() => {
                                          setChildParentId(ch.id);
                                          setChildLabel('');
                                          setChildPriceAmount('');
                                          setChildPriceHint('');
                                          setChildEmoji('');
                                          setChildColor('#6b7280');
                                          setChildSortOrder('0');
                                        }}
                                      >
                                        + 하위 금액 항목 추가 (항목명·가격 입력)
                                      </button>
                                    )
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}

                          {childParentId === root.id ? (
                            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded text-xs space-y-2">
                              <p className="font-medium text-gray-800">
                                「{root.label}」 아래 — 상세 옵션 (이름·가격)
                              </p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-3">
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                    항목명 (필수)
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    value={childLabel}
                                    onChange={(e) => setChildLabel(e.target.value)}
                                    placeholder="예: 가전내부분해"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                    가격 (원)
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right tabular-nums"
                                    value={childPriceAmount}
                                    onChange={(e) => setChildPriceAmount(e.target.value)}
                                    placeholder="비워도 됨 (하위만 금액)"
                                    inputMode="numeric"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                    보조 문구 (선택)
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    value={childPriceHint}
                                    onChange={(e) => setChildPriceHint(e.target.value)}
                                    placeholder="별도 안내"
                                  />
                                </div>
                                <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                      이모지
                                    </label>
                                    <input
                                      type="text"
                                      className="w-11 px-1 py-1.5 border border-gray-300 rounded text-center text-sm"
                                      value={childEmoji}
                                      onChange={(e) => setChildEmoji(e.target.value)}
                                      maxLength={8}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                      색
                                    </label>
                                    <input
                                      type="color"
                                      className="h-9 w-11 border border-gray-200 rounded"
                                      value={childColor}
                                      onChange={(e) => setChildColor(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                      순서
                                    </label>
                                    <input
                                      type="number"
                                      className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                      value={childSortOrder}
                                      onChange={(e) => setChildSortOrder(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex gap-1 pt-4 sm:ml-auto">
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs"
                                      onClick={() => handleAddChild(root.id)}
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 border border-gray-300 rounded text-xs"
                                      onClick={() => setChildParentId(null)}
                                    >
                                      취소
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="w-full text-left text-xs font-medium text-blue-800 border border-dashed border-blue-300 rounded px-2 py-2 bg-blue-50/40 hover:bg-blue-50"
                              onClick={() => {
                                setChildParentId(root.id);
                                setChildLabel('');
                                setChildPriceAmount('');
                                setChildPriceHint('');
                                setChildEmoji('');
                                setChildColor('#6b7280');
                                setChildSortOrder('0');
                              }}
                            >
                              + 상세 옵션(가격) 추가 — 항목명·가격(원) 입력
                            </button>
                          )}
                        </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500">등록된 항목이 없습니다. 위에서 추가해 주세요.</p>
        )}
      </section>
    </div>
  );
}
