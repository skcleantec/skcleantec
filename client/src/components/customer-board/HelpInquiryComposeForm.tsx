import { useEffect, useMemo, useRef, useState } from 'react';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import {
  INQUIRY_CONSENT_VERSION,
  InquirySubmitError,
  createPublicCustomerInquiryPost,
  uploadPublicCustomerBoardImage,
  type PlatformBoardPost,
  type PublicCustomerBoardSettings,
} from '../../api/publicCustomerBoard';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { HelpInquiryComposeAssist } from './HelpInquiryComposeAssist';

type Field = 'authorName' | 'authorPhone' | 'authorEmail' | 'title' | 'bodyHtml' | 'privacyConsent';

const MESSAGES: Record<Field, string> = {
  authorName: '이름을 적어 주세요.',
  authorPhone: '휴대폰 번호를 010-0000-0000 형식으로 적어 주세요.',
  authorEmail: '답변 받을 이메일 주소를 확인해 주세요.',
  title: '제목을 적어 주세요.',
  bodyHtml: '문의 내용을 적어 주세요.',
  privacyConsent: '개인정보 수집·이용에 동의해 주세요.',
};

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;

/** 입력하는 대로 010-1234-5678 */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function isValidPhone(v: string): boolean {
  return /^01[016789]\d{7,8}$/.test(v.replace(/\D/g, ''));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildBodyHtml(text: string, photos: string[]): string {
  const paras = text
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`);
  const imgs = photos.map((url) => `<p><img src="${escapeHtml(url)}" alt="" /></p>`);
  return [...paras, ...imgs].join('') || '<p></p>';
}

const INPUT =
  'h-10 w-full rounded-lg border-0 bg-field px-3 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300';
const LABEL = 'shrink-0 text-fluid-sm font-bold text-slate-700';

function Req() {
  return <span className="text-rose-600"> *</span>;
}

function FieldError({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="mt-1 text-fluid-xs text-rose-600">{text}</p>;
}

type Props = {
  boardSlug: string;
  settings: PublicCustomerBoardSettings;
  initialTitle?: string;
  initialBody?: string;
  onCancel: () => void;
  onSubmitted: (post: PlatformBoardPost, email: string) => void;
  onPickArticle: (path: string) => void;
};

/** 1:1 문의 남기기 — PC: 왼쪽 폼(라벨 88px) + 오른쪽 376px 안내 / 휴대폰: 1열 + 아래 고정 버튼 */
export function HelpInquiryComposeForm({
  boardSlug,
  settings,
  initialTitle = '',
  initialBody = '',
  onCancel,
  onSubmitted,
  onPickArticle,
}: Props) {
  const [categoryId, setCategoryId] = useState(settings.categories[0]?.id ?? '');
  const [authorName, setAuthorName] = useState('');
  const [authorPhone, setAuthorPhone] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [title, setTitle] = useState(initialTitle);
  const [bodyText, setBodyText] = useState(initialBody);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(true);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<{ field: Field | null; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe(token)
      .then((me) => {
        if (me.name) setAuthorName((v) => v || me.name || '');
        if (me.email) setAuthorEmail((v) => v || me.email || '');
        if (me.phone) setAuthorPhone((v) => v || formatPhoneInput(me.phone ?? ''));
      })
      .catch(() => {});
  }, []);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (!authorName.trim()) e.authorName = MESSAGES.authorName;
    if (!isValidPhone(authorPhone)) e.authorPhone = MESSAGES.authorPhone;
    if (!EMAIL_RE.test(authorEmail.trim())) e.authorEmail = MESSAGES.authorEmail;
    if (!title.trim()) e.title = MESSAGES.title;
    if (!bodyText.trim() && photos.length === 0) e.bodyHtml = MESSAGES.bodyHtml;
    if (!consent) e.privacyConsent = MESSAGES.privacyConsent;
    return e;
  }, [authorName, authorPhone, authorEmail, title, bodyText, photos.length, consent]);

  const errorOf = (f: Field): string | null => {
    if (serverError?.field === f) return serverError.text;
    return tried ? errors[f] ?? null : null;
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const url = await uploadPublicCustomerBoardImage(boardSlug, file);
        setPhotos((prev) => [...prev, url].slice(0, 5));
      }
    } catch (e) {
      setServerError({ field: 'bodyHtml', text: e instanceof Error ? e.message : '사진을 올리지 못했어요.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    setTried(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      const r = await createPublicCustomerInquiryPost(boardSlug, {
        categoryId,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        authorPhone,
        privacyConsent: true,
        consentVersion: INQUIRY_CONSENT_VERSION,
        title: title.trim(),
        bodyHtml: buildBodyHtml(bodyText, photos),
        isSecret,
      });
      onSubmitted(r.post, authorEmail.trim());
    } catch (e) {
      const field = e instanceof InquirySubmitError ? (e.field as Field | null) : null;
      setServerError({
        field: field && field in MESSAGES ? field : null,
        text: e instanceof Error ? e.message : '문의를 남기지 못했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex items-center gap-2.5">
        <Button variant="quiet" size="sm" onClick={onCancel} className="-ml-2.5 text-slate-600">
          ‹ 문의 목록
        </Button>
        <h1 className="text-fluid-xl font-bold text-slate-900">1:1 문의 남기기</h1>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex min-w-0 flex-col gap-[18px] rounded-2xl bg-white p-4 shadow-card lg:flex-1 lg:px-7 lg:pb-6 lg:pt-7"
        >
          {settings.categories.length > 0 ? (
            <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-0">
              <span className={`${LABEL} lg:w-[88px]`}>문의 종류</span>
              <SegmentedControl
                ariaLabel="문의 종류"
                value={categoryId}
                onChange={setCategoryId}
                options={settings.categories.map((c) => ({ value: c.id, label: c.label }))}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-[18px] lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-6 lg:gap-y-2">
            <label className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-0">
              <span className={`${LABEL} lg:w-[88px] lg:pt-2.5`}>
                이름
                <Req />
              </span>
              <span className="lg:w-[200px]">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="홍길동"
                  autoComplete="name"
                  aria-invalid={Boolean(errorOf('authorName'))}
                  className={INPUT}
                />
                <FieldError text={errorOf('authorName')} />
              </span>
            </label>
            <label className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-0">
              <span className={`${LABEL} lg:w-[72px] lg:pt-2.5`}>
                휴대폰
                <Req />
              </span>
              <span className="lg:w-[200px]">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={authorPhone}
                  onChange={(e) => setAuthorPhone(formatPhoneInput(e.target.value))}
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  aria-invalid={Boolean(errorOf('authorPhone'))}
                  className={INPUT}
                />
                <FieldError text={errorOf('authorPhone')} />
              </span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-0">
            <span className={`${LABEL} lg:w-[88px] lg:pt-2.5`}>
              이메일
              <Req />
            </span>
            <span className="min-w-0">
              <span className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errorOf('authorEmail'))}
                  className={`${INPUT} lg:w-[320px]`}
                />
                <span className="text-fluid-xs text-slate-500">답변은 이 메일로 보내 드려요.</span>
              </span>
              <FieldError text={errorOf('authorEmail')} />
            </span>
          </label>

          <label className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-0">
            <span className={`${LABEL} lg:w-[88px] lg:pt-2.5`}>
              제목
              <Req />
            </span>
            <span className="min-w-0 lg:w-[560px] lg:max-w-full">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 현금영수증 발행 버튼이 안 눌려요"
                aria-invalid={Boolean(errorOf('title'))}
                className={INPUT}
              />
              <FieldError text={errorOf('title')} />
            </span>
          </label>

          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-0">
            <label htmlFor="inquiry-body" className={`${LABEL} lg:w-[88px] lg:pt-2.5`}>
              내용
              <Req />
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-[560px]">
              <textarea
                id="inquiry-body"
                rows={7}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어 주세요."
                aria-invalid={Boolean(errorOf('bodyHtml'))}
                className="w-full resize-y rounded-lg border-0 bg-field p-3 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {photos.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    <li key={url} className="relative">
                      <img src={url} alt="첨부한 화면 사진" className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        aria-label="사진 빼기"
                        onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void addPhotos(e.target.files)}
                />
                <Button
                  variant="secondary"
                  disabled={uploading || photos.length >= 5}
                  onClick={() => fileRef.current?.click()}
                  className="border-transparent bg-track font-bold text-slate-700"
                >
                  {uploading ? '올리는 중…' : '화면 사진 첨부'}
                </Button>
                <label className="flex items-center gap-1.5 text-fluid-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={isSecret}
                    onChange={(e) => setIsSecret(e.target.checked)}
                    className="h-4 w-4"
                  />
                  비밀글 (내 이메일로만 열람)
                </label>
              </div>
              <FieldError text={errorOf('bodyHtml')} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl bg-field px-4 py-3.5 lg:ml-[88px] lg:max-w-[560px]">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-fluid-sm font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0"
                />
                (필수) 개인정보 수집·이용에 동의합니다
              </label>
              <Button
                variant="quiet"
                size="sm"
                aria-expanded={consentOpen}
                onClick={() => setConsentOpen((v) => !v)}
                className="shrink-0 text-slate-600"
              >
                {consentOpen ? '내용 접기 ▴' : '내용 보기 ▾'}
              </Button>
            </div>
            {consentOpen ? (
              <table className="w-full overflow-hidden rounded-lg bg-white text-fluid-xs text-slate-700">
                <tbody>
                  <tr>
                    <th scope="row" className="w-24 px-2.5 py-2 text-left align-top font-bold">
                      수집 항목
                    </th>
                    <td className="px-2.5 py-2">이름, 휴대폰 번호, 이메일 주소, 문의 내용(첨부 사진 포함)</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2 text-left align-top font-bold">
                      이용 목적
                    </th>
                    <td className="px-2.5 py-2">문의 확인, 답변 및 처리 결과 안내</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2.5 py-2 text-left align-top font-bold">
                      보관 기간
                    </th>
                    <td className="px-2.5 py-2">
                      문의 처리 후 3년 보관 뒤 파기 (전자상거래법 소비자 불만·분쟁 처리 기록)
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
            <p className="text-fluid-2xs text-slate-500">
              동의하지 않으셔도 되지만, 동의하지 않으면 문의를 남길 수 없어요.
            </p>
            <FieldError text={errorOf('privacyConsent')} />
          </div>

          {serverError && !serverError.field ? (
            <p className="text-fluid-xs text-rose-600 lg:ml-[88px]">{serverError.text}</p>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-30 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-bar lg:static lg:z-auto lg:ml-[88px] lg:flex lg:items-center lg:gap-3 lg:bg-transparent lg:p-0 lg:shadow-none">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!consent || submitting || uploading}
              className="w-full lg:w-auto lg:px-7"
            >
              {submitting ? '남기는 중…' : '문의 남기기'}
            </Button>
            <span className="hidden text-fluid-xs text-slate-500 lg:inline">
              평일 오전 10시~오후 7시에 답해 드려요.
            </span>
          </div>
        </form>

        <aside className="min-w-0 lg:w-[376px] lg:shrink-0">
          <HelpInquiryComposeAssist title={title} onPickArticle={onPickArticle} />
        </aside>
      </div>
    </div>
  );
}
