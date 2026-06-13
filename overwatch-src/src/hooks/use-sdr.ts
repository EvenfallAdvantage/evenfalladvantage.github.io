"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSdrStore } from "@/stores/sdr-store";
import { loadWasm, getWasm, getSdrController, destroySdrController } from "@/lib/sdr/rtl-sdr";
import { BUFFER_SIZE } from "@/lib/sdr/types";
import type { DemodMode } from "@/lib/sdr/types";

export function useSdr() {
  const store = useSdrStore();
  const wasmLoading = useRef(false);

  // Load WASM on mount
  useEffect(() => {
    if (wasmLoading.current) return;
    wasmLoading.current = true;

    (async () => {
      try {
        await loadWasm();
        store.setWasmLoaded(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load WASM module";
        store.setWasmLoaded(false, msg);
      }
    })();

    return () => {
      destroySdrController();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect SDR
  const connect = useCallback(async () => {
    if (!navigator.usb) {
      store.setError("WebUSB not supported. Use Chrome/Edge.");
      return;
    }

    const wasm = getWasm();
    if (!wasm) {
      store.setError("WASM module not loaded yet.");
      return;
    }

    store.setConnection("connecting");
    try {
      const ctrl = getSdrController();
      await ctrl.connect();

      store.setConnection("connected", {
        vendorId: 0x0bda,
        productId: 0x2832,
        manufacturerName: "Realtek",
        productName: "RTL-SDR USB Dongle",
      });

      // Start streaming loop
      ctrl.startStream((level) => {
        store.setSignalLevel(level);
      });

      const readLoop = async () => {
        while (ctrl.isConnected()) {
          const data = await ctrl.readBulk();
          if (!data) continue;

          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          // WASM linear memory layout:
          //   0 .. BUFFER_SIZE-1   = I/Q samples (uint8)
          //   BUFFER_SIZE .. *     = audio output (float32)
          const iqPtr = 0;
          const audioPtr = BUFFER_SIZE;
          new Uint8Array(wasm.memory.buffer).set(bytes, iqPtr);

          const samplesOut = wasm.fm_demodulate(iqPtr, audioPtr, bytes.length / 2);
          if (samplesOut > 0) {
            const audioBuf = new Float32Array(wasm.memory.buffer, audioPtr, samplesOut);
            ctrl.feedAudio(new Float32Array(audioBuf));
          }
        }
      };
      readLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      store.setConnection("error");
      store.setError(msg);
    }
  }, [store]);

  // Disconnect
  const disconnect = useCallback(() => {
    destroySdrController();
    store.disconnect();
  }, [store]);

  // Tune
  const tune = useCallback(async (freqHz: number, mode?: DemodMode) => {
    store.setFrequency(freqHz);
    if (mode) store.setMode(mode);

    const wasm = getWasm();
    if (wasm) wasm.sdr_tune(freqHz);
  }, [store]);

  // Gain
  const setGain = useCallback((gain: number) => {
    store.setGain(gain);
  }, [store]);

  // Squelch
  const setSquelch = useCallback((squelch: number) => {
    store.setSquelch(squelch);
  }, [store]);

  // Volume
  const setVolume = useCallback((vol: number) => {
    store.setVolume(vol);
    const ctrl = getSdrController();
    if (ctrl) ctrl.setVolume(vol);
  }, [store]);

  // Mode
  const setMode = useCallback((mode: DemodMode) => {
    store.setMode(mode);
  }, [store]);

  return {
    ...store,
    connect,
    disconnect,
    tune,
    setGain,
    setSquelch,
    setVolume,
    setMode,
  };
}
