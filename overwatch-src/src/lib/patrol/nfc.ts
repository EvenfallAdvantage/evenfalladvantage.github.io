/** Web NFC (Chrome on Android only). Everything degrades to "unsupported" elsewhere. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NDEF = any;

export function nfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/** Listen for one tag; resolves its first URL/text record. Abort with the signal. */
export async function readNfcOnce(signal: AbortSignal): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader: NDEF = new (window as any).NDEFReader();
  await reader.scan({ signal });
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    reader.onreadingerror = () => reject(new Error("Couldn't read that tag. Hold it still against the back of the phone."));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reader.onreading = (ev: any) => {
      const dec = new TextDecoder();
      for (const rec of ev.message?.records ?? []) {
        if (rec.recordType === "url" || rec.recordType === "text" || rec.recordType === "absolute-url") {
          try { resolve(dec.decode(rec.data)); return; } catch { /* next */ }
        }
      }
      if (ev.serialNumber) resolve(String(ev.serialNumber)); else reject(new Error("Tag has no checkpoint data"));
    };
  });
}

export async function writeNfcUrl(url: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w: NDEF = new (window as any).NDEFReader();
  await w.write({ records: [{ recordType: "url", data: url }] });
}
