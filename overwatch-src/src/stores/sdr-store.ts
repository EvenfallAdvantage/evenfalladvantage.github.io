import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import type { DemodMode, ConnectionState, SdrDeviceInfo } from "@/lib/sdr/types";
import type { Transcription } from "@/lib/sdr/radio-transcriber";
import type { DeviceInfo, DeviceAssignment } from "@/lib/sdr/device-types";
import {
  DEFAULT_SAMPLE_RATE, DEFAULT_GAIN, DEFAULT_SQUELCH, DEFAULT_VOLUME,
} from "@/lib/sdr/types";

interface SdrStoreState {
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
  wasmLoaded: boolean;
  wasmError: string | null;
  companionAvailable: boolean;
  transcriptionEnabled: boolean;
  transcriptions: Transcription[];
  adsbRunning: boolean;
  deviceCatalog: DeviceInfo[];
  deviceAssignment: DeviceAssignment;

  setConnection: (connection: ConnectionState, device?: SdrDeviceInfo | null) => void;
  setFrequency: (freq: number) => void;
  setGain: (gain: number) => void;
  setSquelch: (squelch: number) => void;
  setVolume: (volume: number) => void;
  setMode: (mode: DemodMode) => void;
  setSignalLevel: (level: number) => void;
  setError: (msg: string | null) => void;
  setWasmLoaded: (loaded: boolean, error?: string | null) => void;
  setCompanionAvailable: (available: boolean) => void;
  setTranscriptionEnabled: (enabled: boolean) => void;
  addTranscription: (t: Transcription) => void;
  clearTranscriptions: () => void;
  setAdsbRunning: (running: boolean) => void;
  setDeviceCatalog: (catalog: DeviceInfo[], assignment: DeviceAssignment) => void;
  setDeviceAssignment: (assignment: DeviceAssignment) => void;
  disconnect: () => void;
}

export const useSdrStore = create<SdrStoreState>()((set) => ({
  connection: "disconnected",
  device: null,
  frequency: 0,
  sampleRate: DEFAULT_SAMPLE_RATE,
  gain: DEFAULT_GAIN,
  squelch: DEFAULT_SQUELCH,
  volume: DEFAULT_VOLUME,
  mode: "fm",
  signalLevel: 0,
  errorMessage: null,
  wasmLoaded: false,
  wasmError: null,
  companionAvailable: false,
  transcriptionEnabled: false,
  transcriptions: [],
  adsbRunning: false,
  deviceCatalog: [],
  deviceAssignment: { radio: null, adsb: null },

  setConnection: (connection, device) => set({ connection, device: device ?? null }),
  setFrequency: (frequency) => set({ frequency }),
  setGain: (gain) => set({ gain }),
  setSquelch: (squelch) => set({ squelch }),
  setVolume: (volume) => set({ volume }),
  setMode: (mode) => set({ mode }),
  setSignalLevel: (signalLevel) => set({ signalLevel }),
  setError: (errorMessage) => set({ errorMessage }),
  setWasmLoaded: (wasmLoaded, wasmError) => set({ wasmLoaded, wasmError: wasmError ?? null }),
  setCompanionAvailable: (companionAvailable) => set({ companionAvailable }),
  setTranscriptionEnabled: (transcriptionEnabled) => set({ transcriptionEnabled }),
  addTranscription: (t) => set((s) => ({ transcriptions: [...s.transcriptions, t] })),
  clearTranscriptions: () => set({ transcriptions: [] }),
  setAdsbRunning: (adsbRunning) => set({ adsbRunning }),
  setDeviceCatalog: (deviceCatalog, deviceAssignment) => set({ deviceCatalog, deviceAssignment }),
  setDeviceAssignment: (deviceAssignment) => set({ deviceAssignment }),
  disconnect: () => set({
    connection: "disconnected", device: null, frequency: 0, signalLevel: 0,
    deviceCatalog: [], deviceAssignment: { radio: null, adsb: null },
  }),
}));

export function useSdrStoreShallow<T>(selector: (s: SdrStoreState) => T): T {
  return useSdrStore(useShallow(selector));
}
