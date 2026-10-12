// letterStabilizer.js
// Turns noisy per-frame predictions into deliberate letter events.
//
//  * A letter becomes "stable" once it fills `required` of the last `windowSize`
//    frames (default 12 of 15, about 0.4 s at 30 fps).
//  * After a letter is added, the SAME letter cannot be added again until the
//    sign has been released (a different letter or no hand for `releaseFrames`
//    frames) - this stops "AAAAAAA" - and a different letter must also wait
//    out `cooldownMs`.
//  * Manual adds from the UI go through the same bookkeeping.
//
// Pure logic, no timers; `now` is passed in so it can be tested exactly.

export const STABILIZER_DEFAULTS = {
  windowSize: 15,
  required: 12,
  releaseFrames: 8,
  cooldownMs: 600,
};

export function createStabilizer(options = {}) {
  const cfg = { ...STABILIZER_DEFAULTS, ...options };
  let window = [];
  let lastAdded = null; // { letter, time }
  let released = true;
  let releaseCount = 0;

  function stableLetter() {
    if (window.length < cfg.required) return null;
    const counts = {};
    for (const l of window) if (l) counts[l] = (counts[l] || 0) + 1;
    let best = null;
    for (const [l, n] of Object.entries(counts)) if (n >= cfg.required && (!best || n > counts[best])) best = l;
    return best;
  }

  return {
    /** @param {string|null} letter an ACCEPTED prediction, or null (no hand / rejected) */
    push(letter, now) {
      window.push(letter || null);
      if (window.length > cfg.windowSize) window.shift();

      if (lastAdded && !released) {
        if (letter !== lastAdded.letter) releaseCount += 1;
        else releaseCount = 0;
        if (releaseCount >= cfg.releaseFrames) released = true;
      }

      const stable = stableLetter();
      const sameAsLast = lastAdded && stable === lastAdded.letter;
      const cooled = !lastAdded || now - lastAdded.time >= cfg.cooldownMs;
      const canAdd = !!stable && cooled && (!sameAsLast || released);
      return { stable, canAdd };
    },
    /** Call after a letter was actually appended (auto or manual). */
    markAdded(letter, now) {
      lastAdded = { letter, time: now };
      released = false;
      releaseCount = 0;
    },
    reset() {
      window = [];
      lastAdded = null;
      released = true;
      releaseCount = 0;
    },
    config: cfg,
  };
}
