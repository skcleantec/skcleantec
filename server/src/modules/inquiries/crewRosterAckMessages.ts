import { parseCrewMemberNoteToNames } from './crewMemberNoteCompare.js';

/** 이전·이후 노트에서 크루 팝업용 대표 이름 2명 도출 — 불가하면 null (기존 고객명 문구 폴백) */
export function pickTwoCrewNamesForAck(
  prevNote: string | null | undefined,
  nextNote: string | null | undefined,
): [string, string] | null {
  const prev = parseCrewMemberNoteToNames(prevNote);
  const next = parseCrewMemberNoteToNames(nextNote);
  if (prev.length === 0 && next.length === 0) return null;

  if (prev.length === next.length && prev.length > 0) {
    const diffIdx: number[] = [];
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== next[i]) diffIdx.push(i);
    }
    if (diffIdx.length === 1) {
      const i = diffIdx[0]!;
      return [prev[i]!, next[i]!];
    }
    if (diffIdx.length >= 2) {
      const uniq = new Set<string>();
      for (const i of diffIdx) {
        uniq.add(prev[i]!);
        uniq.add(next[i]!);
      }
      if (uniq.size === 2) {
        const sorted = [...uniq].sort((a, b) => a.localeCompare(b, 'ko'));
        return [sorted[0]!, sorted[1]!];
      }
    }
  }

  const merged = new Set([...prev, ...next]);
  if (merged.size === 2) {
    const sorted = [...merged].sort((a, b) => a.localeCompare(b, 'ko'));
    return [sorted[0]!, sorted[1]!];
  }
  return null;
}

/** 크루 WebSocket 확인 팝업 — 팀원 A·B 일정 변경 */
export function crewPairScheduleChangedAckMessages(
  nameA: string,
  nameB: string,
): { messageKo: string; messageTh: string } {
  const a = nameA.trim() || '?';
  const b = nameB.trim() || '?';
  return {
    messageKo: `팀원 ${a}와 팀원 ${b}의 일정이 변경되었습니다.`,
    messageTh: `สมาชิกทีม "${a}" กับสมาชิกทีม "${b}" มีการเปลี่ยนแปลงกำหนดการแล้ว`,
  };
}

/** 접수 PATCH 시 투입 변경 알림 문구 — 가능하면 이름 2명, 아니면 기존 접수 단위 안내 */
export function buildInquiryPatchCrewRosterAckMessages(
  prevNote: string | null | undefined,
  nextNote: string | null | undefined,
  options: {
    customerName: string;
    hadPrevMeeting: boolean;
  },
): { messageKo: string; messageTh: string } {
  const pair = pickTwoCrewNamesForAck(prevNote, nextNote);
  if (pair) {
    return crewPairScheduleChangedAckMessages(pair[0], pair[1]);
  }

  const cn = String(options.customerName ?? '').trim() || '고객';
  if (options.hadPrevMeeting) {
    return {
      messageKo: `「${cn}」 접수의 현장 팀원 구성이 바뀌어, 지정돼 있던 현장 미팅 시각을 초기화했습니다.`,
      messageTh: `งาน"${cn}" มีการเปลี่ยนทีมภาคสนาม เวลานัดภาคสนามที่หัวหน้ากำหนดจึงถูกรีเซ็ตแล้ว`,
    };
  }
  return {
    messageKo: `「${cn}」 접수의 현장 팀원(투입) 구성이 변경되었습니다.`,
    messageTh: `งาน"${cn}" มีการเปลี่ยนทีมงานภาคสนาม (การลงชื่อคนทำงานหรือจำนวนคน)`,
  };
}
