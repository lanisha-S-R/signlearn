// useCamera.js
// Owns the webcam stream. Starting is explicit; stopping (button, unmount, or
// the device being unplugged) always stops every track and detaches the video.

import { useCallback, useEffect, useRef, useState } from "react";

const ERRORS = {
  NotAllowedError: ["denied", "Camera permission was denied. Allow camera access in your browser's address bar, then press Start Camera."],
  SecurityError: ["denied", "Camera access is blocked. Allow it in your browser settings, then press Start Camera."],
  NotFoundError: ["unavailable", "No camera was found on this device."],
  OverconstrainedError: ["unavailable", "No camera matches the requested settings."],
  NotReadableError: ["unavailable", "The camera is in use by another app. Close it and try again."],
};

export function useCamera(videoRef) {
  const [state, setState] = useState({ status: "idle", message: "" }); // idle | starting | active | denied | unavailable | unsupported | error
  const streamRef = useRef(null);
  const tokenRef = useRef(0);
  const mountedRef = useRef(true);

  const release = useCallback(() => {
    tokenRef.current += 1; // invalidates any start() still awaiting the browser
    streamRef.current?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    streamRef.current = null;
    const v = videoRef.current;
    if (v) { v.pause(); v.srcObject = null; }
  }, [videoRef]);

  const stop = useCallback(() => {
    release();
    if (mountedRef.current) setState({ status: "idle", message: "" });
  }, [release]);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: "unsupported", message: "This browser can't access the camera here. Use a current Chrome, Edge, Firefox or Safari over https:// or localhost." });
      return;
    }
    const token = ++tokenRef.current;
    setState({ status: "starting", message: "" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (token !== tokenRef.current || !mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => { release(); if (mountedRef.current) setState({ status: "unavailable", message: "The camera was disconnected." }); };
      });
      const video = videoRef.current;
      video.srcObject = stream;
      try { await video.play(); } catch (e) { if (e.name !== "AbortError") throw e; }
      if (token === tokenRef.current && mountedRef.current) setState({ status: "active", message: "" });
    } catch (err) {
      release();
      const [status, message] = ERRORS[err?.name] || ["error", `Could not start the camera (${err?.message || err?.name || "unknown error"}).`];
      if (mountedRef.current) setState({ status, message });
    }
  }, [release, videoRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; release(); };
  }, [release]);

  return { ...state, start, stop };
}
