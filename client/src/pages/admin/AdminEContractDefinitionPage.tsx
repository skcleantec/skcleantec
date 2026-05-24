import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminEContractSubmissionDetailModal } from '../../components/e-contract/AdminEContractSubmissionDetailModal';
import { EContractRichEditor } from '../../components/e-contract/EContractRichEditor';
import { EContractDraftPreviewModal } from '../../components/e-contract/EContractDraftPreviewModal';
import { getToken } from '../../stores/auth';
import { EContractDynamicFieldInputs } from '../../components/e-contract/EContractDynamicFieldInputs';
import {
  buildEContractPublicSignUrl,
  createEContractIssuance,
  deleteEContractDefinition,
  deleteEContractDraft,
  ensureEContractDraft,
  fetchEContractEditorFields,
  fetchEContractMergeFieldsForIssuance,
  getEContractDefinition,
  listEContractIssuances,
  patchEContractDefinition,
  patchEContractVersion,
  publishEContractVersion,
  pickerTeamLeaders,
  pickerMarketers,
  type EContractDefinitionDetail,
  type EContractEditorFieldOption,
  type EContractIssuanceRow,
  type EContractMergeFieldForIssuance,
  type TeamLeaderPicker,
} from '../../api/adminEContract';
import { eContractAudienceLabel, eContractIssuanceStatusKo, eContractRecipientRoleLabel } from '../../utils/eContractDisplay';

