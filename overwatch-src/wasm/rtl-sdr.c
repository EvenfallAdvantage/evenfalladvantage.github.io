/*
 * rtl-sdr.c — Minimal RTL-SDR DSP WASM module
 *
 * Compile with Emscripten:
 *   emcc rtl-sdr.c -o rtl-sdr.wasm \
 *     -s WASM=1 -s EXPORTED_FUNCTIONS="['_sdr_init','_sdr_tune','_fm_demodulate','_get_signal_level']" \
 *     -s EXPORTED_RUNTIME_METHODS="[]" \
 *     -s TOTAL_STACK=65536 -s TOTAL_MEMORY=262144 \
 *     -O3 --no-entry
 *
 * Output: rtl-sdr.wasm (place in public/wasm/)
 */

#include <stdint.h>
#include <math.h>

/* ─── State ─────────────────────────────────────────── */

static float current_freq = 0;
static float signal_level = 0;

/* ─── Initialization ────────────────────────────────── */

void sdr_init(void) {
    current_freq = 0;
    signal_level = 0;
}

/* ─── Tuning stub ───────────────────────────────────── */
/* Frequency control is done via WebUSB in JavaScript.
 * This stores the frequency for reference by other functions. */

void sdr_tune(float freq_hz) {
    current_freq = freq_hz;
}

/* ─── FM Demodulator ────────────────────────────────── */
/*
 * Standard cross-multiply FM discriminator.
 *
 * Input:  interleaved 8-bit unsigned I/Q samples (len = number of I/Q pairs)
 *         Each byte is a uint8, centered at 127 (zero-IF).
 * Output: float32 audio samples (len-1 samples output)
 * Returns: number of audio samples written
 *
 * Formula for each consecutive I/Q pair:
 *   audio[i] = (I[i-1] * Q[i] - Q[i-1] * I[i]) / (I[i]^2 + Q[i]^2)
 *
 * This is a well-known approximation of the instantaneous frequency.
 */

int fm_demodulate(const uint8_t *iq_buf, float *audio_buf, int len) {
    if (len < 2) return 0;

    int out = 0;
    float prev_i = (float)iq_buf[0] - 127.0f;
    float prev_q = (float)iq_buf[1] - 127.0f;

    for (int i = 1; i < len; i++) {
        float i_val = (float)iq_buf[i * 2] - 127.0f;
        float q_val = (float)iq_buf[i * 2 + 1] - 127.0f;

        float denom = i_val * i_val + q_val * q_val;
        if (denom < 1.0f) denom = 1.0f;

        float diff = (prev_i * q_val - prev_q * i_val) / denom;
        audio_buf[out++] = diff;

        prev_i = i_val;
        prev_q = q_val;
    }

    return out;
}

/* ─── Signal Level (RMS) ────────────────────────────── */

float get_signal_level(void) {
    return signal_level;
}

void set_signal_level(float level) {
    signal_level = level;
}
