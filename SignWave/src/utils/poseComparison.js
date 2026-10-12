// poseComparison.js
// Compares a live hand with a reference hand and produces *specific*
// corrections from measured differences. No generic percentage.
//
// Both hands are 21 pixel-space landmarks (see landmarkFeatures.js). They are
// translated to the wrist and scaled by palm length, so distance from the
// camera and screen resolution do not matter. Measured features:
//
//   curl[finger]     sum of the three joint deviations from straight (deg).
//                    Larger = more bent.
//   spread[pair]     angle between neighbouring finger directions (deg).
//   thumbGap         distance of the thumb tip to the reference's nearest
//                    finger target, in palm lengths (the target is chosen
//                    from the REFERENCE, so "touching the middle finger" is
//                    only asked of letters where it is part of the sign).
//   thumbToPalm      thumb tip to index-finger base, palm lengths.
//   palmRatio        palm width / palm length. Falls when the palm turns
//                    away from the camera (foreshortening).
//   tilt             direction the hand points, degrees from straight up
//                    (positive = towards the right of the raw camera image).
//
// Left/right hands: finger measures are mirror-invariant. Only `tilt` is
// not, so the live hand is compared both as-is and mirrored and the variant
// with the smaller tilt difference is used (a left-handed signer is matched
// against a mirrored reference automatically).
//
// Tolerances are judgement calls tuned for webcam landmark noise, not
// learned values. They live in TOLERANCE so they are easy to adjust.

import { angleAt, normalisePose } from "./landmarkFeatures.js";

export const TOLERANCE = {
  curl: 50, // degrees summed over 3 joints
  spread: 14, // degrees
  thumbGap: 0.35, // palm lengths
  thumbToPalm: 0.35,
  palmRatio: 0.22,
  tilt: 30, // degrees
};

const FINGERS = [
  { key: "index", name: "index finger", joints: [5, 6, 7, 8] },
  { key: "middle", name: "middle finger", joints: [9, 10, 11, 12] },
  { key: "ring", name: "ring finger", joints: [13, 14, 15, 16] },
  { key: "pinky", name: "little finger", joints: [17, 18, 19, 20] },
];

const THUMB_TARGETS = [
  { id: 8, name: "the tip of your index finger" },
  { id: 12, name: "the tip of your middle finger" },
  { id: 16, name: "the tip of your ring finger" },
  { id: 20, name: "the tip of your little finger" },
  { id: 6, name: "your index finger" },
  { id: 10, name: "your middle finger" },
];

const SPREAD_PAIRS = [
  { key: "index-middle", a: FINGERS[0], b: FINGERS[1], text: "index and middle fingers" },
  { key: "middle-ring", a: FINGERS[1], b: FINGERS[2], text: "middle and ring fingers" },
  { key: "ring-pinky", a: FINGERS[2], b: FINGERS[3], text: "ring and little fingers" },
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

function angleBetween(u, v) {
  const n = len(u) * len(v);
  if (!n) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / n))) * 180) / Math.PI;
}

/** Measure a normalised pose (output of normalisePose). */
export function measurePose(p) {
  const curl = {};
  for (const f of FINGERS) {
    const [mcp, pip, dip, tip] = f.joints;
    curl[f.key] =
      180 - angleAt(p[0], p[mcp], p[pip]) + (180 - angleAt(p[mcp], p[pip], p[dip])) + (180 - angleAt(p[pip], p[dip], p[tip]));
  }
  curl.thumb = 180 - angleAt(p[0], p[1], p[2]) + (180 - angleAt(p[1], p[2], p[3])) + (180 - angleAt(p[2], p[3], p[4]));

  const dir = (f) => sub(p[f.joints[3]], p[f.joints[0]]);
  const spread = {};
  for (const s of SPREAD_PAIRS) spread[s.key] = angleBetween(dir(s.a), dir(s.b));

  const thumbTip = p[4];
  const thumbToTargets = THUMB_TARGETS.map((t) => dist(thumbTip, p[t.id]));
  const up = sub(p[9], p[0]);
  return {
    curl,
    spread,
    thumbToTargets,
    thumbToPalm: dist(thumbTip, p[5]),
    palmRatio: dist(p[5], p[17]) / (len(up) || 1),
    tilt: (Math.atan2(up[0], -up[1]) * 180) / Math.PI,
  };
}

/**
 * @param {number[][]} livePx live landmarks in pixel space
 * @param {number[][]} refPx  reference landmarks in pixel space
 * @param {{mirroredView?: boolean}} opts mirroredView: the on-screen preview is mirrored
 * @returns {{issues: Array<{id:string, severity:number, message:string}>, level:'match'|'close'|'adjust', mirroredHand:boolean}}
 */
