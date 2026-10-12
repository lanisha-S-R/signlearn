import test from "node:test";
import assert from "node:assert/strict";
import { readJson } from "./helpers.mjs";
import { comparePose, createFeedbackSmoother } from "../src/utils/poseComparison.js";

const refs = readJson("src/data/referenceLandmarks.json");
const L = (l) => refs[l].landmarks;
const clone = (p) => p.map((q) => [...q]);
const rotate = (p, deg) => { const t = (deg * Math.PI) / 180, [wx, wy] = p[0]; return p.map(([x, y, z]) => [wx + Math.cos(t) * (x - wx) - Math.sin(t) * (y - wy), wy + Math.sin(t) * (x - wx) + Math.cos(t) * (y - wy), z]); };
const mirror = (p) => p.map(([x, y, z]) => [-x, y, z]);
// bend a finger by rotating PIP, DIP and TIP rigidly about its MCP joint (in the image plane)
function bendFinger(p, [mcp, ...rest], deg) {
  const q = clone(p), t = (deg * Math.PI) / 180, [cx, cy] = q[mcp];
  for (const i of rest) { const dx = q[i][0] - cx, dy = q[i][1] - cy; q[i][0] = cx + Math.cos(t) * dx - Math.sin(t) * dy; q[i][1] = cy + Math.sin(t) * dx + Math.cos(t) * dy; }
  return q;
}

test("a hand compared with itself matches", () => {
  for (const l of "ABDFLVWY") assert.equal(comparePose(L(l), L(l)).level, "match", l);
});
test("mirrored hand (other hand) still matches via the mirrored variant", () => {
  const c = comparePose(mirror(L("L")), L("L")); assert.equal(c.level, "match"); assert.equal(c.mirroredHand, true);
});
test("scale and position do not matter", () => {
  const big = L("K").map(([x, y, z]) => [x * 2.2 + 300, y * 2.2 + 80, z * 2.2]);
  assert.equal(comparePose(big, L("K")).level, "match");
});
test("a clearly different letter is not a match and gets specific advice", () => {
  const c = comparePose(L("B"), L("A")); assert.notEqual(c.level, "match");
  assert.ok(c.issues.length > 0 && c.issues.every((i) => /\w+ .*\./.test(i.message)));
});
// the in-plane rotation direction that bends (rather than straightens) depends on the hand, so try both
const bent = (l, ids) => [100, -100].map((d) => bendFinger(L(l), ids, d)).find((p) => comparePose(p, L(l)).issues.some((i) => i.id === "curl-index" && /Straighten/.test(i.message)));

test("finger more bent than the reference -> 'Straighten' that finger", () => {
  const live = bent("B", [5, 6, 7, 8]);
  assert.ok(live, "no rotation direction produced a curl-index issue");
  assert.match(comparePose(live, L("B")).issues.find((x) => x.id === "curl-index").message, /Straighten your index finger/);
});
test("finger straighter than the reference -> 'Bend' that finger", () => {
  const ref = bent("B", [5, 6, 7, 8]);
  assert.match(comparePose(L("B"), ref).issues.find((x) => x.id === "curl-index").message, /Bend your index finger/);
});
test("rotating the hand yields a tilt instruction whose direction flips with the mirrored preview", () => {
  const live = rotate(L("D"), 60);
  const a = comparePose(live, L("D"), { mirroredView: true }).issues.find((i) => i.id === "tilt");
  const b = comparePose(live, L("D"), { mirroredView: false }).issues.find((i) => i.id === "tilt");
  assert.ok(a && b); assert.notEqual(/right/.test(a.message), /right/.test(b.message));
});
test("feedback smoother ignores one-frame glitches and keeps persistent issues", () => {
  const good = comparePose(L("D"), L("D")); const bad = comparePose(rotate(L("D"), 70), L("D"));
  const sm = createFeedbackSmoother(); let r;
  for (let i = 0; i < 9; i++) r = sm.push(good);
  r = sm.push(bad); assert.equal(r.level, "match");
  sm.reset(); for (let i = 0; i < 10; i++) r = sm.push(bad);
  assert.ok(r.issues.some((i) => i.id === "tilt"));
});
