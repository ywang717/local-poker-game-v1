export type AISpeed = 'NORMAL' | '2X' | 'INSTANT';

export function aiDelayMs(speed: AISpeed, potImportance = 0): number {
  if (speed === 'INSTANT') return 0;
  const importance = Math.max(0, Math.min(1, potImportance));
  const normal = 300 + Math.round(importance * 500);
  return speed === '2X' ? Math.round(normal / 2) : normal;
}

export type PausableTimer = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  readonly paused: boolean;
};

export function createPausableTimer(callback: () => void, delayMs: number): PausableTimer {
  let remaining = Math.max(0, delayMs);
  let startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let paused = false;
  const schedule = () => {
    if (cancelled || paused) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      if (!cancelled && !paused) callback();
    }, remaining);
  };
  schedule();
  return {
    pause: () => {
      if (cancelled || paused) return;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      if (timer !== null) clearTimeout(timer);
      timer = null;
      paused = true;
    },
    resume: () => {
      if (cancelled || !paused) return;
      paused = false;
      schedule();
    },
    cancel: () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    get paused() { return paused; },
  };
}
