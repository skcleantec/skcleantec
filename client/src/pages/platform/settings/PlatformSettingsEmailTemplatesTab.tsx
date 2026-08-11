import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OutboundEmailPurpose } from '@shared/outboundEmailPurpose';
import { OUTBOUND_EMAIL_PURPOSE_LABELS } from '@shared/outboundEmailPurpose';
import {
  getPlatformEmailTemplateCatalog,
  listPlatformEmailTemplates,
  patchPlatformEmailTemplate,
  type PlatformEmailPlaceholderDef,
  type PlatformEmailTemplateDto,
} from '../../../api/platformEmailTemplates';
import { getPlatformToken } from '../../../stores/platformAuth';
import { HelpCmsRichEditor } from '../../../components/help-cms/HelpCmsRichEditor';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlatformAlert,
} from '../../../utils/platformUi';

const PURPOSES: OutboundEmailPurpose[] = ['ORDER_FORM_SUBMISSION', 'INSPECTION_COMPLETION'];

type FormState = {
  label: string;
  enabled: boolean;
  subjectTemplate: string;
  headline: string;
  preheader: string;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
};

function dtoToForm(row: PlatformEmailTemplateDto): FormState {
  return {
    label: row.label,
    enabled: row.enabled,
    subjectTemplate: row.subjectTemplate,
    headline: row.headline,
    preheader: row.preheader ?? '',
    introHtml: row.introHtml || '<p></p>',
    footerHtml: row.footerHtml || '<p></p>',
    noreplyNoticeHtml: row.noreplyNoticeHtml || '<p></p>',
  };
}

