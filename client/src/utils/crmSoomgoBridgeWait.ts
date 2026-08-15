import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';
import { fetchSoomgoBridgeStatus } from '../api/soomgoBridge';

/** 숨고 브릿지 — 채팅방 입장 완료까지 폴링 */
export async function waitForSoomgoInChatRoom(
  manifest: SoomgoBridgeManifest | null,
  opts?: { timeoutMs?: number; chatId?: string },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await fetchSoomgoBridgeStatus(manifest, { lite: true });
    if (s.inChatRoom && (!opts?.chatId || s.chatId === opts.chatId)) return true;
    await new Promise((r) => window.setTimeout(r, 500));
  }
  return false;
}
