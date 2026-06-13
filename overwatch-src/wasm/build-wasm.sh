#!/usr/bin/env bash
# build-wasm.sh — Compile rtl-sdr.c to WASM via Emscripten
# Requires: emcc (Emscripten SDK) in PATH
# Usage:   ./build-wasm.sh
# Output:  ../public/wasm/rtl-sdr.wasm

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$(cd "$SCRIPT_DIR/../public/wasm" && pwd)"

echo "==> Building rtl-sdr.wasm ..."
emcc "$SCRIPT_DIR/rtl-sdr.c" \
  -o "$OUT_DIR/rtl-sdr.wasm" \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS="['_sdr_init','_sdr_tune','_fm_demodulate','_get_signal_level','_set_signal_level']" \
  -s EXPORTED_RUNTIME_METHODS="[]" \
  -s TOTAL_STACK=65536 \
  -s TOTAL_MEMORY=262144 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -O3 \
  --no-entry

echo "==> Done. Output: $OUT_DIR/rtl-sdr.wasm"
wc -c "$OUT_DIR/rtl-sdr.wasm"
