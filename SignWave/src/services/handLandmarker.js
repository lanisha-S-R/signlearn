// handLandmarker.js
// Loads the MediaPipe HandLandmarker once and shares it across the app.
// Everything runs in the browser: no camera frames leave the device.

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const BASE = import.meta.env.BASE_URL;
const WASM_LOCAL = `${BASE}mediapipe-wasm`; // copied from node_modules by scripts/copy-wasm.mjs
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_LOCAL = `${BASE}models/hand_landmarker.task`;
const MODEL_REMOTE =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let promise = null;

// Vite's dev server answers unknown paths with index.html (status 200), so
// "exists" must also check the content type.
async function assetExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok && !(res.headers.get("content-type") || "").includes("text/html");
  } catch {
    return false;
  }
}

async function create(vision, modelAssetPath, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO",
    numHands: 2, // 2 so that "more than one hand" can be detected and reported
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Cached, ready-to-use HandLandmarker. A failed load is NOT cached, so retrying works. */
export function getHandLandmarker() {
  if (!promise) {
    promise = (async () => {
      const wasm = (await assetExists(`${WASM_LOCAL}/vision_wasm_internal.wasm`)) ? WASM_LOCAL : WASM_CDN;
      const vision = await FilesetResolver.forVisionTasks(wasm);
      const model = (await assetExists(MODEL_LOCAL)) ? MODEL_LOCAL : MODEL_REMOTE;
      return create(vision, model, "CPU");
    })().catch((err) => {
      promise = null;
      throw err;
    });
  }
  return promise;
}
