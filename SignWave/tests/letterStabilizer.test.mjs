import test from "node:test";
import assert from "node:assert/strict";
import { createStabilizer } from "../src/utils/letterStabilizer.js";

const feed = (st, letter, n, t0, dt = 33) => { let r; for (let i = 0; i < n; i++) r = st.push(letter, t0 + i * dt); return r; };

test("a letter is not stable until it fills the window threshold", () => {
  const st = createStabilizer();
  assert.equal(feed(st, "A", 11, 0).stable, null);
  assert.equal(st.push("A", 400).stable, "A");
});
test("flickering predictions never become stable", () => {
  const st = createStabilizer();
  let r; for (let i = 0; i < 40; i++) r = st.push(i % 2 ? "A" : "B", i * 33);
  assert.equal(r.stable, null);
});
test("holding one sign adds it exactly once, not every frame", () => {
  const st = createStabilizer(); let adds = 0;
  for (let i = 0; i < 300; i++) { const r = st.push("A", i * 33); if (r.canAdd) { adds++; st.markAdded("A", i * 33); } }
  assert.equal(adds, 1);
});
test("same letter can be added again only after the sign is released", () => {
  const st = createStabilizer(); let t = 0; let adds = 0;
  const hold = (l, n) => { for (let i = 0; i < n; i++) { t += 33; const r = st.push(l, t); if (r.canAdd) { adds++; st.markAdded(l, t); } } };
  hold("L", 30); assert.equal(adds, 1);
  hold(null, 12); hold("L", 30); assert.equal(adds, 2);           // released by hand leaving -> "LL"
});
test("a different letter is accepted after the cooldown", () => {
  const st = createStabilizer(); let t = 0; const out = [];
  for (const l of ["A", "B"]) for (let i = 0; i < 40; i++) { t += 33; const r = st.push(l, t); if (r.canAdd) { out.push(l); st.markAdded(l, t); } }
  assert.deepEqual(out, ["A", "B"]);
});
test("no hand (null) never produces an add", () => {
  const st = createStabilizer(); let any = false;
  for (let i = 0; i < 100; i++) if (st.push(null, i * 33).canAdd) any = true;
  assert.equal(any, false);
});
