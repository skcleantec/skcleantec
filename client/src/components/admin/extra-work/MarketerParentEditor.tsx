import { useEffect, useState } from 'react';
import { fetchExtraWorkSettings, saveExtraWorkMarketer } from '../../../api/extraWork';

const fieldClass =
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
const btnClass =
  'min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function MarketerParentEditor(props: { token: string; userId: string }) {
  const { token, userId } = props;
  const [parentId, setParentId] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;
    void fetchExtraWorkSettings(token)
      .then((settings) => {
        if (cancelled) return;
        const me = settings.marketers.find((row) => row.id === userId);
        setOptions(settings.marketers.filter((row) => row.id !== userId).map((row) => ({ id: row.id, name: row.name })));
        setParentId(me?.parentMarketerId ?? '');
        setReady(Boolean(me));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '상위 마케터를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  if (!ready && !error) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const current = await fetchExtraWorkSettings(token);
      const me = current.marketers.find((row) => row.id === userId);
      if (!me) throw new Error('마케터를 찾을 수 없습니다.');
      await saveExtraWorkMarketer(token, userId, {
        parentMarketerId: parentId || null,
        companyPercent: me.companyPercent,
        teamLeaderPercent: me.teamLeaderPercent,
        marketerPercent: me.marketerPercent,
        overrideSource: me.overrideSource,
        overridePercent: me.overridePercent,
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '상위를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-fluid-sm font-medium text-slate-900">직속 상위 마케터</p>
      <p className="text-fluid-2xs leading-snug text-slate-500">
        추가 시공 금액의 일부를 이 사람에게 오버라이딩합니다. 비율은 월정산표 추가정산 설정에서 바꿉니다.
      </p>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      <select className={fieldClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">없음</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      <button type="button" className={btnClass} disabled={saving} onClick={() => void save()}>
        {saving ? '저장 중…' : saved ? '상위 저장됨' : '상위 저장'}
      </button>
    </div>
  );
}
