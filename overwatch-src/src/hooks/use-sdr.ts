"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSdrStore } from "@/stores/sdr-store";
import { loadWasm, getWasm, getSdrController, destroySdrController } from "@/lib/sdr/rtl-sdr";
import { SdrBridge } from "@/lib/sdr/sdr-bridge";
import { BUFFER_SIZE } from "@/lib/sdr/types";
import type { DemodMode } from "@/lib/sdr/types";

type SdrSession = {
  type: "bridge" | "webusb";
  ctrl: SdrBridge | ReturnType<typeof getSdrController>;
};

export function useSdr() {
  const store = useSdrStore();
  const wasmLoading = useRef(false);
  const session = useRef<SdrSession | null>(null);

  useEffect(() => {
    if (wasmLoading.current) return;
    wasmLoading.current = true;
    (async () => {
      try {
        await loadWasm();
        store.setWasmLoaded(true);
      } catch (err) {
        store.setWasmLoaded(false, err instanceof Error ? err.message : "Failed to load WASM");
      }
    })();
    return () => { session.current = null; destroySdrController(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    store.setConnection("connecting");

    // Try companion service first
    try {
      const bridge = new SdrBridge();
      await bridge.connect();
      bridge.resumeAudio();
      bridge.startStream((level) => store.setSignalLevel(level));
      if (store.frequency > 0) bridge.setFrequency(store.frequency);
      session.current = { type: "bridge", ctrl: bridge };
      store.setConnection("connected", {
        vendorId: 0x0bda, productId: 0x2838,
        manufacturerName: "Realtek", productName: "RTL-SDR via Companion",
      });
      return;
    } catch {
      // companion not available -> fall back to WebUSB
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
      store.setConnection("connected", {
        vendorId: 0x0bda, productId: 0x2832,
        manufacturerName: "Realtek", productName: "RTL-SDR USB Dongle",
      });

      ctrl.startStream((level) => store.setSignalLevel(level));

      const readLoop = async () => {
        while (ctrl.isConnected()) {
          const data = await ctrl.readBulk();
          if (!data) continue;
          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          new Uint8Array(wasm.memory.buffer).set(bytes, 0);
          const samplesOut = wasm.fm_demodulate(0, BUFFER_SIZE, bytes.length / 2);
          if (samplesOut > 0) {
            const audioBuf = new Float32Array(wasm.memory.buffer, BUFFER_SIZE, samplesOut);
            ctrl.feedAudio(new Float32Array(audioBuf));
          }
        }
      };
      readLoop();
    } catch (err) {
      store.setConnection("error");
      store.setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [store]);

  const disconnect = useCallback(() => {
    if (session.current) { session.current.ctrl.disconnect(); session.current = null; }
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
  }, [store]);

  const setGain = useCallback(async (gain: number) => {
    store.setGain(gain);
    if (session.current) await session.current.ctrl.setGain(gain);
  }, [store]);

  const setVolume = useCallback((vol: number) => {
    store.setVolume(vol);
    if (session.current) session.current.ctrl.setVolume(vol);
  }, [store]);

  const setSquelch = useCallback(async (squelch: number) => {
    store.setSquelch(squelch);
    if (session.current) await session.current.ctrl.setSquelch(squelch);
  }, [store]);
  const setMode = useCallback((mode: DemodMode) => store.setMode(mode), [store]);

  return { ...store, connect, disconnect, tune, setGain, setSquelch, setVolume, setMode };
}
