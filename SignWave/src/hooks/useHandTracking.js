// useHandTracking.js
// Shared hand-tracking layer used by BOTH modules.
//
//  - loads the (singleton) HandLandmarker, exposing loading / error / retry
//  - while `enabled`, runs one detection per new video frame
//  - draws the overlay, assesses detection quality and calls `onFrame`
//    with { quality, landmarksPx, time } - a plain callback, so per-frame
//    work does NOT cause React re-renders
//  - exposes `tracking` ({code,message}) which only changes when the
//    detection state changes (not every frame)

import { useCallback, useEffect, useRef, useState } from "react";
import { getHandLandmarker } from "../services/handLandmarker";
import { assessHand } from "../utils/handQuality";
import { toPixelLandmarks } from "../utils/landmarkFeatures";
import { clearOverlay, drawHand } from "../utils/drawing";

export function useHandTracking({ videoRef, canvasRef, enabled, onFrame }) {
  const [model, setModel] = useState({ status: "loading", message: "" }); // loading | ready | error
  const [tracking, setTracking] = useState({ code: "none", message: "" });
  const landmarkerRef = useRef(null);
  const frameCb = useRef(onFrame);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { frameCb.current = onFrame; }, [onFrame]);

  useEffect(() => {
    let cancelled = false;
    setModel({ status: "loading", message: "" });
    getHandLandmarker()
      .then((lm) => { if (!cancelled) { landmarkerRef.current = lm; setModel({ status: "ready", message: "" }); } })
      .catch((err) => { if (!cancelled) setModel({ status: "error", message: `Could not load the hand-tracking model: ${err?.message || err}` }); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (!enabled || model.status !== "ready") return undefined;
    let raf = 0;
    let stopped = false;
    let lastTime = -1;
    let lastCode = null;
    const canvasEl = canvasRef.current;

    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const lm = landmarkerRef.current;
      if (!video || !canvas || !lm || video.readyState < 2 || !video.videoWidth) return;
      if (video.currentTime === lastTime) return;
      lastTime = video.currentTime;
      if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }

      let result;
      try {
        result = lm.detectForVideo(video, performance.now());
      } catch (err) {
        console.warn("Hand detection frame failed:", err);
        return;
      }
      const aspect = video.videoWidth / video.videoHeight;
      const quality = assessHand(result.landmarks, result.handedness || result.handednesses, aspect);
      const hand = result.landmarks?.[0];
      if (hand) drawHand(canvas, quality.code === "multiple" ? null : hand, quality.ok); else clearOverlay(canvas);
      if (quality.code !== lastCode) { lastCode = quality.code; setTracking({ code: quality.code, message: quality.message }); }
      frameCb.current?.({
        quality,
        landmarksPx: quality.ok ? toPixelLandmarks(hand, video.videoWidth, video.videoHeight) : null,
        time: performance.now(),
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearOverlay(canvasEl);
      setTracking({ code: "none", message: "" });
    };
  }, [enabled, model.status, videoRef, canvasRef]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { model, tracking, retry };
}