export function AdminEContractDefinitionPage() {
  const { definitionId } = useParams<{ definitionId: string }>();
  const token = getToken();
  const navigate = useNavigate();
  const [def, setDef] = useState<EContractDefinitionDetail | null>(null);
  const [issuances, setIssuances] = useState<EContractIssuanceRow[]>([]);
  const [pickers, setPickers] = useState<TeamLeaderPicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [issueRecipientId, setIssueRecipientId] = useState('');
  const [issueVersionId, setIssueVersionId] = useState('');
  const [issueMergeValues, setIssueMergeValues] = useState<Record<string, string>>({});
  const [mergeFieldsForIssue, setMergeFieldsForIssue] = useState<EContractMergeFieldForIssuance[]>([]);
  const [editorFields, setEditorFields] = useState<EContractEditorFieldOption[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [lastIssuedSignUrl, setLastIssuedSignUrl] = useState<string | null>(null);

  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);
  const [publishedPreviewBody, setPublishedPreviewBody] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delPwd, setDelPwd] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [submissionModalId, setSubmissionModalId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token || !definitionId) return;
    setLoading(true);
    setErr(null);
    try {
      const d = await getEContractDefinition(token, definitionId);
      const iss = await listEContractIssuances(token, definitionId);
      const audience = d.definition.audience ?? 'TEAM_LEADER';
      const pl =
        audience === 'MARKETER'
          ? await pickerMarketers(token).then((r) => r.marketers)
          : await pickerTeamLeaders(token).then((r) => r.teamLeaders);
      setDef(d.definition);
      setIssuances(iss.issuances);
      setPickers(pl);
      const edFields = await fetchEContractEditorFields(token, definitionId);
      setEditorFields(edFields.fields);
      const draft = d.definition.versions.find((v) => v.status === 'DRAFT');
      if (draft) {
        setDraftId(draft.id);
        setDraftTitle(draft.titleSnapshot);
        setDraftBody(draft.bodyMarkdown);
      } else {
        setDraftId(null);
        setDraftTitle(d.definition.title);
        setDraftBody('');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
      setDef(null);
    } finally {
      setLoading(false);
    }
  }, [token, definitionId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!token || !definitionId) return;
    void (async () => {
      try {
        const data = await fetchEContractMergeFieldsForIssuance(token, definitionId, issueVersionId || undefined);
        setMergeFieldsForIssue(data.fields);
        setIssueMergeValues((prev) => {
          const next: Record<string, string> = {};
          for (const f of data.fields) next[f.token] = prev[f.token] ?? '';
          return next;
        });
      } catch {
        setMergeFieldsForIssue([]);
        setIssueMergeValues({});
      }
    })();
  }, [token, definitionId, issueVersionId]);

  const publishedVersions = useMemo(
    () => (def?.versions ?? []).filter((v) => v.status === 'PUBLISHED').sort((a, b) => (a.publishedOrdinal ?? 0) - (b.publishedOrdinal ?? 0)),
    [def]
  );

  const ensureDraftLocal = async () => {
    if (!token || !definitionId) return;
    setErr(null);
    try {
      const { draft } = await ensureEContractDraft(token, definitionId);
      setMsg('초안을 준비했습니다. 아래에서 편집 후 배포하세요.');
      setDraftId(draft.id);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '초안을 만들지 못했습니다.');
    }
  };

  const saveDraft = async () => {
    if (!token || !draftId) return;
    setSavingDraft(true);
    setErr(null);
    setMsg(null);
    try {
      await patchEContractVersion(token, draftId, {
        titleSnapshot: draftTitle,
        bodyMarkdown: draftBody,
      });
      setMsg('초안을 저장했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (!token || !draftId) return;
    if (!window.confirm('배포하면 이 번호의 공개 버전이 고정됩니다. 계속할까요?')) return;
    setPublishing(true);
    setErr(null);
    setMsg(null);
    try {
      await patchEContractVersion(token, draftId, {
        titleSnapshot: draftTitle,
        bodyMarkdown: draftBody,
      });
      await publishEContractVersion(token, draftId);
      setMsg('새 버전을 배포했습니다.');
      setDraftId(null);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '배포하지 못했습니다.');
    } finally {
      setPublishing(false);
    }
  };

  const removeDraft = async () => {
    if (!token || !draftId) return;
    if (!window.confirm('초안을 삭제할까요?')) return;
    setErr(null);
    try {
      await deleteEContractDraft(token, draftId);
      setDraftId(null);
      setMsg('초안을 삭제했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    }
  };

  const issue = async () => {
    if (!token || !definitionId || !issueRecipientId) return;
    setIssuing(true);
    setErr(null);
    setMsg(null);
    setLastIssuedSignUrl(null);
    try {
      const result = await createEContractIssuance(token, {
        definitionId,
        recipientUserId: issueRecipientId,
        versionId: issueVersionId || null,
        mergeFields: Object.keys(issueMergeValues).length > 0 ? issueMergeValues : undefined,
      });
      const issuanceToken =
        typeof result.issuance === 'object' &&
        result.issuance !== null &&
        'token' in result.issuance &&
        typeof (result.issuance as { token?: string }).token === 'string'
          ? (result.issuance as { token: string }).token
          : null;
      const signUrl = issuanceToken ? buildEContractPublicSignUrl(issuanceToken) : null;
      if (signUrl && def?.audience === 'MARKETER') {
        setLastIssuedSignUrl(signUrl);
        try {
          await navigator.clipboard.writeText(signUrl);
          setMsg('체결 링크를 발급했고 클립보드에 복사했습니다. 마케터에게 전달해 주세요.');
        } catch {
          setMsg('체결 링크를 발급했습니다. 아래 링크를 복사해 마케터에게 전달해 주세요.');
        }
      } else {
        setMsg('체결 링크를 발급했습니다. 아래 목록에서 복사하세요.');
      }
      const iss = await listEContractIssuances(token, definitionId);
      setIssuances(iss.issuances);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '발급하지 못했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  const toggleArchive = async () => {
    if (!token || !def) return;
    setErr(null);
    try {
      await patchEContractDefinition(token, def.id, { isArchived: !def.isArchived });
      setMsg(def.isArchived ? '보관을 해제했습니다.' : '보관 처리했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    }
  };

  const hardDelete = async () => {
    if (!token || !def) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteEContractDefinition(token, def.id, delPwd);
      setDelOpen(false);
      navigate('/admin/team-leaders/e-contracts');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (!definitionId) {
    return <div className="p-6 text-fluid-sm text-gray-600">잘못된 경로입니다.</div>;
  }

  if (loading && !def) {
    return <div className="p-8 text-center text-fluid-sm text-gray-500">불러오는 중…</div>;
  }
  if (!def) {
    return (
      <div className="p-6">
        <p className="text-fluid-sm text-red-700">{err || '없습니다.'}</p>
        <Link to="/admin/team-leaders/e-contracts" className="mt-4 inline-block text-blue-700">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full px-4 sm:px-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/admin/team-leaders/e-contracts" className="text-fluid-sm text-blue-700 hover:underline">
          ← 계약서 목록
        </Link>
      </div>

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-fluid-xl font-semibold text-gray-900">{def.title}</h1>
          <p className="mt-1 text-fluid-xs text-gray-600">
            수신 대상:{' '}
            <span className="font-medium text-gray-800">{eContractAudienceLabel(def.audience ?? 'TEAM_LEADER')}</span>
            {def.audience === 'MARKETER' ? (
              <span className="text-gray-500"> — 전용 화면 없음, 발급 링크를 직접 전달</span>
            ) : null}
          </p>
          {def.description ? (
            <p className="mt-1 text-fluid-sm text-gray-600 whitespace-pre-wrap">{def.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleArchive()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs text-gray-800"
          >
            {def.isArchived ? '보관 해제' : '보관(목록 숨김)'}
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs text-gray-800"
          >
            새로고침
          </button>
        </div>
      </div>

      {err ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div>
      ) : null}
      {msg ? (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-900">{msg}</div>
      ) : null}

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-fluid-md font-semibold text-gray-900">버전 히스토리</h2>
        <p className="mt-1 text-fluid-xs text-gray-600">
          배포된 버전은 체결 여부와 관계없이 <span className="font-medium text-gray-800">영구 보관</span>됩니다. 수정이 필요하면
          「새 초안 준비」 후 다시 배포하세요(v1, v2… 누적).
        </p>
        <div className="mt-4 hidden lg:block overflow-x-auto">
          <table className="w-full table-fixed border border-gray-200 text-fluid-xs">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '36%' }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-2 py-2 text-center">상태</th>
                <th className="border-b border-gray-200 px-2 py-2 text-center">배포 번호</th>
                <th className="border-b border-gray-200 px-2 py-2 text-center">배포 시각</th>
                <th className="border-b border-gray-200 px-2 py-2 text-center">발급/체결 건수</th>
                <th className="border-b border-gray-200 px-2 py-2 text-center">제목 스냅샷</th>
              </tr>
            </thead>
            <tbody>
              {def.versions.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-2 text-center">{v.status === 'PUBLISHED' ? '배포' : '초안'}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{v.publishedOrdinal != null ? `v${v.publishedOrdinal}` : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">{v._count.issuances} / {v._count.submissions}</td>
                  <td className="truncate px-2 py-2 text-center" title={v.titleSnapshot}>
                    {v.titleSnapshot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 lg:hidden">
          {def.versions.map((v) => (
            <div key={v.id} className="rounded border border-gray-100 bg-gray-50 p-3">
              <div className="font-medium">
                {v.status === 'PUBLISHED' ? '배포' : '초안'}
                {v.publishedOrdinal != null ? ` · v${v.publishedOrdinal}` : ''}
              </div>
              <div className="text-fluid-2xs text-gray-600 mt-1">
                발급 {v._count.issuances} · 체결 {v._count.submissions}
                {v.publishedAt ? ` · ${new Date(v.publishedAt).toLocaleString('ko-KR')}` : ''}
              </div>
              <div className="text-fluid-xs mt-2">{v.titleSnapshot}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-fluid-md font-semibold text-gray-900">초안 편집 및 배포</h2>
          {!draftId ? (
            <button
              type="button"
              onClick={() => void ensureDraftLocal()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-xs font-medium text-white"
            >
              새 초안 준비
            </button>
          ) : null}
        </div>
        {!draftId ? (
          <p className="mt-3 text-fluid-sm text-gray-600">먼저 「새 초안 준비」를 눌러 수정할 초안을 만듭니다.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-fluid-xs font-medium text-gray-700">문서 제목(체결본 스냅샷)</label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              />
            </div>
            <div>
              <label className="block text-fluid-xs font-medium text-gray-700">본문 (서식·글꼴·색·정렬)</label>
              <p className="mt-1 text-fluid-2xs text-gray-500">
                툴바 「+발행측」에서 갑 정보·도장 치환 토큰을 넣습니다. 본문 아래 <span className="font-medium text-gray-700">계약주·계약자 정보 표</span>는
                저장·배포 시 자동으로 붙으며, 미리보기에서 함께 확인할 수 있습니다.{' '}
                <Link to="/admin/team-leaders/e-contracts/issuer-profile" className="text-blue-700 hover:underline">
                  발행측 정보 설정
                </Link>
              </p>
              <div className="mt-2 min-w-0">
                <EContractRichEditor
                  editorKey={`draft-${draftId}`}
                  value={draftBody}
                  onChange={setDraftBody}
                  mappingFieldOptions={editorFields}
                />
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setDraftPreviewOpen(true)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-fluid-xs font-medium text-blue-900 hover:bg-blue-100"
                >
                  배포·체결 화면 미리보기
                </button>
                <p className="mt-1 text-fluid-2xs text-gray-500">
                  편집 속도를 위해 미리보기는 버튼을 눌렀을 때만 불러옵니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingDraft}
                onClick={() => void saveDraft()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm"
              >
                초안 저장
              </button>
              <button
                type="button"
                disabled={publishing || savingDraft}
                onClick={() => void publish()}
                className="rounded-lg bg-blue-700 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
              >
                배포하고 새 버전 확정
              </button>
              <button type="button" onClick={() => void removeDraft()} className="rounded-lg px-3 py-2 text-fluid-sm text-red-700">
                초안 폐기
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-fluid-md font-semibold text-gray-900">
          {def.audience === 'MARKETER' ? '마케터 체결 링크 발급' : '팀장 링크 발급'}
        </h2>
        <p className="mt-1 text-fluid-xs text-gray-600">
          {def.audience === 'MARKETER'
            ? '마케터는 별도 로그인 화면이 없습니다. 발급 후 생성된 URL을 카카오·문자 등으로 전달하면 해당 페이지에서 바로 서명할 수 있습니다.'
            : '최신 배포 버전으로 발급됩니다. 팀장은 팀 메뉴에서도 확인할 수 있습니다. 특정 과거 버전으로 보내려면 아래에서 버전을 고르세요.'}
        </p>
        {lastIssuedSignUrl ? (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="text-fluid-xs font-medium text-blue-950">방금 발급한 체결 링크</div>
            <p className="mt-1 break-all font-mono text-fluid-2xs text-blue-900">{lastIssuedSignUrl}</p>
            <button
              type="button"
              className="mt-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-fluid-xs text-blue-900"
              onClick={async () => {
                await navigator.clipboard.writeText(lastIssuedSignUrl);
                setMsg('링크를 복사했습니다.');
              }}
            >
              링크 다시 복사
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px]">
            <label className="block text-fluid-xs font-medium text-gray-700">
              {def.audience === 'MARKETER' ? '마케터' : '팀장'}
            </label>
            <select
              value={issueRecipientId}
              onChange={(e) => setIssueRecipientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              <option value="">선택</option>
              {pickers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-fluid-xs font-medium text-gray-700">버전(선택)</label>
            <select
              value={issueVersionId}
              onChange={(e) => setIssueVersionId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              <option value="">최신 배포</option>
              {publishedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.publishedOrdinal} — {v.titleSnapshot.slice(0, 48)}
                  {v.titleSnapshot.length > 48 ? '…' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {mergeFieldsForIssue.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/80 p-3">
            <div className="text-fluid-xs font-medium text-amber-950">발급 시 입력 (본문에 사용된 관리자 필드)</div>
            <div className="mt-3">
              <EContractDynamicFieldInputs
                fields={mergeFieldsForIssue}
                values={issueMergeValues}
                onChange={(t, v) => setIssueMergeValues((prev) => ({ ...prev, [t]: v }))}
                idPrefix="issue-merge"
              />
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={issuing || !issueRecipientId}
            onClick={() => void issue()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
          >
            링크 발급
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-fluid-sm font-medium text-gray-800">발급 내역</h3>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            체결 완료 후에는 아래 「제출본」에서 확정 문안을 열거나, 상단 메뉴 「체결 기록」에서 팀장별로 모아 볼 수 있습니다.
          </p>
          <div className="mt-2 hidden lg:block overflow-x-auto">
            <table className="w-full border border-gray-200 text-fluid-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b px-2 py-2 text-center">수신자</th>
                  <th className="border-b px-2 py-2 text-center">버전</th>
                  <th className="border-b px-2 py-2 text-center">상태</th>
                  <th className="border-b px-2 py-2 text-center">체결</th>
                  <th className="border-b px-2 py-2 text-center">제출본</th>
                  <th className="border-b px-2 py-2 text-center">링크</th>
                </tr>
              </thead>
              <tbody>
                {issuances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">
                      없음
                    </td>
                  </tr>
                ) : (
                  issuances.map((row) => {
                    const url = buildEContractPublicSignUrl(row.token);
                    return (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-center">
                          <div>{row.teamLeader.name}</div>
                          {row.teamLeader.role ? (
                            <div className="text-fluid-2xs text-gray-500">
                              {eContractRecipientRoleLabel(row.teamLeader.role)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          v{row.version.publishedOrdinal ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-center">{eContractIssuanceStatusKo(row.status, Boolean(row.submission))}</td>
                        <td className="px-2 py-2 text-center">
                          {row.submission?.signedAt
                            ? new Date(row.submission.signedAt).toLocaleString('ko-KR')
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {row.submission?.id ? (
                            <button
                              type="button"
                              className="text-blue-700 hover:underline"
                              onClick={() => setSubmissionModalId(row.submission!.id)}
                            >
                              보기
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            className="text-blue-700 hover:underline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(url);
                              setMsg('링크를 복사했습니다.');
                            }}
                          >
                            복사
                          </button>
                          <span className="sr-only">{url}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 space-y-2 lg:hidden">
            {issuances.map((row) => {
              const url = buildEContractPublicSignUrl(row.token);
              return (
                <div key={row.id} className="rounded border border-gray-100 p-3 text-fluid-xs">
                  <div className="font-medium">
                    {row.teamLeader.name}
                    {row.teamLeader.role ? (
                      <span className="ml-1 text-fluid-2xs text-gray-500">
                        ({eContractRecipientRoleLabel(row.teamLeader.role)})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-gray-600">
                    v{row.version.publishedOrdinal ?? '—'} · {eContractIssuanceStatusKo(row.status, Boolean(row.submission))}
                  </div>
                  {row.submission?.id ? (
                    <button
                      type="button"
                      className="mt-2 rounded border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800"
                      onClick={() => setSubmissionModalId(row.submission!.id)}
                    >
                      제출본 보기
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 rounded border border-gray-300 px-3 py-1"
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      setMsg('링크를 복사했습니다.');
                    }}
                  >
                    링크 복사
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <details className="mb-8 rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <summary className="cursor-pointer text-fluid-sm font-medium text-gray-800">배포된 버전 미리 보기</summary>
        <div className="mt-3 space-y-4">
          {publishedVersions.slice().reverse().map((v) => (
            <div key={v.id} className="rounded border border-gray-200 p-3">
              <div className="min-w-0 font-semibold">
                v{v.publishedOrdinal} · {v.titleSnapshot}
              </div>
              {v.contentHash ? (
                <div className="mt-1 break-all font-mono text-fluid-2xs text-gray-500">{v.contentHash}</div>
              ) : null}
              <button
                type="button"
                onClick={() => setPublishedPreviewBody(v.bodyMarkdown)}
                className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-fluid-2xs font-medium text-blue-900 hover:bg-blue-100"
              >
                배포본 미리보기
              </button>
            </div>
          ))}
          {publishedVersions.length === 0 ? (
            <p className="text-fluid-sm text-gray-500">아직 배포된 버전이 없습니다.</p>
          ) : null}
        </div>
      </details>

      <section className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-fluid-sm font-semibold text-red-900">위험 구역 — 데이터 삭제</h2>
        <p className="mt-1 text-fluid-xs text-red-900">
          체결 내역(`Submission`)이 없을 때만 전체 계약 정의가 삭제됩니다. 과거 증거가 있으면 API가 거부합니다.
        </p>
        {!delOpen ? (
          <button
            type="button"
            onClick={() => {
              setDelOpen(true);
              setDelPwd('');
            }}
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-fluid-sm text-red-800"
          >
            본인 비밀번호로 삭제 시도…
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label className="block text-fluid-xs text-red-900">본인 로그인 비밀번호</label>
              <input
                type="password"
                value={delPwd}
                onChange={(e) => setDelPwd(e.target.value)}
                className="mt-1 rounded-md border border-red-300 px-3 py-2 text-fluid-sm"
                autoComplete="current-password"
              />
            </div>
            <button
              type="button"
              disabled={deleting || !delPwd}
              onClick={() => void hardDelete()}
              className="rounded-lg bg-red-700 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setDelOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-800"
            >
              취소
            </button>
          </div>
        )}
      </section>

      <AdminEContractSubmissionDetailModal
        token={token}
        submissionId={submissionModalId}
        open={Boolean(submissionModalId)}
        onClose={() => setSubmissionModalId(null)}
      />

      <EContractDraftPreviewModal
        open={draftPreviewOpen}
        onClose={() => setDraftPreviewOpen(false)}
        token={token}
        bodyMarkdown={draftBody}
      />

      <EContractDraftPreviewModal
        open={publishedPreviewBody !== null}
        onClose={() => setPublishedPreviewBody(null)}
        token={token}
        bodyMarkdown={publishedPreviewBody ?? ''}
      />
    </div>
  );
}
