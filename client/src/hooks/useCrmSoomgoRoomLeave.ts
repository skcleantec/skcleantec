import { useEffect, useRef, type RefObject } from 'react';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import type { CrmIntakeDraft } from '../utils/crmIntakeDraft';
import {
  decideSoomgoRoomLeave,
  soomgoRoomSnapshot,
  type SoomgoRoomLeaveDecision,
  type SoomgoSelfNavKind,
} from '../utils/crmSoomgoRoomLeave';

/** 목록·방 전환을 한 번 본 뒤, 1초 뒤 짧게 다시 확인 */
export const SOOMGO_ROOM_LEAVE_RECHECK_MS = 1000;

type SelfNav = { until: number; kind: SoomgoSelfNavKind };

/**
 * 숨고 창이 채팅방에서 벗어나면 접수란을 비운다.
 * 팝업 창·휴대폰 앱도 이 판정을 그대로 쓴다. 상태가 안 들어오면 비우지 않는다.
 */
export function useCrmSoomgoRoomLeave({
  status,
  busy,
  selfNavRef,
  buildDraft,
  refreshStatus,
  onLeave,
  onRoomSeen,
}: {
  status: SoomgoBridgeStatus | null;
  busy: boolean;
  selfNavRef: RefObject<SelfNav | null>;
  buildDraft: () => CrmIntakeDraft | null;
  refreshStatus: (options?: { lite?: boolean }) => Promise<SoomgoBridgeStatus>;
  onLeave: (decision: Extract<SoomgoRoomLeaveDecision, 'clear-list' | 'clear-room'>, draft: CrmIntakeDraft) => void;
  onRoomSeen: (chatId: string) => void;
}) {
  const baselineRef = useRef<ReturnType<typeof soomgoRoomSnapshot> | null>(null);
  const confirmKeyRef = useRef<string | null>(null);
  const confirmGenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const buildDraftRef = useRef(buildDraft);
  const refreshRef = useRef(refreshStatus);
  const onLeaveRef = useRef(onLeave);
  const onRoomSeenRef = useRef(onRoomSeen);
  const busyRef = useRef(busy);
  buildDraftRef.current = buildDraft;
  refreshRef.current = refreshStatus;
  onLeaveRef.current = onLeave;
  onRoomSeenRef.current = onRoomSeen;
  busyRef.current = busy;

  useEffect(() => {
    return () => {
      confirmGenRef.current += 1;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const cancelConfirm = () => {
      confirmGenRef.current += 1;
      confirmKeyRef.current = null;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!status?.bridgeRunning) {
      baselineRef.current = null;
      cancelConfirm();
      return;
    }

    const next = soomgoRoomSnapshot(status);
    const nav = selfNavRef.current;
    const selfNav = nav && Date.now() < nav.until ? nav.kind : null;
    const decision = decideSoomgoRoomLeave({
      prev: baselineRef.current,
      next,
      hasContent: Boolean(buildDraftRef.current()),
      busy: busyRef.current,
      selfNav,
    });

    if (decision === 'defer') return;

    if (decision !== 'clear-list' && decision !== 'clear-room') {
      baselineRef.current = next;
      if (next.inRoom && next.chatId) onRoomSeenRef.current(next.chatId);
      cancelConfirm();
      return;
    }

    const key = `${baselineRef.current?.chatId ?? ''}→${next.inRoom ? next.chatId ?? '' : 'list'}`;
    if (confirmKeyRef.current === key) return;
    cancelConfirm();
    confirmKeyRef.current = key;
    const gen = confirmGenRef.current;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void (async () => {
        if (confirmGenRef.current !== gen) return;
        let refreshed: SoomgoBridgeStatus;
        try {
          refreshed = await refreshRef.current({ lite: true });
        } catch {
          if (confirmGenRef.current === gen) confirmKeyRef.current = null;
          return;
        }
        if (confirmGenRef.current !== gen) return;
        const next2 = soomgoRoomSnapshot(refreshed);
        const nav2 = selfNavRef.current;
        const selfNav2 = nav2 && Date.now() < nav2.until ? nav2.kind : null;
        const again = decideSoomgoRoomLeave({
          prev: baselineRef.current,
          next: next2,
          hasContent: Boolean(buildDraftRef.current()),
          busy: busyRef.current,
          selfNav: selfNav2,
        });
        confirmKeyRef.current = null;
        if (again !== 'clear-list' && again !== 'clear-room') {
          if (again !== 'defer') baselineRef.current = next2;
          return;
        }
        const draft = buildDraftRef.current();
        baselineRef.current = next2;
        if (!draft) return;
        onLeaveRef.current(again, draft);
      })();
    }, SOOMGO_ROOM_LEAVE_RECHECK_MS);
  }, [busy, selfNavRef, status]);
}
