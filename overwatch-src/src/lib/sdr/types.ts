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
  _sdr_init: () => number;
  _sdr_tune: (freq_hz: number) => number;
  _sdr_set_gain: (gain: number) => void;
  _sdr_read_samples: (bufPtr: number, len: number) => number;
  _fm_demodulate: (iqPtr: number, audioPtr: number, len: number) => number;
  _get_signal_level: () => number;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
}

export const RTL_USB_VENDOR_ID = 0x0bda;
export const RTL_USB_PRODUCT_IDS = [0x2832, 0x2838, 0x2830, 0x2820, 0x2812];

export const DEFAULT_SAMPLE_RATE = 1_024_000;
export const DEFAULT_GAIN = 25;
export const DEFAULT_SQUELCH = 30;
export const DEFAULT_VOLUME = 0.7;
export const BUFFER_SIZE = 65536;
export const AUDIO_SAMPLE_RATE = 48000;
