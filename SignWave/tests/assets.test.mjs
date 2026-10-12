import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { SIGNS, LETTERS } from "../src/data/signs.js";

test("26 signs A-Z, each with an image file that exists and is a real PNG", () => {
  assert.equal(LETTERS.join(""), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const seen = new Set();
  for (const s of SIGNS) {
    assert.match(s.image, new RegExp(`/signs/${s.letter}\\.png$`));
    const f = join(ROOT, "public", "signs", `${s.letter}.png`);
    assert.ok(existsSync(f), f); assert.ok(statSync(f).size > 5000, `${s.letter}.png too small`);
    assert.equal(readFileSync(f).subarray(1, 4).toString(), "PNG");
    assert.ok(!seen.has(s.letter)); seen.add(s.letter);
  }
});
test("J and Z are flagged as motion signs, no others", () => {
  assert.deepEqual(SIGNS.filter((s) => s.motion).map((s) => s.letter), ["J", "Z"]);
});
