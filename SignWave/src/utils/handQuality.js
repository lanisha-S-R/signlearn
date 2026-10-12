// handQuality.js
// Decides whether a MediaPipe detection is good enough to act on and, if it
// is not, says why in plain language. Both modules use this so they refuse
// to give feedback or predictions on poor input.

export const QUALITY_THRESHOLDS = {
  edgeMargin: 0.01, // landmarks closer than this to the frame edge count as cut off
  minSpan: 0.15, // hand must span at least 15% of the frame height
  minScore: 0.6, // MediaPipe's own handedness/presence score
};

export const QUALITY_MESSAGES = {
  ok: "Hand detected",
  none: "No hand detected. Hold one hand up to the camera.",
  multiple: "More than one hand in view. Show one hand only.",
  cropped: "Part of your hand is outside the frame. Move it fully into view.",
  far: "Your hand is too small in the frame. Move it closer to the camera.",
  lowConfidence: "Can't see your hand clearly. Try better lighting or a plainer background.",
};

/**
 * @param {Array<Array<{x:number,y:number,z:number}>>} hands MediaPipe result.landmarks
 * @param {Array<Array<{score:number}>>} handednesses MediaPipe result.handedness(es)
 * @param {number} aspect video width / height
 * @returns {{ok:boolean, code:string, message:string}}
 */
export function assessHand(hands, handednesses, aspect = 4 / 3, t = QUALITY_THRESHOLDS) {
  const result = (code) => ({ ok: code === "ok", code, message: QUALITY_MESSAGES[code] });
  if (!hands || hands.length === 0) return result("none");
  if (hands.length > 1) return result("multiple");

  const lm = hands[0];
  if (!lm || lm.length < 21) return result("none");

  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX < t.edgeMargin || minY < t.edgeMargin || maxX > 1 - t.edgeMargin || maxY > 1 - t.edgeMargin) {
    return result("cropped");
  }
  const span = Math.max((maxX - minX) * aspect, maxY - minY);
  if (span < t.minSpan) return result("far");

  const score = handednesses?.[0]?.[0]?.score;
  if (typeof score === "number" && score < t.minScore) return result("lowConfidence");
  return result("ok");
}
