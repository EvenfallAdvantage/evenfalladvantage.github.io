/** Short audible alarm + vibration using WebAudio (no asset download). */
let ctx: AudioContext | null = null;

export function playSosAlarm(pulses = 3): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([400, 150, 400, 150, 400]);
    const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    ctx = ctx ?? new AC();
    const t0 = ctx.currentTime;
    for (let i = 0; i < pulses; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(880, t0 + i * 0.5);
      o.frequency.linearRampToValueAtTime(1320, t0 + i * 0.5 + 0.35);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.5);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.5 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.5);
      o.stop(t0 + i * 0.5 + 0.42);
    }
  } catch {
    /* autoplay blocked: the visual banner still shows */
  }
}

export function haptic(ms = 30): void {
  try { if ("vibrate" in navigator) navigator.vibrate(ms); } catch { /* ignore */ }
}
