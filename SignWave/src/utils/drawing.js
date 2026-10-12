// drawing.js - subtle hand overlay on the live canvas.
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
];

export function clearOverlay(canvas) {
  const ctx = canvas?.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** ok=false draws in amber so a poor detection is visibly "not being used". */
export function drawHand(canvas, landmarks, ok) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks) return;
  const line = ok ? "rgba(255,255,255,0.8)" : "rgba(255,190,70,0.85)";
  ctx.lineWidth = Math.max(2, w / 400);
  ctx.lineCap = "round";
  ctx.strokeStyle = line;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  }
  ctx.fillStyle = line;
  const r = Math.max(3, w / 260);
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
