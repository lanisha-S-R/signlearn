import test from "node:test";
import assert from "node:assert/strict";

test("unsupported browser: calls onError, never throws", async () => {
  delete globalThis.window;
  const { speak, isSpeechSupported } = await import("../src/utils/speech.js");
  assert.equal(isSpeechSupported(), false);
  let msg = ""; speak("hi", { onError: (m) => (msg = m) });
  assert.match(msg, /not supported/i);
});
test("supported: maps synthesis errors to readable messages; empty text is refused", async () => {
  let utter;
  globalThis.document = { documentElement: { lang: "en" } };
  globalThis.window = { speechSynthesis: { cancel() {}, speak(u) { utter = u; } }, SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } } };
  globalThis.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
  const { speak } = await import("../src/utils/speech.js");
  let err = ""; speak("   ", { onError: (m) => (err = m) }); assert.match(err, /nothing/i);
  speak("Hello", { onError: (m) => (err = m) }); assert.equal(utter.text, "hello");
  utter.onerror({ error: "not-allowed" }); assert.match(err, /blocked/i);
  let ended = false; speak("Hello", { onEnd: () => (ended = true) }); utter.onerror({ error: "canceled" }); assert.ok(ended);
  utter.onend?.(); // clears the watchdog
});
