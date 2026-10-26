/** Small offline tones; failures or browser autoplay policy never block a hand. */
let context: AudioContext | undefined;
function audioContext(): AudioContext | undefined {
  if (context?.state === 'closed') context = undefined;
  const Constructor = globalThis.AudioContext;
  if (!context && Constructor) context = new Constructor();
  return context;
}
export function unlockGameAudio(enabled: boolean): void {
  if (!enabled) return;
  try { const ctx = audioContext(); if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined); } catch { /* Audio is optional. */ }
}
export function playGameSound(event: string, enabled: boolean | (() => boolean)): boolean {
  if (!(typeof enabled === 'function' ? enabled() : enabled)) return false;
  try {
    const ctx = audioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => { if (ctx.state === 'running') playGameSound(event, enabled); }).catch(() => undefined);
      return false;
    }
    if (ctx.state !== 'running') return false;
    const frequencies: Record<string, number> = { deal: 520, check: 320, call: 440, 'bet-to': 580, 'raise-to': 660, 'all-in': 220, win: 880, fold: 260 };
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequencies[event] ?? 440, ctx.currentTime);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.11);
    return true;
  } catch { return false; }
}
