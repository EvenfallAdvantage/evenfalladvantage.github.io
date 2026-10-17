/**
 * One-time acknowledgement required before the CCTV (traffic camera) layer is
 * first enabled. Stored per user in localStorage. Bump CCTV_ACK_VERSION when
 * the acknowledgement text materially changes to re-prompt everyone.
 */

export const CCTV_ACK_VERSION = 1;

type KV = Pick<Storage, "getItem" | "setItem">;

export function cctvAckKey(userId: string | null | undefined): string {
  return `overwatch-cctv-ack-v${CCTV_ACK_VERSION}-${userId || "anon"}`;
}

export function hasCctvAck(storage: KV | null | undefined, userId: string | null | undefined): boolean {
  if (!storage) return false;
  try {
    return !!storage.getItem(cctvAckKey(userId));
  } catch {
    return false;
  }
}

export function recordCctvAck(
  storage: KV | null | undefined,
  userId: string | null | undefined,
  now: Date = new Date(),
): void {
  if (!storage) return;
  try {
    storage.setItem(cctvAckKey(userId), now.toISOString());
  } catch {
    /* storage full / disabled: the ack simply won't persist */
  }
}

/**
 * Gate a layer-visibility transition. If the update would turn CCTV on and the
 * user hasn't acknowledged, CCTV stays off and `needsAck` is true.
 */
export function gateCctvEnable<T extends { cctv: boolean }>(
  prev: T,
  next: T,
  acked: boolean,
): { next: T; needsAck: boolean } {
  if (next.cctv && !prev.cctv && !acked) {
    return { next: { ...next, cctv: false }, needsAck: true };
  }
  return { next, needsAck: false };
}
