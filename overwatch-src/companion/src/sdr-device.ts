import { usb, Device, InEndpoint } from "usb";

const RTL_USB_VID = 0x0bda;
const RTL_USB_PIDS = [0x2832, 0x2838, 0x2830, 0x2820, 0x2812];
const BUFFER_SIZE = 0x4000; // 16 KB
const R820T_I2C = 0x34;
const RTL_XTAL = 28_800_000;
const RTL_DEFAULT_SAMPLE_RATE = 1_024_000;

export class SdrDevice {
  private dev: Device | null = null;
  private inEndpoint: InEndpoint | null = null;
  private streaming = false;
  private onData: ((buf: Buffer) => void) | null = null;

  private currentFreqHz = 0;

  async open(): Promise<void> {
    for (const pid of RTL_USB_PIDS) {
      const d = usb.findByIds(RTL_USB_VID, pid);
      if (d) { this.dev = d; break; }
    }
    if (!this.dev) throw new Error("No RTL-SDR found");

    this.dev.open();
    this.dev.selectConfiguration(1);
    const iface = this.dev.interface(0);
    iface.claim();

    const ep = iface.endpoints.find((e: { direction: string; transferType: number }) => e.direction === "in" && e.transferType === 2);
    if (!ep) throw new Error("No bulk IN endpoint found");
    this.inEndpoint = ep as InEndpoint;

    await this.vendorCtrl(0x01, 0x0001, 0x0000);
    await this.vendorCtrl(0x81, 0x0002, 0x0000);
    await this.vendorCtrl(0x61, 0x0000, 0x0000);
    await this.sleep(5);

    await this.demodWrite(0x01, 0x01);
    await this.demodWrite(0x06, 0x0f);
    for (const r of [0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c]) await this.demodWrite(r, 0x00);
    await this.setSampleRate(RTL_DEFAULT_SAMPLE_RATE);
    await this.r820tInit();
    await this.r820tSetFreq(100_000_000);
  }

  close(): void {
    this.stopStream();
    if (this.dev) { try { this.dev.close(); } catch {} this.dev = null; }
  }

  isOpen(): boolean { return this.dev !== null; }

  async setFrequency(freqHz: number): Promise<void> {
    if (!this.dev) return;
    this.currentFreqHz = freqHz;
    await this.demodWrite(0x01, 0x11);
    await this.r820tSetFreq(freqHz);
    await this.demodWrite(0x01, 0x01);
  }

  async setGain(gainDb: number): Promise<void> {
    if (!this.dev) return;
    const idx = Math.max(0, Math.min(49, Math.round(gainDb)));
    const lna = Math.min(15, Math.floor(idx / 3));
    const mix = Math.min(15, idx % 3 === 0 ? 0 : (idx % 3) * 5 + 5);
    await this.demodWrite(0x01, 0x11);
    await this.i2cWrite(0x0d, (lna << 4) | 0x00);
    await this.i2cWrite(0x0c, 0x9f | (mix << 4));
    await this.demodWrite(0x01, 0x01);
  }

  onBulkData(cb: (buf: Buffer) => void): void { this.onData = cb; }

  startStream(): void {
    if (this.streaming || !this.inEndpoint) return;
    this.streaming = true;
    this.inEndpoint.startPoll(1, BUFFER_SIZE);
    this.inEndpoint.on("data", (data: Buffer) => {
      if (this.onData) this.onData(data);
    });
    this.inEndpoint.on("error", () => {});
  }

  stopStream(): void {
    this.streaming = false;
    if (this.inEndpoint) {
      try { this.inEndpoint.stopPoll(); } catch {}
    }
  }

  // ── Private: RTL2832U control transfers ─────────────

  private async vendorCtrl(request: number, value: number, index: number): Promise<void> {
    await this.dev!.controlTransferOut(0x40, request, value, index);
  }

  private async demodWrite(addr: number, val: number): Promise<void> {
    await this.dev!.controlTransferOut(0x40, 0x04, addr, val);
  }

