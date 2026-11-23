import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTelecrmUnsavedWorkCount,
  finishTelecrmWorkEntry,
  patchTelecrmWorkEntry,
  startTelecrmWorkEntry,
  type TelecrmWorkActions,
  type TelecrmWorkLeftBy,
  type TelecrmWorkSavedKind,
  type TelecrmWorkSource,
} from '../api/telecrmWorkHistory';
import { getToken } from '../stores/auth';
import type { CrmIntakeDraft } from '../utils/crmIntakeDraft';

/** 통화·문자·메시지·견적처럼 접수란 밖에서 일어난 일을 작업 기록에 알린다 */
export type CrmWorkActionDetail =
  | { kind: 'call' | 'sms' | 'soomgo' | 'miso' }
  | { kind: 'quote'; amountWon: number | null };

export type CrmWorkSavedDetail = {
  intakeKind: string;
  followupId?: string | null;
  inquiryId?: string | null;
  /** 저장 뒤 접수란을 비우는지(저장·부재+1) — 「저장 후 계속」은 false */
  freshStart: boolean;
};

const ACTION_EVENT = 'crm-work-action';
const SAVED_EVENT = 'crm-work-saved';

export function emitCrmWorkAction(detail: CrmWorkActionDetail) {
  window.dispatchEvent(new CustomEvent<CrmWorkActionDetail>(ACTION_EVENT, { detail }));
}

export function emitCrmWorkSaved(detail: CrmWorkSavedDetail) {
  window.dispatchEvent(new CustomEvent<CrmWorkSavedDetail>(SAVED_EVENT, { detail }));
}

type Identity = { nickname: string; customerName: string; contactPhone: string; safePhone: string };

type Current = {
  /** 서버에 줄을 만드는 중이면 아직 없다 — idPromise 로 기다린다 */
  idPromise: Promise<string | null>;
  source: TelecrmWorkSource;
  identity: Identity;
  actions: TelecrmWorkActions;
  draft: CrmIntakeDraft | null;
  dirty: boolean;
};

export type CrmWorkLeaveNotice = { entryId: string; label: string };

const EMPTY_ACTIONS: TelecrmWorkActions = {
  callCount: 0,
  quoteSent: false,
  quoteAmountWon: null,
  smsCount: 0,
  soomgoMessageCount: 0,
  misoMessageCount: 0,
  memoEdited: false,
  fieldsEdited: false,
};

const SAVED_KINDS: Record<string, TelecrmWorkSavedKind> = {
  requested: 'requested',
  absent: 'absent',
  hold: 'hold',
  deposit: 'deposit',
  reserved: 'reserved',
  received: 'received',
};

const digits = (raw: string) => raw.replace(/\D/g, '');

function identityOf(draft: CrmIntakeDraft): Identity {
  return {
    nickname: (draft.nickname ?? '').trim(),
    customerName: (draft.customerName ?? '').trim(),
    contactPhone: (draft.contactPhone ?? '').trim(),
    safePhone: (draft.safePhone ?? '').trim(),
  };
}

function hasIdentity(id: Identity): boolean {
  return Boolean(id.nickname || id.customerName || digits(id.contactPhone).length >= 4 || digits(id.safePhone).length >= 4);
}

function sameCustomer(a: Identity, b: Identity): boolean {
  if (a.customerName && a.customerName !== '고객' && a.customerName === b.customerName) return true;
  if (a.nickname && a.nickname === b.nickname) return true;
  const mine = [a.contactPhone, a.safePhone].map(digits).filter((d) => d.length >= 8);
  const theirs = [b.contactPhone, b.safePhone].map(digits).filter((d) => d.length >= 8);
  return mine.some((d) => theirs.includes(d));
}

/** 저장 시각처럼 내용과 상관없는 값은 빼고 비교한다 */
function coreOf(draft: CrmIntakeDraft): string {
  const { savedAt: _savedAt, ownerUserId: _owner, ...rest } = draft;
  void _savedAt;
  void _owner;
  return JSON.stringify(rest);
}

