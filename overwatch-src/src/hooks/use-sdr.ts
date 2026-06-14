"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSdrStore } from "@/stores/sdr-store";
import { loadWasm, getWasm, getSdrController } from "@/lib/sdr/rtl-sdr";
import { SdrBridge } from "@/lib/sdr/sdr-bridge";
import { getPlatform, isDesktop } from "@/lib/sdr/platform";
import { BUFFER_SIZE } from "@/lib/sdr/types";
import type { DemodMode } from "@/lib/sdr/types";
import type { SdrRoleKey } from "@/lib/sdr/device-types";
import { RadioTranscriber } from "@/lib/sdr/radio-transcriber";
import { setAdsbAircraft } from "@/lib/sdr/adsb-store";

type SdrSession = {
  type: "bridge" | "webusb";
  ctrl: SdrBridge | ReturnType<typeof getSdrController>;
};

let globalSdrSession: SdrSession | null = null;
let globalAnalyserNode: AnalyserNode | null = null;
let companionCheckDone = false;

export function getGlobalAnalyserNode(): AnalyserNode | null { return globalAnalyserNode; }

export function globalTune(freqHz: number, mode?: DemodMode): void {
  const { setFrequency, setMode } = useSdrStore.getState();
  setFrequency(freqHz);
  if (mode) setMode(mode);
  if (globalSdrSession) {
    globalSdrSession.ctrl.setFrequency(freqHz);
    if (globalSdrSession.type === "webusb") {
      const wasm = getWasm();
      if (wasm) wasm.sdr_tune(freqHz);
    }
  }
}

if (typeof globalThis !== "undefined" && typeof window !== "undefined") {
  (window as unknown as { globalTune: typeof globalTune }).globalTune = globalTune;
}