  private async i2cWrite(reg: number, val: number): Promise<void> {
    await this.demodWrite(0x1b, reg);
    await this.demodWrite(0x19, val);
    await this.demodWrite(0x1c, (R820T_I2C << 1) | 0x01);
    await this.sleep(1);
  }

  private async setSampleRate(sr: number): Promise<void> {
    const ratio = Math.floor(RTL_XTAL / sr);
    await this.demodWrite(0x9f, (ratio >> 16) & 0x3f);
    await this.demodWrite(0x9e, (ratio >> 8) & 0xff);
    await this.demodWrite(0x9d, ratio & 0xff);
    await this.demodWrite(0x06, sr > 2_400_000 ? 0x13 : 0x0f);
  }

  private async r820tInit(): Promise<void> {
    await this.demodWrite(0x01, 0x11);
    const tbl: [number, number][] = [
      [0x05,0x00],[0x06,0x00],[0x07,0x00],[0x08,0x40],[0x09,0x80],[0x0a,0x00],[0x0b,0x00],[0x0c,0x9f],
      [0x0d,0x00],[0x0e,0x40],[0x0f,0x40],[0x10,0x00],[0x11,0x00],[0x12,0x00],[0x13,0x00],[0x14,0x00],
      [0x15,0x00],[0x16,0x00],[0x17,0x50],[0x18,0x40],[0x19,0x00],[0x1a,0x00],[0x1b,0x00],[0x1c,0x00],
      [0x1d,0x00],[0x1e,0x00],[0x1f,0x40],[0x20,0x40],[0x21,0x00],[0x22,0x00],[0x23,0x00],[0x24,0xc0],
      [0x25,0x00],[0x26,0x00],[0x27,0x30],[0x28,0x00],[0x29,0x00],[0x2a,0x00],[0x2b,0x00],[0x2c,0x00],
      [0x2d,0x00],[0x2e,0x00],[0x2f,0x00],[0x30,0x00],[0x31,0x00],[0x32,0x00],[0x33,0x00],[0x34,0x00],
      [0x35,0x00],[0x36,0x00],[0x37,0x00],[0x38,0x00],[0x39,0x00],[0x3a,0x00],[0x3b,0x00],[0x3c,0x00],
      [0x3d,0x00],[0x3e,0x00],[0x3f,0x80],
    ];
    for (const [r, v] of tbl) await this.i2cWrite(r, v);
    await this.sleep(10);
    await this.demodWrite(0x01, 0x01);
  }

  private async r820tSetFreq(freqHz: number): Promise<void> {
    let div = 1;
    let vco = freqHz;
    while (vco < 1_770_000_000 && div <= 64) { div *= 2; vco = freqHz * div; }
    if (vco > 3_630_000_000) { div /= 2; vco = freqHz * div; }
    const dc: Record<number,number> = { 1:0, 2:1, 4:2, 8:3, 16:4, 32:5, 64:6 };
    const code = dc[div] ?? 2;
    const xtal = 16_000_000;
    const nint = Math.floor(vco / xtal);
    const frac = Math.round(((vco % xtal) / xtal) * 4096);
    await this.i2cWrite(0x07, 0x00);
    await this.i2cWrite(0x08, 0x40 | (code << 4));
    await this.i2cWrite(0x09, nint & 0xff);
    await this.i2cWrite(0x0a, ((nint >> 8) & 0x0f) | ((frac >> 4) & 0xf0));
    await this.i2cWrite(0x0b, ((frac & 0x0f) << 4) | 0x08);
    const filt = freqHz >= 900_000_000 ? 0x60 : freqHz >= 600_000_000 ? 0x50 : freqHz >= 400_000_000 ? 0x40 : freqHz >= 200_000_000 ? 0x30 : freqHz >= 100_000_000 ? 0x20 : freqHz >= 50_000_000 ? 0x10 : 0x00;
    await this.i2cWrite(0x0e, filt);
    await this.i2cWrite(0x0f, filt);
    await this.i2cWrite(0x13, 0x00);
    await this.sleep(5);
    await this.i2cWrite(0x13, 0x40);
    await this.sleep(10);
    this.currentFreqHz = freqHz;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
