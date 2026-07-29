import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublicLegalDocument, type PublicLegalDocument } from '../../api/platformLegal';
import { TenantBrandLogo } from '../../components/brand/TenantBrandLogo';

function formatKst(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

export function LegalDocumentViewPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [document, setDocument] = useState<PublicLegalDocument | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    setLoadErr(null);
    setDocument(null);
    try {
      const { document: doc } = await fetchPublicLegalDocument(s);
      setDocument(doc);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center">
          <div className="flex justify-center">
            <TenantBrandLogo surface="on-light" className="h-9" />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">청소비서 · (주)서비스브릿지</p>
        </header>

        {loadErr ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700">
            {loadErr}
          </div>
        ) : null}

        {!loadErr && !document ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            불러오는 중…
          </div>
        ) : null}

        {document ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900">{document.title}</h1>
            <p className="mt-1 text-xs text-gray-500">
              문서 버전 v{document.version} · 최종 수정 {formatKst(document.updatedAt)}
            </p>
            <div
              className="legal-document-body mt-4 rounded-lg border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-800 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: document.contentHtml }}
            />
          </section>
        ) : null}

        <p className="mt-6 text-center text-fluid-2xs text-slate-500">
          <Link to="/signup" className="font-medium text-slate-800 underline-offset-2 hover:underline">
            회원가입으로 돌아가기
          </Link>
          {' · '}
          <Link to="/login" className="font-medium text-slate-800 underline-offset-2 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
