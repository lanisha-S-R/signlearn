// aslRecognitionService.js
// Browser inference for the trained letter classifier (public/models/asl_classifier.json,
// produced by ml/train.py). A small MLP, evaluated here with plain JS - no
// extra runtime dependency.
//
//   landmarks -> computeFeatures (98 values) -> standardise -> ReLU layers
//   -> logits / temperature -> softmax -> accept or reject
//
// Predictions are rejected when the calibrated top probability is below the
// threshold chosen on validation data, or when the top two letters are too
// close. J and Z are not in the model (they need motion).

import { computeFeatures, FEATURE_COUNT } from "../utils/landmarkFeatures.js";

const MODEL_URL = `${import.meta.env?.BASE_URL ?? "/"}models/asl_classifier.json`;
let promise = null;

export function validateModel(m) {
  if (!m || !Array.isArray(m.labels) || !Array.isArray(m.layers) || m.layers.length < 2) throw new Error("Classifier file is malformed.");
  if (m.featureCount !== FEATURE_COUNT) throw new Error(`Classifier expects ${m.featureCount} features but the app computes ${FEATURE_COUNT}.`);
  const last = m.layers[m.layers.length - 1];
  if (last.b.length !== m.labels.length) throw new Error("Classifier output size does not match its labels.");
  return m;
}

/** Loads the classifier once. Rejects (and allows retry) if it is missing or invalid. */
export function loadClassifier(url = MODEL_URL) {
  if (!promise) {
    promise = fetch(url)
      .then((r) => {
        if (!r.ok || (r.headers.get("content-type") || "").includes("text/html")) throw new Error("Trained model file not found (public/models/asl_classifier.json). Run the training steps in the README.");
        return r.json();
      })
      .then(validateModel)
      .catch((err) => { promise = null; throw err; });
  }
  return promise;
}

export function forward(model, features) {
  let h = features.map((v, i) => (v - model.mean[i]) / model.std[i]);
  model.layers.forEach((layer, li) => {
    const out = new Array(layer.b.length);
    for (let j = 0; j < out.length; j++) {
      let s = layer.b[j];
      for (let i = 0; i < h.length; i++) s += h[i] * layer.W[i][j];
      out[j] = li < model.layers.length - 1 ? Math.max(0, s) : s;
    }
    h = out;
  });
  return h; // logits
}

export function softmax(logits, temperature = 1) {
  const z = logits.map((v) => v / temperature);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/**
 * @param {number[][]} landmarksPx pixel-space landmarks
 * @returns {{letter:string, probability:number, margin:number, accepted:boolean, reason:string|null, top:Array<{letter:string,p:number}>}}
 */
export function predictLetter(model, landmarksPx) {
  const probs = softmax(forward(model, computeFeatures(landmarksPx)), model.temperature || 1);
  const ranked = probs.map((p, i) => ({ letter: model.labels[i], p })).sort((a, b) => b.p - a.p);
  const [first, second] = ranked;
  const margin = first.p - (second?.p ?? 0);
  let reason = null;
  if (first.p < model.rejectThreshold) reason = "low-confidence";
  else if (margin < model.minMargin) reason = "ambiguous";
  return { letter: first.letter, probability: first.p, margin, accepted: reason === null, reason, top: ranked.slice(0, 3) };
}
