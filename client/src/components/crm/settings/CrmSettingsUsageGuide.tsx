import { Fragment, useState, type ReactNode } from 'react';
import type { SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { Button } from '../../ui/Button';
import { fillCrmMessageFields, type CrmMessageFieldsMenu } from './crmMessageFields';

/** 설정 화면 위 「이 설정이 쓰이는 곳」 안내 — 실제 CRM 화면 사진 + 강조 박스 + 한 줄 설명 */
export type CrmSettingsGuideKey =
  | 'scripts'
  | 'pricing'
  | 'general'
  | 'quote-learning'
  | 'leadSource'
  | 'soomgo'
  | 'sms'
  | 'soomgo-presets'
  | 'soomgo-auto';

type Guide = {
  image: 'crm-main' | 'crm-sms' | 'crm-soomgo-message';
  /** 사진 위 강조 박스 — 왼쪽·위·너비·높이 (%) */
  rect: [number, number, number, number];
  where: string;
  /** 고객에게 보내는 설정만 — 「언제 보내지나요?」 */
  when?: string[];
};

const GUIDES: Record<CrmSettingsGuideKey, Guide> = {
  scripts: {
    image: 'crm-main',
    rect: [36.3, 9.1, 34.3, 77.5],
    where: '통화 중 가운데 「상담 스크립트」 칸에 보여요. 검색하거나 번호 키로 바로 찾아 읽을 수 있어요.',
  },
  pricing: {
    image: 'crm-main',
    rect: [71.7, 47.4, 27.3, 18.1],
    where: '오른쪽 「가격 안내」의 항목 단추(입주 기본·추가 옵션 등)로 보여요. 누르면 안내 목록에 들어가요.',
  },
  general: {
    image: 'crm-main',
    rect: [72.2, 51, 26.4, 4.6],
    where: '평수를 넣으면 「평당 ○원」으로 기본 견적이 계산돼요. AI 추천가와 비교하는 기준이기도 해요.',
  },
  'quote-learning': {
    image: 'crm-main',
    rect: [72.8, 16.5, 25.2, 30.5],
    where: '「가격 안내」 맨 위 AI 추천가 칸이 여기서 모은 실제 예약으로 계산돼요.',
  },
  leadSource: {
    image: 'crm-main',
    rect: [22.8, 61.2, 11.6, 12.2],
    where: '접수 칸의 「유입 경로」 선택 목록이에요. 발주서·접수 저장할 때도 같은 목록을 써요.',
  },
  soomgo: {
    image: 'crm-main',
    rect: [64.3, 1.6, 8.9, 4.3],
    where: '위쪽 「숨고 연동」 단추와 PC 숨고 프로그램 연결이에요. 숨고 메시지·견적보내기가 이 연결로 나가요.',
  },
  sms: {
    image: 'crm-sms',
    rect: [10.4, 0.5, 31.8, 99],
    where: '왼쪽 「문자 발송」을 누르면 여기서 만든 문구가 「저장 문구」로 보여요.',
    when: ['상담사가 「문자 발송」에서 문구를 골라 보낼 때'],
  },
  'soomgo-presets': {
    image: 'crm-soomgo-message',
    rect: [10.4, 0.5, 36.1, 99],
    where: '왼쪽 「숨고 메시지」를 누르면 여기서 만든 단추가 보여요. 누르면 열린 숨고 채팅방으로 바로 보내져요.',
    when: ['상담사가 「숨고 메시지」에서 단추를 누를 때'],
  },
  'soomgo-auto': {
    image: 'crm-main',
    rect: [72.6, 92.8, 5.9, 4.3],
    where: '상담사가 따로 누르지 않아도 숨고 채팅방으로 자동으로 나가는 메시지예요.',
    when: [
      '상담사가 「통화」 단추를 누를 때 (「통화」 탭)',
      '「견적보내기」를 누를 때',
      '처리 구분(부재·요청·예약완료 등)을 저장할 때',
    ],
  },
};

const COLLAPSE_KEY = 'crm.settingsGuide.collapsed.v1';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function CrmSettingsUsageGuide({ guideKey }: { guideKey: CrmSettingsGuideKey }) {
  const guide = GUIDES[guideKey];
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* 저장 못 해도 화면은 그대로 */
    }
  };
  const [l, t, w, h] = guide.rect;
  const src = `${import.meta.env.BASE_URL}crm-help/${guide.image}.webp`;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-fluid-xs font-semibold text-slate-800">이 설정이 쓰이는 곳</p>
        {collapsed ? <p className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-500">{guide.where}</p> : <span className="flex-1" />}
        <Button size="sm" variant="quiet" onClick={toggle} className="shrink-0 !h-6 text-slate-500">
          {collapsed ? '펼치기' : '접기'}
        </Button>
      </div>
      {collapsed ? null : (
        <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,340px)_1fr]">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img src={src} alt="CRM 화면에서 이 설정이 보이는 위치" className="block w-full" loading="lazy" />
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-lg border-2 border-rose-500 bg-rose-400/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]"
              style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-fluid-xs leading-relaxed text-slate-700">{guide.where}</p>
            {guide.when?.length ? (
              <div>
                <p className="text-fluid-2xs font-semibold text-slate-600">언제 보내지나요?</p>
                <ul className="mt-0.5 space-y-0.5">
                  {guide.when.map((item) => (
                    <li key={item} className="flex gap-1.5 text-fluid-2xs text-slate-600">
                      <span className="text-violet-500">●</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

/** 「고객이 받는 모습」 — 말풍선 미리보기 */
export function CrmCustomerMessagePreview({
  steps,
  channel,
  menu,
}: {
  steps: SoomgoMessageStep[];
  channel: 'sms' | 'soomgo';
  /** 이 메뉴에서 바뀌는 치환코드만 예시 값으로 — 안 바뀌는 코드는 빨갛게 */
  menu?: CrmMessageFieldsMenu;
}) {
  const visible = steps.filter((s) => (s.type === 'text' ? s.text.trim() : s.urls.length > 0));
  if (visible.length === 0) return null;
  const filled = visible.map((step) => (step.type === 'text' ? fillCrmMessageFields(step.text, menu) : null));
  const leftover = new Set<string>();
  for (const t of filled) {
    if (!t) continue;
    for (const m of t.matchAll(/\{([^{}]+)\}/g)) leftover.add(m[1]);
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-2.5">
      <p className="mb-1.5 text-fluid-2xs font-semibold text-slate-600">
        고객이 받는 모습 <span className="font-normal text-slate-400">· {channel === 'sms' ? '문자' : '숨고 채팅'} 예시</span>
      </p>
      <div className="space-y-1.5">
        {visible.map((step, i) =>
          step.type === 'text' ? (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-white px-3 py-1.5 text-fluid-xs leading-relaxed text-slate-800 shadow-sm ${
                channel === 'soomgo' ? 'ring-1 ring-slate-200' : ''
              }`}
            >
              {renderLeftoverFields(filled[i] ?? '')}
            </div>
          ) : (
            <div key={i} className="flex flex-wrap gap-1">
              {step.urls.map((url, j) => (
                <PreviewImage key={`${url}-${j}`} url={url} />
              ))}
            </div>
          ),
        )}
      </div>
      {leftover.size > 0 ? (
        <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-fluid-2xs text-amber-900">
          ⚠ {[...leftover].map((k) => `「{${k}}」`).join(' ')}은(는) 여기서 바뀌지 않는 코드예요. 글자 그대로 나가니 지우거나 「치환코드 보기」에서 맞는 코드를 골라 주세요.
        </p>
      ) : null}
    </div>
  );
}

/** 바뀌지 않고 남은 「{…}」 를 빨간 물결 밑줄로 */
function renderLeftoverFields(text: string): ReactNode {
  return text.split(/(\{[^{}]+\})/g).map((part, i) =>
    /^\{[^{}]+\}$/.test(part) ? (
      <span key={i} className="rounded-lg bg-rose-50 px-0.5 font-semibold text-rose-700 underline decoration-rose-400 decoration-wavy">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function PreviewImage({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !url) {
    return (
      <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-fluid-2xs text-slate-400">
        사진
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
    />
  );
}

/** 저장된 문구 보기 — 「{고객명}」 같은 칸을 글자 대신 작은 표시로 보여 줌 */
export function renderCrmMessageFields(text: string): ReactNode {
  const parts = text.split(/(\{[^{}]+\})/g);
  return parts.map((part, i) => {
    const m = /^\{([^{}]+)\}$/.exec(part);
    if (!m) return <Fragment key={i}>{part}</Fragment>;
    return (
      <span key={i} className="mx-0.5 rounded-lg bg-violet-100 px-1 text-violet-700">
        {m[1].trim()}
      </span>
    );
  });
}
