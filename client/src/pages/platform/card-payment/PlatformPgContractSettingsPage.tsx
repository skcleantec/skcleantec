import { useEffect, useState } from 'react';
import { BTN_PRIMARY, CARD_SECTION, INPUT_BASE } from '../../../utils/platformUi';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { API } from '../../../api/apiPrefix';
import { getPlatformToken } from '../../../stores/platformAuth';

type Field = {
  token: string;
  label: string;
  inputType: 'TEXT' | 'TEXTAREA' | 'DATE' | 'NUMBER' | 'PHONE' | 'CHECKBOX' | 'SEAL';
  required: boolean;
  sortOrder: number;
};

const TYPES: Field['inputType'][] = ['TEXT', 'TEXTAREA', 'DATE', 'NUMBER', 'PHONE', 'CHECKBOX', 'SEAL'];
const TYPE_LABEL: Record<Field['inputType'], string> = {
  TEXT: '한 줄',
  TEXTAREA: '여러 줄',
  DATE: '날짜',
  NUMBER: '숫자',
  PHONE: '연락처',
  CHECKBOX: '체크',
  SEAL: '도장',
};

function headers() {
  return { Authorization: `Bearer ${getPlatformToken()}`, 'Content-Type': 'application/json' };
}

export function PlatformPgContractSettingsPage() {
  const [title, setTitle] = useState('카드결제 이용약관');
  const [bodyHtml, setBodyHtml] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const [label, setLabel] = useState('');
  const [inputType, setInputType] = useState<Field['inputType']>('TEXT');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`${API}/platform/card-payment/contract`, { headers: headers() })
      .then(async (res) => {
        if (!res.ok) throw new Error('불러오지 못했습니다.');
        return res.json() as Promise<{ title: string; bodyHtml: string; fields: Field[] }>;
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
    setFields((prev) => [
      ...prev,
      { token, label: name, inputType, required: true, sortOrder: (prev.length + 1) * 10 },
    ]);
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
    <div className="min-w-0 w-full max-w-3xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">전자계약</h1>
        <PlatformCardPaymentTabs />
        <p className="mt-1 text-sm text-gray-500">PG 신청이 승인되면 업체가 다음 단계에서 이 계약서를 칸마다 작성합니다.</p>
      </div>
      {msg ? <p className="text-sm text-gray-800">{msg}</p> : null}
      <section className={CARD_SECTION}>
        <label className="block text-sm text-gray-700">
          제목
          <input className={`${INPUT_BASE} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm text-gray-700">
          본문
          <textarea
            className={`${INPUT_BASE} mt-1 min-h-48 font-mono text-xs`}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
          />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          도장 자리는 [[EC_SEAL]], 서명 자리는 [[EC_SIGNATURE]] 입니다. 같은 도장 코드를 여러 번 넣으면 한 번 올린 도장이 그 자리마다 들어갑니다.
        </p>
      </section>
      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">칸</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-800">
          {fields.map((field) => (
            <li key={field.token} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {field.label} · {TYPE_LABEL[field.inputType]} · {field.token}
              </span>
              <button
                type="button"
                className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => setFields((prev) => prev.filter((item) => item.token !== field.token))}
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            className={INPUT_BASE}
            value={label}
            placeholder="칸 이름"
            onChange={(e) => setLabel(e.target.value)}
          />
          <select className={INPUT_BASE} value={inputType} onChange={(e) => setInputType(e.target.value as Field['inputType'])}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
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
        <button type="button" className={`${BTN_PRIMARY} mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} disabled={busy} onClick={() => void save()}>
          저장
        </button>
      </section>
    </div>
  );
}
