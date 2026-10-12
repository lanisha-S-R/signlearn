// speech.js - thin, defensive wrapper around the browser's Web Speech API.
// Everything runs locally in the browser; no text or audio is sent by this app.

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

const START_TIMEOUT_MS = 4000;
let watchdog = null;

export function stopSpeaking() {
  clearTimeout(watchdog);
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

/** Speak `text`. Calls onStart / onEnd / onError(message). Never throws. */
export function speak(text, { onStart, onEnd, onError } = {}) {
  if (!isSpeechSupported()) {
    onError?.("Speech is not supported in this browser. Try Chrome, Edge or Safari.");
    return;
  }
  const clean = text.trim();
  if (!clean) {
    onError?.("Nothing to speak yet.");
    return;
  }
  try {
    stopSpeaking();
    const utter = new window.SpeechSynthesisUtterance(clean.toLowerCase());
    utter.lang = document.documentElement.lang || "en-US";
    utter.onstart = () => { clearTimeout(watchdog); onStart?.(); };
    utter.onend = () => { clearTimeout(watchdog); onEnd?.(); };
    utter.onerror = (e) => {
      clearTimeout(watchdog);
      if (e.error === "canceled" || e.error === "interrupted") { onEnd?.(); return; }
      const reasons = {
        "not-allowed": "The browser blocked audio playback. Click the button again or check the site's sound permission.",
        "audio-busy": "The audio device is busy. Close other audio apps and try again.",
        "audio-hardware": "No audio output device was found.",
        "synthesis-unavailable": "No speech voice is available on this device.",
        "synthesis-failed": "Speech synthesis failed. Try again.",
        "language-unavailable": "No voice is installed for this language.",
      };
      onError?.(reasons[e.error] || `Speech failed (${e.error || "unknown error"}).`);
    };
    // Some browsers/OSes with no installed voices accept speak() and then stay silent.
    watchdog = setTimeout(() => {
      window.speechSynthesis.cancel();
      onError?.("Speech did not start. This device may have no speech voices installed.");
    }, START_TIMEOUT_MS);
    window.speechSynthesis.speak(utter);
  } catch (err) {
    onError?.(`Speech failed: ${err?.message || err}`);
  }
}
