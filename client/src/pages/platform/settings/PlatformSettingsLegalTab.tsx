import { useCallback, useEffect, useState } from 'react';
import {
  createPlatformLegalDocument,
  createPlatformLegalInvite,
  deletePlatformLegalDocument,
  LEGAL_DOCUMENT_TYPE_LABELS,
  listPlatformLegalAgreements,
  listPlatformLegalDocuments,
  patchPlatformLegalDocument,
  type PlatformLegalDocument,
  type PlatformLegalDocumentType,
} from '../../../api/platformLegal';
import { getPlatformToken } from '../../../stores/platformAuth';
import { BTN_PRIMARY, CARD_SECTION, PlatformAlert } from '../../../utils/platformUi';

type EditorState = {
  mode: 'create' | 'edit';
  id?: string;
  title: string;
  documentType: PlatformLegalDocumentType;
  contentHtml: string;
  isPublished: boolean;
};

const EMPTY_EDITOR: EditorState = {
  mode: 'create',
  title: '',
  documentType: 'MEMBER_TERMS',
  contentHtml: '<p>내용을 입력하세요.</p>',
  isPublished: true,
};

function formatKst(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

export function PlatformSettingsLegalTab() {
  const [documents, setDocuments] = useState<PlatformLegalDocument[]>([]);
  const [agreementsTotal, setAgreementsTotal] = useState(0);
  const [agreements, setAgreements] = useState<
    Awaited<ReturnType<typeof listPlatformLegalAgreements>>['items']
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) {
      setLoading(false);
      setError('플랫폼 로그인이 필요합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [docsRes, agrRes] = await Promise.all([
        listPlatformLegalDocuments(token),
        listPlatformLegalAgreements(token, { limit: 30, offset: 0 }),
      ]);
      setDocuments(docsRes.items);
      setAgreements(agrRes.items);
      setAgreementsTotal(agrRes.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => setEditor({ ...EMPTY_EDITOR, mode: 'create' });

  const openEdit = (doc: PlatformLegalDocument) => {
    setEditor({
      mode: 'edit',
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      contentHtml: doc.contentHtml,
      isPublished: doc.isPublished,
    });
  };

  const saveEditor = async () => {
    const token = getPlatformToken();
    if (!token || !editor) return;
    const title = editor.title.trim();
    const contentHtml = editor.contentHtml.trim();
    if (!title || !contentHtml) {
      setError('제목과 본문을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editor.mode === 'create') {
        await createPlatformLegalDocument(token, {
          title,
          documentType: editor.documentType,
          contentHtml,
          isPublished: editor.isPublished,
        });
        setMessage('문서가 추가되었습니다.');
      } else if (editor.id) {
        await patchPlatformLegalDocument(token, editor.id, {
          title,
          contentHtml,
          isPublished: editor.isPublished,
        });
        setMessage('문서가 저장되었습니다.');
      }
      setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const removeDocument = async (doc: PlatformLegalDocument) => {
    if (!window.confirm(`「${doc.title}」 문서를 삭제할까요?`)) return;
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    setMessage('');
    try {
      await deletePlatformLegalDocument(token, doc.id);
      setMessage('삭제되었습니다.');
      if (editor?.id === doc.id) setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const issueInvite = async (documentId: string) => {
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    setMessage('');
    setInviteUrl('');
    try {
      const { invite } = await createPlatformLegalInvite(token, { documentId });
      const fullUrl = invite.agreeUrl.startsWith('http')
        ? invite.agreeUrl
        : `${window.location.origin}${invite.agreeUrl}`;
      setInviteUrl(fullUrl);
      setMessage('체결 링크가 발급되었습니다. 아래 URL을 복사해 전달하세요.');
      try {
        await navigator.clipboard.writeText(fullUrl);
        setMessage('체결 링크가 발급되었고 클립보드에 복사되었습니다.');
      } catch {
        /* clipboard optional */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '링크 발급 실패');
    }
  };

  if (loading) {
    return (
      <section className={`${CARD_SECTION} text-sm text-gray-500`}>불러오는 중…</section>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full max-w-4xl">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">회원사 이용약관·계약</h2>
            <p className="mt-1 text-xs text-gray-500">
              (주)서비스브릿지 · 청소비서 플랫폼 — 회원사(청소업체) 동의용 문서입니다.
            </p>
            <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <strong>고객용 약관</strong>은 발주서 하단 동의 문구입니다. 관리자 앱 → 발주서 →{' '}
              <strong>안내사항설정</strong>에서 편집하세요.
            </p>
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={openCreate}>
            새 문서
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {documents
            .filter((doc) => doc.documentType === 'MEMBER_TERMS')
            .map((doc) => (
            <li
              key={doc.id}
              className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{doc.title}</div>
                <div className="mt-0.5 text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{LEGAL_DOCUMENT_TYPE_LABELS[doc.documentType]}</span>
                  <span>v{doc.version}</span>
                  <span>{doc.isPublished ? '게시' : '비게시'}</span>
                  <span>체결 {doc.agreementCount}건</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
                  onClick={() => openEdit(doc)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  onClick={() => void issueInvite(doc.id)}
                >
                  링크 발급
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  onClick={() => void removeDocument(doc)}
                  disabled={doc.agreementCount > 0}
                  title={doc.agreementCount > 0 ? '체결 기록이 있으면 삭제할 수 없습니다' : undefined}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
        {documents.some((d) => d.documentType === 'CONSUMER_ORDER_CONSENT') ? (
          <p className="mt-3 text-xs text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            이전에 생성된 고객용 문서가 있습니다. 고객 동의는 발주서 안내사항을 사용하세요.
          </p>
        ) : null}

        {inviteUrl ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 break-all">
            <span className="font-semibold">체결 링크: </span>
            {inviteUrl}
          </div>
        ) : null}
      </section>

      {editor ? (
        <section className={`${CARD_SECTION} space-y-4`}>
          <h3 className="text-sm font-semibold text-gray-900">
            {editor.mode === 'create' ? '새 문서' : '문서 수정'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-600 sm:col-span-2">
              제목
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              />
            </label>
            {editor.mode === 'create' ? (
              <input type="hidden" value="MEMBER_TERMS" />
            ) : null}
            <label className="flex items-center gap-2 text-xs text-gray-600 self-end pb-2">
              <input
                type="checkbox"
                checked={editor.isPublished}
                onChange={(e) => setEditor({ ...editor, isPublished: e.target.checked })}
              />
              게시(링크 발급·체결 가능)
            </label>
          </div>
          <label className="block text-xs text-gray-600">
            본문 (HTML)
            <textarea
              className="mt-1 w-full min-h-[320px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono leading-relaxed"
              value={editor.contentHtml}
              onChange={(e) => setEditor({ ...editor, contentHtml: e.target.value })}
            />
          </label>
          <p className="text-xs text-gray-500">
            기본 문서는 최초 조회 시 자동 생성됩니다. 본문을 수정하면 버전이 올라가며, 이후 체결분부터
            새 내용이 적용됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void saveEditor()}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setEditor(null)}
            >
              취소
            </button>
          </div>
        </section>
      ) : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">체결 기록</h2>
          <span className="text-xs text-gray-500">총 {agreementsTotal}건</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
          >
            <option value="">전체 문서</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
            onClick={async () => {
              const token = getPlatformToken();
              if (!token) return;
              const agrRes = await listPlatformLegalAgreements(token, {
                documentId: selectedDocId || undefined,
                limit: 30,
                offset: 0,
              });
              setAgreements(agrRes.items);
              setAgreementsTotal(agrRes.total);
            }}
          >
            조회
          </button>
        </div>
        <div className="mt-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-center">
                <th className="px-2 py-2 font-medium">체결일</th>
                <th className="px-2 py-2 font-medium">문서</th>
                <th className="px-2 py-2 font-medium">회사명</th>
                <th className="px-2 py-2 font-medium">이름</th>
                <th className="px-2 py-2 font-medium">직책</th>
                <th className="px-2 py-2 font-medium">업체코드</th>
              </tr>
            </thead>
            <tbody>
              {agreements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-gray-500">
                    체결 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                agreements.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 text-center">
                    <td className="px-2 py-2 whitespace-nowrap">{formatKst(a.agreedAt)}</td>
                    <td className="px-2 py-2 truncate max-w-[140px]" title={a.documentTitle}>
                      {a.documentTitle}
                    </td>
                    <td className="px-2 py-2">{a.companyName}</td>
                    <td className="px-2 py-2">{a.signerName}</td>
                    <td className="px-2 py-2">{a.signerTitle}</td>
                    <td className="px-2 py-2">{a.tenantSlug ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
