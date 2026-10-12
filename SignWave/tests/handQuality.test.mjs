import test from "node:test";
import assert from "node:assert/strict";
import { assessHand } from "../src/utils/handQuality.js";

const hand = (cx, cy, r) => Array.from({ length: 21 }, (_, i) => ({ x: cx + Math.cos(i) * r, y: cy + Math.sin(i) * r, z: 0 }));
const score = (s) => [[{ score: s }]];

test("no hand", () => assert.equal(assessHand([], [], 4 / 3).code, "none"));
test("undefined input", () => assert.equal(assessHand(undefined, undefined).code, "none"));
test("two hands", () => assert.equal(assessHand([hand(.3, .5, .1), hand(.7, .5, .1)], [], 4 / 3).code, "multiple"));
test("hand cut off by the frame edge", () => assert.equal(assessHand([hand(.97, .5, .1)], score(.9), 4 / 3).code, "cropped"));
test("hand too small", () => assert.equal(assessHand([hand(.5, .5, .02)], score(.9), 4 / 3).code, "far"));
test("low model confidence", () => assert.equal(assessHand([hand(.5, .5, .15)], score(.3), 4 / 3).code, "lowConfidence"));
test("good hand", () => { const q = assessHand([hand(.5, .5, .15)], score(.95), 4 / 3); assert.equal(q.ok, true); assert.equal(q.code, "ok"); });
