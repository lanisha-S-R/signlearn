import test from "node:test";
import assert from "node:assert/strict";
import { messageReducer, initialMessage } from "../src/utils/messageReducer.js";

const run = (...actions) => actions.reduce(messageReducer, initialMessage);

test("append, space, backspace", () => {
  const s = run({ type: "append", value: "H" }, { type: "append", value: "I" }, { type: "space" }, { type: "append", value: "X" }, { type: "backspace" });
  assert.equal(s.text, "HI ");
});
test("space is ignored at start and after another space", () => {
  assert.equal(run({ type: "space" }).text, "");
  assert.equal(run({ type: "append", value: "A" }, { type: "space" }, { type: "space" }).text, "A ");
});
test("undo restores each previous text, then stops", () => {
  let s = run({ type: "append", value: "A" }, { type: "append", value: "B" }, { type: "clear" });
  assert.equal(s.text, "");
  s = messageReducer(s, { type: "undo" }); assert.equal(s.text, "AB");
  s = messageReducer(s, { type: "undo" }); assert.equal(s.text, "A");
  s = messageReducer(s, { type: "undo" }); assert.equal(s.text, "");
  assert.equal(messageReducer(s, { type: "undo" }), s);
});
test("manual edit is undoable; no-op actions do not pollute history", () => {
  const s = run({ type: "set", value: "HELLO" }, { type: "set", value: "HELLO" }, { type: "backspace" });
  assert.equal(s.text, "HELL");
  assert.equal(s.history.length, 2);
  assert.equal(run({ type: "backspace" }).history.length, 0);
});
