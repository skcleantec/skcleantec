import { useEffect, useState } from 'react';
import { BTN_PRIMARY, CARD_SECTION, INPUT_BASE } from '../../../utils/platformUi';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { API } from '../../../api/apiPrefix';
import { getPlatformToken } from '../../../stores/platformAuth';
import { PgContractFillPreviewModal } from './PgContractFillPreviewModal';
import {
  PG_CONTRACT_TYPE_LABEL,
  PgContractPreview,
  placeFieldInContract,
  type PgContractFieldDraft,
} from './PgContractPreview';

const TYPES = Object.keys(PG_CONTRACT_TYPE_LABEL) as PgContractFieldDraft['inputType'][];

function headers() {
  return { Authorization: `Bearer ${getPlatformToken()}`, 'Content-Type': 'application/json' };
}

export function PlatformPgContractSettingsPage() {
  const [title, setTitle] = useState('카드결제 이용계약');
  const [bodyHtml, setBodyHtml] = useState('');
  const [fields, setFields] = useState<PgContractFieldDraft[]>([]);
  const [label, setLabel] = useState('');
  const [inputType, setInputType] = useState<PgContractFieldDraft['inputType']>('TEXT');
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    void fetch(`${API}/platform/card-payment/contract`, { headers: headers() })
      .then(async (res) => {
        if (!res.ok) throw new Error('불러오지 못했습니다.');
        return res.json() as Promise<{ title: string; bodyHtml: string; fields: PgContractFieldDraft[] }>;
      })
      .then((data) => {
        setTitle(data.title);
        setBodyHtml(data.bodyHtml);
        setFields(data.fields);
      })
      .catch((e: unknown) => setMsg(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, []);

  const addField = () => {
    const name = label.trim();
    if (!name) return;
    const base = inputType === 'SEAL' ? 'SEAL' : inputType === 'CHECKBOX' ? 'CHECK' : `FIELD_${fields.length + 1}`;
    let token = `[[EC_${base}]]`;
    let n = 2;
    while (fields.some((field) => field.token === token)) {
      token = `[[EC_${base}_${n}]]`;
      n += 1;
    }
    const next = { token, label: name, inputType, required: true, sortOrder: (fields.length + 1) * 10 };
    setFields((prev) => [...prev, next]);
    setBodyHtml((prev) => placeFieldInContract(prev, next));
    setActiveToken(token);
    setLabel('');
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/platform/card-payment/contract`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ title, bodyHtml, fields }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setMsg('저장했습니다. PG 승인이 난 업체가 이 계약서를 작성합니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-4xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">전자계약</h1>
        <PlatformCardPaymentTabs />
        <p className="mt-1 text-sm text-gray-500">
          작성 화면 미리보기에서 업체가 칸마다 적고 체크하는 화면을 그대로 볼 수 있습니다. 미리보기에 적은 내용은 저장되지 않습니다.
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          onClick={() => setPreviewOpen(true)}
        >
          작성 화면 미리보기
        </button>
      </div>
      <PgContractFillPreviewModal
        open={previewOpen}
        title={title}
        bodyHtml={bodyHtml}
        fields={fields}
        onClose={() => setPreviewOpen(false)}
      />
      {msg ? <p className="text-sm text-gray-800">{msg}</p> : null}
      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">계약서 미리보기</h2>
          <p className="text-xs text-gray-500">파란 칸이 업체가 적는 자리입니다. 노란 칸은 아직 입력 칸으로 지정되지 않았습니다.</p>
        </div>
        <label className="block text-sm text-gray-700">
          계약서 제목
          <input className={`${INPUT_BASE} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <PgContractPreview
          title={title}
          bodyHtml={bodyHtml}
          fields={fields}
          activeToken={activeToken}
          onSelect={setActiveToken}
        />
      </section>
      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">입력 칸</h2>
        <ul className="space-y-2 text-sm text-gray-800">
          {fields.map((field) => {
            const placed = bodyHtml.includes(field.token);
            return (
              <li key={field.token} className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 truncate text-left hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => setActiveToken(field.token)}
                >
                  {field.label} · {PG_CONTRACT_TYPE_LABEL[field.inputType]} · {placed ? '계약서에 있음' : '계약서에 없음'}
                </button>
                <span className="flex shrink-0 gap-1">
                  {placed ? null : (
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      onClick={() => {
                        setBodyHtml((prev) => placeFieldInContract(prev, field));
                        setActiveToken(field.token);
                      }}
                    >
                      계약서에 넣기
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    onClick={() => setFields((prev) => prev.filter((item) => item.token !== field.token))}
                  >
                    빼기
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <input className={INPUT_BASE} value={label} placeholder="칸 이름" onChange={(e) => setLabel(e.target.value)} />
          <select
            className={INPUT_BASE}
            value={inputType}
            onChange={(e) => setInputType(e.target.value as PgContractFieldDraft['inputType'])}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {PG_CONTRACT_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={addField}
            disabled={!label.trim()}
          >
            칸 추가
          </button>
        </div>
        <details className="rounded-lg border border-slate-200 px-3 py-2">
          <summary className="cursor-pointer text-sm text-slate-700">계약서 문구 고치기</summary>
          <textarea
            className={`${INPUT_BASE} mt-2 min-h-48 font-mono text-xs`}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            도장 자리는 [[EC_SEAL]], 서명 자리는 [[EC_SIGNATURE]] 입니다. 같은 도장 코드를 여러 번 넣으면 한 번 올린 도장이 그 자리마다 들어갑니다.
          </p>
        </details>
        <button
          type="button"
          className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`}
          disabled={busy}
          onClick={() => void save()}
        >
          저장
        </button>
      </section>
    </div>
  );
}