function touched(actions: TelecrmWorkActions): boolean {
  return (
    actions.callCount > 0 ||
    actions.quoteSent ||
    actions.smsCount > 0 ||
    actions.soomgoMessageCount > 0 ||
    actions.misoMessageCount > 0 ||
    actions.memoEdited ||
    actions.fieldsEdited
  );
}

/** 작업 기록 창에 보이는 한 줄 — 적다 만 내용을 짧게 */
function summarize(draft: CrmIntakeDraft | null): string | null {
  if (!draft) return null;
  const parts: string[] = [];
  if (draft.propertyType?.trim()) parts.push(draft.propertyType.trim());
  if (draft.pyeong?.trim()) parts.push(`${draft.pyeong.trim()}평`);
  const rooms = [
    draft.roomCount?.trim() ? `방${draft.roomCount.trim()}` : '',
    draft.bathroomCount?.trim() ? `화${draft.bathroomCount.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (rooms) parts.push(rooms);
  if (draft.preferredMoveInCleanYmd?.trim()) parts.push(`희망일 ${draft.preferredMoveInCleanYmd.trim().slice(5).replace('-', '.')}`);
  if (draft.address?.trim()) parts.push('주소 적음');
  const memoLines = (draft.requestMemo ?? '').split('\n').filter((line) => line.trim()).length;
  if (memoLines > 0) parts.push(`메모 ${memoLines}줄`);
  return parts.length ? parts.join(' · ') : null;
}

function labelOf(id: Identity): string {
  return id.nickname || id.customerName || id.contactPhone || id.safePhone || '고객';
}

/**
 * 접수란에 올라온 고객 한 명 = 작업 기록 한 줄.
 * 불러오면 시작하고, 통화·견적·수정이 있으면 갱신하고, 저장하거나 넘어가면 마무리한다.
 */
export function useCrmWorkTracker(opts: { enabled: boolean; operatingCompanyId: string | null }) {
  const { enabled, operatingCompanyId } = opts;
  const currentRef = useRef<Current | null>(null);
  const pendingLoadRef = useRef<{ source: TelecrmWorkSource; at: number; resumed: boolean } | null>(null);
  /** 「저장 후 계속」 직후 — 같은 내용이면 새 줄을 만들지 않는다 */
  const savedHoldRef = useRef<{ core: string; source: TelecrmWorkSource } | null>(null);
  const patchTimerRef = useRef<number | null>(null);
  /** 기록이 시작되기 전에 친 글자 — 직접 입력으로 시작한 고객은 처음부터 고친 것으로 본다 */
  const typedBeforeStartRef = useRef(false);
  const brandRef = useRef(operatingCompanyId);
  brandRef.current = operatingCompanyId;
  const [notice, setNotice] = useState<CrmWorkLeaveNotice | null>(null);
  const [unsavedCount, setUnsavedCount] = useState(0);

  const refreshUnsavedCount = useCallback(() => {
    const token = getToken();
    if (!token || !enabled) return;
    fetchTelecrmUnsavedWorkCount(token)
      .then((res) => setUnsavedCount(res.count))
      .catch(() => {
        /* 숫자를 못 받아도 CRM 은 그대로 쓴다 */
      });
  }, [enabled]);

  useEffect(() => {
    refreshUnsavedCount();
  }, [refreshUnsavedCount]);

  const flushPatch = useCallback(() => {
    if (patchTimerRef.current != null) {
      window.clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
    const cur = currentRef.current;
    const token = getToken();
    if (!cur || !cur.dirty || !token) return;
    cur.dirty = false;
    const body = {
      nickname: cur.identity.nickname || null,
      customerName: cur.identity.customerName || null,
      contactPhone: cur.identity.contactPhone || null,
      safePhone: cur.identity.safePhone || null,
      actions: { ...cur.actions },
      draft: touched(cur.actions) ? (cur.draft as unknown as Record<string, unknown> | null) : null,
      summary: summarize(cur.draft),
    };
    void cur.idPromise.then((id) => {
      if (!id) return;
      return patchTelecrmWorkEntry(token, id, body).catch(() => {
        /* 기록 갱신 실패는 상담을 막지 않는다 */
      });
    });
  }, []);

  const schedulePatch = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    cur.dirty = true;
    if (patchTimerRef.current != null) return;
    patchTimerRef.current = window.setTimeout(() => {
      patchTimerRef.current = null;
      flushPatch();
    }, 2500);
  }, [flushPatch]);

  const start = useCallback((source: TelecrmWorkSource, draft: CrmIntakeDraft, resumed: boolean) => {
    const token = getToken();
    if (!token) return;
    const identity = identityOf(draft);
    const cur: Current = {
      idPromise: startTelecrmWorkEntry(token, {
        source,
        operatingCompanyId: brandRef.current,
        nickname: identity.nickname || null,
        customerName: identity.customerName || null,
        contactPhone: identity.contactPhone || null,
        safePhone: identity.safePhone || null,
      })
        .then((res) => res.id)
        .catch(() => null),
      source,
      identity,
      actions: { ...EMPTY_ACTIONS, fieldsEdited: resumed || typedBeforeStartRef.current },
      draft,
      dirty: false,
    };
    typedBeforeStartRef.current = false;
    currentRef.current = cur;
  }, []);

  const finish = useCallback(
    (
      how:
        | { outcome: 'SAVED'; savedKind: TelecrmWorkSavedKind | null; followupId?: string | null; inquiryId?: string | null }
        | { outcome: 'LEFT'; leftBy: TelecrmWorkLeftBy; showNotice: boolean },
      keepalive = false,
    ) => {
      const cur = currentRef.current;
      if (!cur) return;
      if (patchTimerRef.current != null) {
        window.clearTimeout(patchTimerRef.current);
        patchTimerRef.current = null;
      }
      currentRef.current = null;
      const token = getToken();
      if (!token) return;
      const identityPatch = {
        nickname: cur.identity.nickname || null,
        customerName: cur.identity.customerName || null,
        contactPhone: cur.identity.contactPhone || null,
        safePhone: cur.identity.safePhone || null,
        actions: { ...cur.actions },
      };
      if (how.outcome === 'SAVED') {
        void cur.idPromise.then(async (id) => {
          if (!id) return;
          await patchTelecrmWorkEntry(token, id, identityPatch).catch(() => undefined);
          await finishTelecrmWorkEntry(token, id, {
            outcome: 'SAVED',
            savedKind: how.savedKind,
            followupId: how.followupId ?? null,
            inquiryId: how.inquiryId ?? null,
          }).catch(() => undefined);
        });
        return;
      }
      const unsaved = touched(cur.actions);
      const label = labelOf(cur.identity);
      void cur.idPromise.then(async (id) => {
        if (!id) return;
        if (!keepalive) await patchTelecrmWorkEntry(token, id, identityPatch).catch(() => undefined);
        await finishTelecrmWorkEntry(
          token,
          id,
          {
            outcome: unsaved ? 'UNSAVED' : 'VIEWED',
            leftBy: how.leftBy,
            draft: unsaved ? (cur.draft as unknown as Record<string, unknown> | null) : null,
            summary: summarize(cur.draft),
          },
          { keepalive },
        ).catch(() => undefined);
        if (unsaved && !keepalive) {
          if (how.showNotice) setNotice({ entryId: id, label });
          refreshUnsavedCount();
        }
      });
    },
    [refreshUnsavedCount],
  );

  /** 고객을 불러오는 곳에서 먼저 부른다 — 다음 접수란 변화가 「새 고객」인지 가리는 데 쓴다 */
  const noteLoad = useCallback((source: TelecrmWorkSource, loadOpts?: { resumed?: boolean }) => {
    pendingLoadRef.current = { source, at: Date.now(), resumed: loadOpts?.resumed === true };
    typedBeforeStartRef.current = false;
  }, []);

  /** 접수란 내용이 바뀔 때마다 부른다 */
  const observe = useCallback(
    (draft: CrmIntakeDraft | null) => {
      if (!enabled || !draft) return;
      const identity = identityOf(draft);
      if (!hasIdentity(identity)) return;
      const pending =
        pendingLoadRef.current && Date.now() - pendingLoadRef.current.at < 6000 ? pendingLoadRef.current : null;
      const cur = currentRef.current;
      if (cur) {
        if (pending && !sameCustomer(cur.identity, identity)) {
          pendingLoadRef.current = null;
          finish({ outcome: 'LEFT', leftBy: 'switch', showNotice: true });
          savedHoldRef.current = null;
          start(pending.source, draft, pending.resumed);
          return;
        }
        cur.identity = identity;
        cur.draft = draft;
        schedulePatch();
        return;
      }
      // 「저장 후 계속」 뒤 같은 내용이면 새 줄을 만들지 않는다
      const hold = savedHoldRef.current;
      if (!pending && hold && hold.core === coreOf(draft)) return;
      savedHoldRef.current = null;
      pendingLoadRef.current = null;
      start(pending?.source ?? hold?.source ?? 'manual', draft, pending?.resumed === true);
    },
    [enabled, finish, schedulePatch, start],
  );

  /** 접수란을 비울 때(초기화·신규 전환·채팅방 변경) */
  const leave = useCallback(
    (leftBy: TelecrmWorkLeftBy) => {
      savedHoldRef.current = null;
      finish({ outcome: 'LEFT', leftBy, showNotice: true });
    },
    [finish],
  );

  useEffect(() => {
    if (!enabled) return;
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<CrmWorkActionDetail>).detail;
      const cur = currentRef.current;
      if (!cur || !detail) return;
      if (detail.kind === 'call') cur.actions.callCount += 1;
      else if (detail.kind === 'sms') cur.actions.smsCount += 1;
      else if (detail.kind === 'soomgo') cur.actions.soomgoMessageCount += 1;
      else if (detail.kind === 'miso') cur.actions.misoMessageCount += 1;
      else if (detail.kind === 'quote') {
        cur.actions.quoteSent = true;
        cur.actions.quoteAmountWon = detail.amountWon;
      }
      schedulePatch();
    };
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent<CrmWorkSavedDetail>).detail;
      if (!detail) return;
      const cur = currentRef.current;
      savedHoldRef.current = !detail.freshStart && cur?.draft ? { core: coreOf(cur.draft), source: cur.source } : null;
      finish({
        outcome: 'SAVED',
        savedKind: SAVED_KINDS[detail.intakeKind] ?? null,
        followupId: detail.followupId ?? null,
        inquiryId: detail.inquiryId ?? null,
      });
      setNotice(null);
    };
    // 접수란에서 상담사가 직접 치거나 고른 것만 「고쳤다」로 본다 — 불러오기로 채워진 값은 세지 않는다
    const onUserInput = (e: Event) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('[data-crm-intake-root]')) return;
      if (target.closest('[data-crm-work-ignore]')) return;
      const cur = currentRef.current;
      if (!cur) {
        typedBeforeStartRef.current = true;
        return;
      }
      cur.actions.fieldsEdited = true;
      if (target.tagName === 'TEXTAREA') cur.actions.memoEdited = true;
      schedulePatch();
    };
    // 창을 닫거나 새로고침할 때 — 응답을 기다리지 않고 보낸다
    const onPageHide = () => finish({ outcome: 'LEFT', leftBy: 'close', showNotice: false }, true);
    window.addEventListener(ACTION_EVENT, onAction);
    window.addEventListener(SAVED_EVENT, onSaved);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('input', onUserInput, true);
    document.addEventListener('change', onUserInput, true);
    return () => {
      document.removeEventListener('input', onUserInput, true);
      document.removeEventListener('change', onUserInput, true);
      window.removeEventListener(ACTION_EVENT, onAction);
      window.removeEventListener(SAVED_EVENT, onSaved);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [enabled, finish, schedulePatch]);

  return {
    noteLoad,
    observe,
    leave,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    unsavedCount,
    refreshUnsavedCount,
  };
}
