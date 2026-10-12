// landmarkFeatures.js
// Landmark normalisation and the feature vector used by the letter classifier.
// MUST stay numerically identical to ml/features.py (tests/parity.test.mjs
// checks this against fixtures produced by the Python code).
//
// Landmarks come in as "pixel space" points [x*videoWidth, y*videoHeight,
// z*videoWidth] so that distances are not distorted by the video aspect
// ratio, then everything is translated to the wrist and scaled by the
// wrist -> middle-finger-MCP distance. Orientation is NOT removed on purpose:
// G/H and P/Q only differ by which way the hand points.

export const ANGLE_TRIPLES = [
  [0, 1, 2], [1, 2, 3], [2, 3, 4],
  [0, 5, 6], [5, 6, 7], [6, 7, 8],
  [0, 9, 10], [9, 10, 11], [10, 11, 12],
  [0, 13, 14], [13, 14, 15], [14, 15, 16],
  [0, 17, 18], [17, 18, 19], [18, 19, 20],
];

export const DIST_PAIRS = [
  [4, 8], [4, 12], [4, 16], [4, 20], [8, 12], [12, 16], [16, 20],
  [4, 6], [4, 10], [4, 14], [4, 5], [4, 9], [8, 5], [12, 9], [16, 13], [20, 17],
  [8, 0], [12, 0], [16, 0], [20, 0], [4, 0], [8, 9], [8, 17],
];

export const FEATURE_COUNT = 60 + ANGLE_TRIPLES.length + DIST_PAIRS.length; // 98

/** MediaPipe normalised landmarks -> pixel-space points [[x,y,z], ...] */
export function toPixelLandmarks(landmarks, width, height) {
  return landmarks.map((l) => [l.x * width, l.y * height, (l.z || 0) * width]);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Angle in degrees at vertex b between rays b->a and b->c. */
export function angleAt(a, b, c) {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const n = norm(v1) * norm(v2);
  if (n === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot(v1, v2) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Translate to wrist, scale by palm length, optionally mirror left<->right. */
export function normalisePose(px, mirror = false) {
  const w = px[0];
  const p = px.map((pt) => [(mirror ? -1 : 1) * (pt[0] - w[0]), pt[1] - w[1], pt[2] - w[2]]);
  const scale = norm(p[9]) || 1;
  return p.map((pt) => [pt[0] / scale, pt[1] / scale, pt[2] / scale]);
}

/** The 98-value feature vector (see ml/features.py). */
export function computeFeatures(px, mirror = false) {
  const p = normalisePose(px, mirror);
  const f = [];
  for (let i = 1; i < 21; i++) f.push(p[i][0], p[i][1], p[i][2]);
  for (const [a, b, c] of ANGLE_TRIPLES) f.push(angleAt(p[a], p[b], p[c]) / 180);
  for (const [i, j] of DIST_PAIRS) f.push(norm(sub(p[i], p[j])));
  return f;
}
