export type DemodMode = "fm" | "nfm" | "am";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface SdrDeviceInfo {
  vendorId: number;
  productId: number;
  manufacturerName?: string;
  productName?: string;
  serialNumber?: string;
}

export interface SdrState {
  connection: ConnectionState;
  device: SdrDeviceInfo | null;
  frequency: number;
  sampleRate: number;
  gain: number;
  squelch: number;
  volume: number;
  mode: DemodMode;
  signalLevel: number;
  errorMessage: string | null;
}

export interface WasmSdrModule {
  memory: WebAssembly.Memory;
  sdr_init: () => number;
  sdr_tune: (freq_hz: number) => number;
  sdr_set_gain: (gain: number) => void;
  fm_demodulate: (iqPtr: number, audioPtr: number, len: number) => number;
  get_signal_level: () => number;
  set_signal_level: (level: number) => void;
}

export const RTL_USB_VENDOR_ID = 0x0bda;
export const RTL_USB_PRODUCT_IDS = [0x2832, 0x2838, 0x2830, 0x2820, 0x2812];

export const DEFAULT_SAMPLE_RATE = 1_024_000;
export const DEFAULT_GAIN = 25;
export const DEFAULT_SQUELCH = 30;
export const DEFAULT_VOLUME = 0.7;
export const BUFFER_SIZE = 65536;
export const AUDIO_SAMPLE_RATE = 48000;
