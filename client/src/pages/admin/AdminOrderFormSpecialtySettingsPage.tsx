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
} from '../../constants/professionalSpecialtyOptions';

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
  const [newIsGroup, setNewIsGroup] = useState(false);
  const [newPriceHint, setNewPriceHint] = useState('');
  const [newPriceAmount, setNewPriceAmount] = useState('');
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
    const pa = parsePriceInt(newPriceAmount);
    try {
      await createProfessionalOption(token, {
        label: newLabel.trim(),
        isGroup: newIsGroup,
        priceHint: newPriceHint.trim() || undefined,
        priceAmount: !newIsGroup ? pa : undefined,
        emoji: newEmoji.trim() || undefined,
        color: newColor,
        sortOrder: parseInt(newSortOrder, 10) || 0,
      });
      setNewLabel('');
      setNewIsGroup(false);
      setNewPriceHint('');
      setNewPriceAmount('');
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
        <h2 className="text-base font-medium text-gray-900 mb-2">전문 시공 옵션</h2>
        <p className="text-sm text-gray-600 mb-4">
          <strong>대분류</strong>는 섹션 제목만 보이고 가격은 <strong>하위 상세</strong>에서 숫자(원)로
          설정합니다. 고객 발주서에서는 <strong>대분류를 먼저 체크</strong>해야만 그 아래 세부 항목(예:
          소독방역 5만원, 벽지소독 10만원)이 나타납니다. 대분류 체크를 해제하면 선택된 세부 항목은
          함께 해제됩니다. <strong>단일 항목</strong>(대분류 아님)은 기존처럼 한 줄에서 바로 선택합니다.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="border border-gray-200 rounded p-3 bg-gray-50 mb-6">
          <h3 className="text-sm font-medium text-gray-800 mb-3">루트에 항목 추가</h3>
          <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={newIsGroup}
              onChange={(e) => setNewIsGroup(e.target.checked)}
            />
            대분류로만 등록 (섹션 제목 — 이후 &quot;상세 추가&quot;로 가격 항목을 넣습니다)
          </label>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">항목명</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={newIsGroup ? '예: 창호·샷시' : '예: 새집증후군'}
              />
            </div>
            {!newIsGroup && (
              <>
                <div className="w-28">
                  <label className="block text-xs text-gray-600 mb-1">가격(원)</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right tabular-nums"
                    value={newPriceAmount}
                    onChange={(e) => setNewPriceAmount(e.target.value)}
                    placeholder="150000"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs text-gray-600 mb-1">금액 안내(문구)</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    value={newPriceHint}
                    onChange={(e) => setNewPriceHint(e.target.value)}
                    placeholder="150,000원~"
                  />
                </div>
              </>
            )}
            {newIsGroup && (
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-600 mb-1">보조 안내(선택)</label>
                <input
                  type="text"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  value={newPriceHint}
                  onChange={(e) => setNewPriceHint(e.target.value)}
                  placeholder="섹션 설명"
                />
              </div>
            )}
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

                      {isSection && (
                        <div className="mt-3 pl-2 border-l-2 border-gray-200 space-y-2">
                          {children.map((ch) =>
                            editingId === ch.id ? (
                              <div key={ch.id} className="space-y-1 bg-gray-50 p-2 rounded">
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
                                    onChange={(e) => setEditDraft((d) => ({ ...d, priceAmount: e.target.value }))}
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
                              <div
                                key={ch.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
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
                                  {ch.priceHint ? <span className="text-gray-500"> · {ch.priceHint}</span> : null}
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
                            )
                          )}

                          {childParentId === root.id ? (
                            <div className="p-2 bg-amber-50/80 border border-amber-200 rounded text-xs space-y-1">
                              <p className="font-medium text-gray-800">상세 항목 추가</p>
                              <div className="flex flex-wrap gap-1 items-end">
                                <input
                                  type="text"
                                  className="flex-1 min-w-[100px] px-2 py-1 border border-gray-300 rounded"
                                  value={childLabel}
                                  onChange={(e) => setChildLabel(e.target.value)}
                                  placeholder="이름"
                                />
                                <input
                                  type="text"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                                  value={childPriceAmount}
                                  onChange={(e) => setChildPriceAmount(e.target.value)}
                                  placeholder="가격(원)"
                                />
                                <input
                                  type="text"
                                  className="w-28 px-2 py-1 border border-gray-300 rounded"
                                  value={childPriceHint}
                                  onChange={(e) => setChildPriceHint(e.target.value)}
                                  placeholder="보조문구"
                                />
                                <input
                                  type="text"
                                  className="w-10 px-1 py-1 border border-gray-300 rounded text-center"
                                  value={childEmoji}
                                  onChange={(e) => setChildEmoji(e.target.value)}
                                  maxLength={8}
                                />
                                <input
                                  type="color"
                                  className="h-7 w-8 border border-gray-200 rounded"
                                  value={childColor}
                                  onChange={(e) => setChildColor(e.target.value)}
                                />
                                <input
                                  type="number"
                                  className="w-16 px-1 py-1 border border-gray-300 rounded"
                                  value={childSortOrder}
                                  onChange={(e) => setChildSortOrder(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="px-2 py-1 bg-gray-800 text-white rounded"
                                  onClick={() => handleAddChild(root.id)}
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 border border-gray-300 rounded"
                                  onClick={() => setChildParentId(null)}
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-blue-700 border border-dashed border-blue-200 rounded px-2 py-1"
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
                              + 상세 옵션(가격) 추가
                            </button>
                          )}
                        </div>
                      )}
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