export function comparePose(livePx, refPx, { mirroredView = true } = {}) {
  const ref = measurePose(normalisePose(refPx));
  const variants = [false, true].map((mirror) => {
    const live = measurePose(normalisePose(livePx, mirror));
    return { mirror, live, tiltDelta: wrap(ref.tilt - live.tilt) };
  });
  const best = variants[0].tiltDelta ** 2 <= variants[1].tiltDelta ** 2 ? variants[0] : variants[1];
  const { live } = best;
  const issues = [];
  const add = (id, severity, message) => severity > 1 && issues.push({ id, severity, message });

  for (const f of [...FINGERS, { key: "thumb", name: "thumb" }]) {
    const d = live.curl[f.key] - ref.curl[f.key];
    const sev = Math.abs(d) / TOLERANCE.curl;
    add(`curl-${f.key}`, sev, d > 0 ? `Straighten your ${f.name}.` : `Bend your ${f.name} more.`);
  }

  // Thumb: only ask about the finger it touches/nears in the reference.
  let ti = 0;
  ref.thumbToTargets.forEach((d, i) => { if (d < ref.thumbToTargets[ti]) ti = i; });
  if (ref.thumbToTargets[ti] < 0.75) {
    const d = live.thumbToTargets[ti] - ref.thumbToTargets[ti];
    add("thumb-target", Math.abs(d) / TOLERANCE.thumbGap,
      d > 0 ? `Move your thumb closer to ${THUMB_TARGETS[ti].name}.` : `Move your thumb a little away from ${THUMB_TARGETS[ti].name}.`);
  } else {
    const d = live.thumbToPalm - ref.thumbToPalm;
    add("thumb-palm", Math.abs(d) / TOLERANCE.thumbToPalm,
      d > 0 ? "Bring your thumb in closer to your palm." : "Move your thumb out a little from your palm.");
  }

  for (const s of SPREAD_PAIRS) {
    const d = live.spread[s.key] - ref.spread[s.key];
    add(`spread-${s.key}`, Math.abs(d) / TOLERANCE.spread,
      d > 0 ? `Bring your ${s.text} closer together.` : `Spread your ${s.text} apart.`);
  }

  const dp = live.palmRatio - ref.palmRatio;
  add("palm", Math.abs(dp) / TOLERANCE.palmRatio,
    dp < 0 ? "Turn your palm more towards the camera." : "Turn your hand a little sideways, away from the camera.");

  // Needed change of the hand's direction in raw-image terms, then expressed
  // from the user's point of view (mirrored preview flips left/right).
  const imageChange = best.mirror ? -best.tiltDelta : best.tiltDelta;
  const towardsImageRight = imageChange > 0;
  const towardsScreenRight = mirroredView ? !towardsImageRight : towardsImageRight;
  add("tilt", Math.abs(best.tiltDelta) / TOLERANCE.tilt,
    `Tilt your hand ${Math.abs(best.tiltDelta) > 90 ? "a lot " : "a little "}to the ${towardsScreenRight ? "right" : "left"}.`);

  issues.sort((a, b) => b.severity - a.severity);
  const level = issues.length === 0 ? "match" : issues.length <= 1 && issues[0].severity < 1.6 ? "close" : "adjust";
  return { issues, level, mirroredHand: best.mirror };
}

/**
 * Smooths per-frame comparisons so the on-screen advice does not flicker.
 * An issue is reported only if it appears in at least `ratio` of the last
 * `size` frames; the match state needs the same persistence.
 */
export function createFeedbackSmoother({ size = 10, ratio = 0.6 } = {}) {
  let frames = [];
  return {
    push(cmp) {
      frames.push(cmp);
      if (frames.length > size) frames.shift();
      const counts = new Map();
      for (const f of frames) for (const i of f.issues) {
        const c = counts.get(i.id) || { n: 0, sev: 0, message: i.message };
        c.n += 1; c.sev += i.severity; c.message = i.message;
        counts.set(i.id, c);
      }
      const need = Math.ceil(frames.length * ratio);
      const issues = [...counts.entries()]
        .filter(([, c]) => c.n >= need)
        .map(([id, c]) => ({ id, severity: c.sev / c.n, message: c.message }))
        .sort((a, b) => b.severity - a.severity);
      const warm = frames.length >= Math.min(size, 5);
      const level = !warm ? "adjust" : issues.length === 0 ? "match" : issues.length <= 1 && issues[0].severity < 1.6 ? "close" : "adjust";
      return { issues, level, ready: warm };
    },
    reset() { frames = []; },
  };
}
