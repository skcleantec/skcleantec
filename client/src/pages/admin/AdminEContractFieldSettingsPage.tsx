import { useCallback, useEffect, useState } from 'react';
import {
  createEContractFieldDefinition,
  deleteEContractFieldDefinition,
  listEContractFieldDefinitions,
  patchEContractFieldDefinition,
  type EContractAudienceKind,
  type EContractFieldDefinitionDto,
  type EContractFieldFilledByKind,
  type EContractFieldInputTypeKind,
} from '../../api/adminEContract';
import { getToken } from '../../stores/auth';
import { eContractAudienceLabel, eContractFieldFilledByLabel } from '../../utils/eContractDisplay';
import { eContractFieldInputTypeLabel } from '../../components/e-contract/EContractDynamicFieldInputs';

const INPUT_TYPES: EContractFieldInputTypeKind[] = ['TEXT', 'TEXTAREA', 'DATE', 'NUMBER', 'PHONE', 'RRN'];
const FILLED_BY: EContractFieldFilledByKind[] = ['SIGNER', 'ADMIN', 'AUTO'];

export function AdminEContractFieldSettingsPage() {
  const token = getToken();
  const [tab, setTab] = useState<EContractAudienceKind>('TEAM_LEADER');
  const [fields, setFields] = useState<EContractFieldDefinitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newInputType, setNewInputType] = useState<EContractFieldInputTypeKind>('TEXT');
  const [newFilledBy, setNewFilledBy] = useState<EContractFieldFilledByKind>('SIGNER');
  const [newRequired, setNewRequired] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await listEContractFieldDefinitions(token, tab);
      setFields(data.fields);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const addField = async () => {
    if (!token || !newLabel.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await createEContractFieldDefinition(token, {
        audience: tab,
        label: newLabel.trim(),
        token: newToken.trim() || undefined,
        inputType: newInputType,
        filledBy: newFilledBy,
        required: newRequired,
      });
      setNewLabel('');
      setNewToken('');
      setMsg('필드를 추가했습니다.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: EContractFieldDefinitionDto) => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      await patchEContractFieldDefinition(token, row.id, { isActive: !row.isActive });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (row: EContractFieldDefinitionDto) => {
    if (!token || row.inUse) return;
    if (!window.confirm(`「${row.label}」 필드를 삭제할까요?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteEContractFieldDefinition(token, row.id);
      setMsg('삭제했습니다.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full">
      <h1 className="text-fluid-lg font-semibold text-gray-900">체결·매핑 필드 설정</h1>
      <p className="mt-2 text-fluid-sm text-gray-600">
        팀장·마케터 계약서 본문에 넣을 치환 코드를 관리합니다. 초안 편집기 드롭다운과 체결·발급 입력란에 반영됩니다.
      </p>

      <div className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
        {(['TEAM_LEADER', 'MARKETER'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setTab(a)}
            className={`rounded-md px-4 py-2 text-fluid-xs font-medium ${
              tab === a ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {eContractAudienceLabel(a)}
          </button>
        ))}
      </div>

      {err ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div> : null}
      {msg ? <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-900">{msg}</div> : null}

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-fluid-md font-semibold text-gray-900">필드 추가</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-fluid-xs font-medium text-gray-700">표시명</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              placeholder="예: 월급 지급일"
            />
          </div>
          <div>
            <label className="block text-fluid-xs font-medium text-gray-700">코드(선택)</label>
            <input
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-fluid-xs"
              placeholder="[[EC_PAYDAY]] — 비우면 자동 생성"
            />
          </div>
          <div>
            <label className="block text-fluid-xs font-medium text-gray-700">입력 주체</label>
            <select
              value={newFilledBy}
              onChange={(e) => setNewFilledBy(e.target.value as EContractFieldFilledByKind)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              {FILLED_BY.map((v) => (
                <option key={v} value={v}>
                  {eContractFieldFilledByLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-fluid-xs font-medium text-gray-700">입력 형식</label>
            <select
              value={newInputType}
              onChange={(e) => setNewInputType(e.target.value as EContractFieldInputTypeKind)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              {INPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {eContractFieldInputTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-fluid-sm text-gray-800">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              필수
            </label>
            <button
              type="button"
              disabled={busy || !newLabel.trim()}
              onClick={() => void addField()}
              className="ml-auto rounded-lg bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3 text-fluid-sm font-medium text-gray-800">
          {eContractAudienceLabel(tab)} 필드 목록
        </div>
        {loading ? (
          <p className="p-6 text-center text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : fields.length === 0 ? (
          <p className="p-6 text-center text-fluid-sm text-gray-500">등록된 필드가 없습니다.</p>
        ) : (
          <>
            <div className="lg:hidden divide-y divide-gray-100">
              {fields.map((row) => (
                <div key={row.id} className="space-y-2 p-4">
                  <div className="font-medium text-gray-900">{row.label}</div>
                  <div className="break-all font-mono text-fluid-2xs text-gray-600">{row.token}</div>
                  <div className="text-fluid-2xs text-gray-500">
                    {eContractFieldFilledByLabel(row.filledBy)} · {eContractFieldInputTypeLabel(row.inputType)}
                    {row.required ? ' · 필수' : ''}
                    {!row.isActive ? ' · 비활성' : ''}
                    {row.inUse ? ' · 본문 사용 중' : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(row)}
                      className="rounded border border-gray-300 px-2 py-1 text-fluid-2xs"
                    >
                      {row.isActive ? '비활성' : '활성'}
                    </button>
                    {!row.inUse && row.token !== '[[EC_SIGNATURE]]' && row.token !== '[[EC_CONTRACT_DATE]]' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeField(row)}
                        className="rounded border border-red-200 px-2 py-1 text-fluid-2xs text-red-700"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-fluid-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-2 text-center">표시명</th>
                    <th className="px-2 py-2 text-center">코드</th>
                    <th className="px-2 py-2 text-center">주체</th>
                    <th className="px-2 py-2 text-center">형식</th>
                    <th className="px-2 py-2 text-center">필수</th>
                    <th className="px-2 py-2 text-center">상태</th>
                    <th className="px-2 py-2 text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="truncate px-2 py-2 text-center" title={row.label}>
                        {row.label}
                      </td>
                      <td className="truncate px-2 py-2 text-center font-mono text-fluid-2xs" title={row.token}>
                        {row.token}
                      </td>
                      <td className="px-2 py-2 text-center">{eContractFieldFilledByLabel(row.filledBy)}</td>
                      <td className="px-2 py-2 text-center">{eContractFieldInputTypeLabel(row.inputType)}</td>
                      <td className="px-2 py-2 text-center">{row.required ? 'Y' : '—'}</td>
                      <td className="px-2 py-2 text-center">
                        {row.isActive ? '사용' : '비활성'}
                        {row.inUse ? ' · 본문' : ''}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleActive(row)}
                          className="rounded border border-gray-300 px-2 py-1"
                        >
                          {row.isActive ? '끄기' : '켜기'}
                        </button>
                        {!row.inUse && row.token !== '[[EC_SIGNATURE]]' && row.token !== '[[EC_CONTRACT_DATE]]' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeField(row)}
                            className="ml-1 rounded border border-red-200 px-2 py-1 text-red-700"
                          >
                            삭제
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