export function useSdr() {
  const store = useSdrStore();
  const wasmLoading = useRef(false);
  const session = useRef<SdrSession | null>(null);
  const transcriberRef = useRef<RadioTranscriber | null>(null);

  useEffect(() => {
    if (wasmLoading.current) return;
    wasmLoading.current = true;
    (async () => {
      try {
        await loadWasm();
        store.setWasmLoaded(true);
        if (globalSdrSession && !session.current) {
          session.current = globalSdrSession;
          globalSdrSession.ctrl.resumeAudio();
        }
      } catch (err) {
        store.setWasmLoaded(false, err instanceof Error ? err.message : "Failed to load WASM");
      }
    })();
    return () => {
      session.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companionCheckDone) return;
    const platform = getPlatform();
    if (platform !== "windows") return;
    
    companionCheckDone = true;
    
    const checkCompanion = async () => {
      try {
        const bridge = new SdrBridge();
        await bridge.connect();
        store.setCompanionAvailable(true);
        setTimeout(() => bridge.disconnect(), 100);
      } catch {
      }
    };
    checkCompanion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTranscriber = useCallback(() => {
    if (!store.transcriptionEnabled || !session.current) return;
    if (transcriberRef.current) return;
    const ctrl = session.current.ctrl;
    const transcriber = new RadioTranscriber({
      freqHz: store.frequency,
      onTranscription: (t) => store.addTranscription(t),
    });
    ctrl.onAudio = (chunk) => transcriber.feed(chunk);
    transcriber.start();
    transcriberRef.current = transcriber;
  }, [store]);

  const connect = useCallback(async () => {
    store.setConnection("connecting");

    // Try companion service first
    try {
      const bridge = new SdrBridge();
      bridge.onAdsbData = setAdsbAircraft;
      bridge.onDeviceCatalog = (devices, assignment) => {
        store.setDeviceCatalog(devices, assignment);
      };
      await bridge.connect();
      bridge.resumeAudio();
      await bridge.startStream((level) => store.setSignalLevel(level));
      if (store.frequency > 0) {
        bridge.setFrequency(store.frequency);
      } else if (bridge.companionFreq) {
        store.setFrequency(bridge.companionFreq);
      }
      session.current = { type: "bridge", ctrl: bridge };
      globalSdrSession = session.current;
      globalAnalyserNode = bridge.analyserNode;
      store.setConnection("connected", {
        vendorId: 0x0bda, productId: 0x2838,
        manufacturerName: "Realtek", productName: "RTL-SDR via Companion",
      });
      startTranscriber();
      return;
    } catch {
    }

    // WebUSB fallback
    if (!navigator.usb) {
      store.setError("WebUSB not supported. Use Chrome/Edge.");
      return;
    }

    const wasm = getWasm();
    if (!wasm) {
      store.setError("WASM module not loaded yet.");
      return;
    }

    try {
      const ctrl = getSdrController();
      await ctrl.connect();
      ctrl.resumeAudio();
      if (store.frequency > 0) {
        await ctrl.setFrequency(store.frequency);
        wasm.sdr_tune(store.frequency);
      }
      session.current = { type: "webusb", ctrl };
      globalSdrSession = session.current;
      globalAnalyserNode = ctrl.analyserNode;
      store.setConnection("connected", {
        vendorId: 0x0bda, productId: 0x2832,
        manufacturerName: "Realtek", productName: "RTL-SDR USB Dongle",
      });
      startTranscriber();

      await ctrl.startStream((level) => store.setSignalLevel(level));

      const readLoop = async () => {
        while (ctrl.isConnected()) {
          const data = await ctrl.readBulk();
          if (!data) continue;
          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          new Uint8Array(wasm.memory.buffer).set(bytes, 0);
          const samplesOut = wasm.fm_demodulate(0, BUFFER_SIZE, bytes.length / 2);
          if (samplesOut > 0) {
            const audioBuf = new Float32Array(wasm.memory.buffer, BUFFER_SIZE, samplesOut);
            const frame = new Float32Array(audioBuf);
            ctrl.feedAudio(frame);
          }
        }
      };
      readLoop();
    } catch (err) {
      store.setConnection("error");
      const platform = getPlatform();
      let errorMsg = err instanceof Error ? err.message : "Connection failed";
      if (platform === "windows") {
        errorMsg = "SDR Companion app not found.\n\nPlease download and run the SDR companion app for Windows:\nhttps://github.com/EvenfallAdvantage/evenfalladvantage.github.io/releases/latest\n\nOnce launched, click 'Connect SDR' again.";
      } else if (isDesktop()) {
        errorMsg = "SDR connection failed.\n\nDirect USB access requires Chrome/Edge and librtlsdr installed.\nTry the companion app instead: https://github.com/EvenfallAdvantage/evenfalladvantage.github.io";
      } else {
        errorMsg = "Live SDR tuning requires a desktop browser (Chrome/Edge) with WebUSB support.\nYour device or browser does not meet these requirements.";
      }
      store.setError(errorMsg);
    }
  }, [store, startTranscriber]);

  const disconnect = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }
    if (session.current) { session.current.ctrl.disconnect(); session.current = null; globalSdrSession = null; globalAnalyserNode = null; }
    store.setAdsbRunning(false);
    store.disconnect();
  }, [store]);

  const tune = useCallback(async (freqHz: number, mode?: DemodMode) => {
    store.setFrequency(freqHz);
    if (mode) store.setMode(mode);
    if (session.current) {
      await session.current.ctrl.setFrequency(freqHz);
      if (session.current.type === "webusb") {
        const wasm = getWasm();
        if (wasm) wasm.sdr_tune(freqHz);
      }
    }
    if (transcriberRef.current) {
      transcriberRef.current.setFrequency(freqHz);
    }
  }, [store]);

  const setTranscriptionEnabled = useCallback(async (enabled: boolean) => {
    store.setTranscriptionEnabled(enabled);
    if (enabled && !transcriberRef.current) {
      startTranscriber();
    } else if (!enabled && transcriberRef.current) {
      const ctrl = session.current?.ctrl;
      if (ctrl) ctrl.onAudio = null;
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }
  }, [store, startTranscriber]);

  const gainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setGain = useCallback(async (gain: number) => {
    store.setGain(gain);
    if (session.current) {
      clearTimeout(gainTimer.current);
      gainTimer.current = setTimeout(() => {
        session.current?.ctrl.setGain(gain);
      }, 200);
    }
  }, [store]);

  const setVolume = useCallback((vol: number) => {
    store.setVolume(vol);
    if (session.current) session.current.ctrl.setVolume(vol);
  }, [store]);

  const squelchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setSquelch = useCallback(async (squelch: number) => {
    store.setSquelch(squelch);
    if (session.current) {
      clearTimeout(squelchTimer.current);
      squelchTimer.current = setTimeout(() => {
        session.current?.ctrl.setSquelch(squelch);
      }, 200);
    }
  }, [store]);
  const setMode = useCallback((mode: DemodMode) => store.setMode(mode), [store]);

  const adsbStart = useCallback(async () => {
    const s = session.current;
    if (s?.type === "bridge") {
      await (s.ctrl as SdrBridge).adsbStart();
      store.setAdsbRunning(true);
    }
  }, [store]);

  const adsbStop = useCallback(async () => {
    const s = session.current;
    if (s?.type === "bridge") {
      await (s.ctrl as SdrBridge).adsbStop();
      store.setAdsbRunning(false);
    }
  }, [store]);

  const enumerateDevices = useCallback(async (): Promise<string[]> => {
    const s = session.current;
    if (s?.type === "bridge") {
      return (s.ctrl as SdrBridge).enumerateDevices();
    }
    return [];
  }, []);

  const assignDevice = useCallback(async (role: SdrRoleKey, deviceIndex: number | null) => {
    const s = session.current;
    if (s?.type === "bridge") {
      await (s.ctrl as SdrBridge).assignDevice(role, deviceIndex);
    }
  }, []);

  return {
    ...store, connect, disconnect, tune, setGain, setSquelch, setVolume, setMode,
    setTranscriptionEnabled,
    adsbStart, adsbStop, enumerateDevices, assignDevice,
  };
}