function PlaceholderChips({
  items,
  onInsert,
}: {
  items: PlatformEmailPlaceholderDef[];
  onInsert: (token: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <button
          key={p.key}
          type="button"
          title={p.sample}
          onClick={() => onInsert(`{{${p.key}}}`)}
          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function PlatformSettingsEmailTemplatesTab() {
  const [purpose, setPurpose] = useState<OutboundEmailPurpose>('ORDER_FORM_SUBMISSION');
  const [templates, setTemplates] = useState<PlatformEmailTemplateDto[]>([]);
  const [subjectPlaceholders, setSubjectPlaceholders] = useState<PlatformEmailPlaceholderDef[]>([]);
  const [bodyPlaceholders, setBodyPlaceholders] = useState<
    Record<OutboundEmailPurpose, PlatformEmailPlaceholderDef[]>
  >({ ORDER_FORM_SUBMISSION: [], INSPECTION_COMPLETION: [] });
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const currentRow = useMemo(
    () => templates.find((t) => t.purpose === purpose) ?? null,
    [templates, purpose],
  );

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
      const [items, catalog] = await Promise.all([
        listPlatformEmailTemplates(token),
        getPlatformEmailTemplateCatalog(token),
      ]);
      setTemplates(items);
      setSubjectPlaceholders(catalog.subjectPlaceholders);
      setBodyPlaceholders(catalog.bodyPlaceholders);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (currentRow) setForm(dtoToForm(currentRow));
  }, [currentRow]);

  const insertIntoSubject = (token: string) => {
    setForm((f) => (f ? { ...f, subjectTemplate: `${f.subjectTemplate}${token}` } : f));
  };

  const save = async () => {
    const token = getPlatformToken();
    if (!token || !form) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchPlatformEmailTemplate(token, purpose, {
        label: form.label.trim(),
        enabled: form.enabled,
        subjectTemplate: form.subjectTemplate.trim(),
        headline: form.headline.trim(),
        preheader: form.preheader.trim() || null,
        introHtml: form.introHtml,
        footerHtml: form.footerHtml,
        noreplyNoticeHtml: form.noreplyNoticeHtml,
      });
      setTemplates((prev) => prev.map((t) => (t.purpose === purpose ? updated : t)));
      setMessage('저장했습니다. 다음 발송 메일부터 반영됩니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!form) {
    return <PlatformAlert variant="error" message={error || '템플릿을 불러올 수 없습니다.'} />;
  }

  const bodyPh = bodyPlaceholders[purpose] ?? [];

  return (
    <div className="space-y-4">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">고객 메일 문구</h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              발주서 제출 확인·현장검수 완료본 메일 본문입니다. 아래에 보이는 그대로 고객에게 발송됩니다(별도
              미리보기 없음). 접수·검수 상세 표는 자동으로 삽입됩니다.
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              className={`rounded-md px-3 py-1.5 text-fluid-2xs font-medium transition-colors ${
                purpose === p
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              {OUTBOUND_EMAIL_PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-fluid-xs text-gray-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => (f ? { ...f, enabled: e.target.checked } : f))}
          />
          이 유형 메일에 저장된 문구 사용
        </label>
        {!form.enabled ? (
          <p className="mt-1 text-fluid-2xs text-amber-700">
            끄면 코드 기본 문구(레거시)로 발송됩니다.
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-fluid-xs font-medium text-gray-800">메일 제목</span>
            <PlaceholderChips items={subjectPlaceholders} onInsert={insertIntoSubject} />
            <input
              value={form.subjectTemplate}
              onChange={(e) => setForm((f) => (f ? { ...f, subjectTemplate: e.target.value } : f))}
              className={INPUT_BASE}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-800">본문 헤드라인</span>
              <input
                value={form.headline}
                onChange={(e) => setForm((f) => (f ? { ...f, headline: e.target.value } : f))}
                className={INPUT_BASE}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-800">프리헤더(미리보기 한 줄)</span>
              <input
                value={form.preheader}
                onChange={(e) => setForm((f) => (f ? { ...f, preheader: e.target.value } : f))}
                className={INPUT_BASE}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-fluid-xs font-medium text-gray-800">인트로 본문</span>
              <span className="text-fluid-2xs text-gray-500">WYSIWYG — 보이는 그대로 저장</span>
            </div>
            <p className="text-fluid-2xs text-gray-500">
              동적 표·링크는 아래 자동 삽입됩니다. 칩은 본문에 넣을 수 있는 치환 문자입니다.
            </p>
            <PlaceholderChips
              items={bodyPh.filter((p) => !['detailSections', 'inspectionBody'].includes(p.key))}
              onInsert={(token) =>
                setForm((f) =>
                  f ? { ...f, introHtml: `${f.introHtml}<p>${token}</p>` } : f,
                )
              }
            />
            <HelpCmsRichEditor
              editorKey={`platform-email-intro-${purpose}`}
              value={form.introHtml}
              onChange={(html) => setForm((f) => (f ? { ...f, introHtml: html } : f))}
              onUploadImage={async () => {
                throw new Error('이메일 템플릿에서는 이미지 업로드를 지원하지 않습니다.');
              }}
              placeholder="고객에게 보이는 인사·서비스 안내를 입력하세요."
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-fluid-xs font-medium text-gray-800">하단 안내</span>
            <HelpCmsRichEditor
              editorKey={`platform-email-footer-${purpose}`}
              value={form.footerHtml}
              onChange={(html) => setForm((f) => (f ? { ...f, footerHtml: html } : f))}
              onUploadImage={async () => {
                throw new Error('이메일 템플릿에서는 이미지 업로드를 지원하지 않습니다.');
              }}
              placeholder="담당자 연락·추가 안내 등"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-fluid-xs font-medium text-gray-800">발신 전용(noreply) 안내</span>
            <HelpCmsRichEditor
              editorKey={`platform-email-noreply-${purpose}`}
              value={form.noreplyNoticeHtml}
              onChange={(html) => setForm((f) => (f ? { ...f, noreplyNoticeHtml: html } : f))}
              onUploadImage={async () => {
                throw new Error('이메일 템플릿에서는 이미지 업로드를 지원하지 않습니다.');
              }}
              placeholder="회신 불가 안내 — 고객이 답장하지 않도록"
            />
          </div>
        </div>

        {currentRow?.updatedAt && currentRow.isConfigured ? (
          <p className="mt-3 text-fluid-2xs text-gray-500">
            마지막 저장: {new Date(currentRow.updatedAt).toLocaleString('ko-KR')}
            {currentRow.updatedByEmail ? ` · ${currentRow.updatedByEmail}` : ''}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => currentRow && setForm(dtoToForm(currentRow))} className={BTN_SECONDARY}>
            되돌리기
          </button>
          <button type="button" disabled={saving} onClick={() => void save()} className={BTN_PRIMARY}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
