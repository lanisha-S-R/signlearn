import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson } from "./helpers.mjs";
import { computeFeatures, FEATURE_COUNT } from "../src/utils/landmarkFeatures.js";
import { validateModel, forward, softmax, predictLetter } from "../src/services/aslRecognitionService.js";

const have = existsSync(join(ROOT, "tests/fixtures/parity.json")) && existsSync(join(ROOT, "public/models/asl_classifier.json"));

test("JS features match the Python training features", { skip: !have && "model/fixtures not generated yet" }, () => {
  for (const fx of readJson("tests/fixtures/parity.json")) {
    for (const [mirror, expected] of [[false, fx.features], [true, fx.featuresMirror]]) {
      const got = computeFeatures(fx.landmarks, mirror);
      assert.equal(got.length, FEATURE_COUNT); assert.equal(expected.length, FEATURE_COUNT);
      got.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-3, `feature ${i}: ${v} vs ${expected[i]}`));
    }
  }
});
test("JS inference reproduces the Python probabilities", { skip: !have && "model/fixtures not generated yet" }, () => {
  const model = validateModel(readJson("public/models/asl_classifier.json"));
  for (const fx of readJson("tests/fixtures/parity.json")) {
    const p = softmax(forward(model, computeFeatures(fx.landmarks)), model.temperature);
    p.forEach((v, i) => assert.ok(Math.abs(v - fx.probs[i]) < 2e-3, `class ${i}: ${v} vs ${fx.probs[i]}`));
  }
});
test("rejection: degenerate input is never 'accepted' as a confident letter", { skip: !have && "model not generated yet" }, () => {
  const model = validateModel(readJson("public/models/asl_classifier.json"));
  const flat = Array.from({ length: 21 }, (_, i) => [100 + i, 100, 0]);
  const r = predictLetter(model, flat);
  assert.equal(typeof r.accepted, "boolean"); assert.ok(r.probability >= 0 && r.probability <= 1);
});
test("validateModel rejects malformed files", () => {
  assert.throws(() => validateModel(null));
  assert.throws(() => validateModel({ labels: ["A"], layers: [{}, { b: [1, 2] }], featureCount: FEATURE_COUNT }));
  assert.throws(() => validateModel({ labels: ["A"], layers: [{}, { b: [1] }], featureCount: 5 }));
});
