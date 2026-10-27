// Pure drift-safe timer. No DOM, no side effects except the callbacks you pass in.
export function createTimer({ onTick, onComplete }) {
  let state = 'idle';            // idle | running | paused | completed
  let mode = 'focus';            // focus | short | long
  let durationMs = 25 * 60_000;
  let remainingMs = durationMs;
  let endAt = null;              // Date.now() target when running
  let intervalId = null;

  const emit = () => {
    onTick?.({ state, mode, durationMs, remainingMs });
  };

  function tick() {
    if (state !== 'running') return;
    const ms = endAt - Date.now();
    if (ms <= 0) {
      remainingMs = 0;
      state = 'completed';
      stopInterval();
      emit();
      onComplete?.({ mode, durationMs });
      return;
    }
    remainingMs = ms;
    emit();
  }

  function startInterval() {
    stopInterval();
    // 250ms — smooth display, but ALL math uses Date.now(), so interval speed never matters.
    intervalId = setInterval(tick, 250);
  }

  function stopInterval() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  // Force an immediate recompute. Called on visibilitychange to catch up instantly
  // when the tab regains focus, instead of waiting for the next throttled tick.
  function forceSync() {
    if (state === 'running') tick();
  }

  return {
    setMode(newMode, ms) {
      mode = newMode;
      durationMs = ms;
      remainingMs = ms;
      state = 'idle';
      stopInterval();
      emit();
    },

    start() {
      if (state === 'running') return;
      if (state === 'completed') state = 'idle';
      if (remainingMs <= 0) remainingMs = durationMs;
      endAt = Date.now() + remainingMs;
      state = 'running';
      startInterval();
      emit();
    },

    pause() {
      if (state !== 'running') return;
      remainingMs = Math.max(0, endAt - Date.now());
      state = 'paused';
      stopInterval();
      emit();
    },

    reset() {
      stopInterval();
      state = 'idle';
      remainingMs = durationMs;
      emit();
    },

    forceSync,
    getState: () => ({ state, mode, durationMs, remainingMs }),
  };
}