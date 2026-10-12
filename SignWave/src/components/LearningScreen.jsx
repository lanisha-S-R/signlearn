import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import CameraPanel from "./CameraPanel";
import { useCamera } from "../hooks/useCamera";
import { useHandTracking } from "../hooks/useHandTracking";
import { LETTERS, MOTION_NOTE, getSign } from "../data/signs";
import { getReference } from "../data/referenceLandmarks";
import { comparePose, createFeedbackSmoother } from "../utils/poseComparison";

const STORAGE_KEY = "signlearn.practised";
const MATCH_FRAMES = 20; // ~0.7 s of continuous match marks a letter as practised

function loadPractised() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { return new Set(); }
}

export default function LearningScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [letter, setLetter] = useState("A");
  const [mirrored, setMirrored] = useState(true);
  const [practised, setPractised] = useState(loadPractised);
  const [feedback, setFeedback] = useState({ kind: "off" });

  const sign = getSign(letter);
  const reference = useMemo(() => getReference(letter), [letter]);

  const camera = useCamera(videoRef);
  const active = camera.status === "active";

  // per-frame state lives in refs so frames don't re-render the page
  const live = useRef({ letter, reference, mirrored });
  const smoother = useRef(createFeedbackSmoother());
  const streak = useRef(0);
  const lastKey = useRef("");
  useEffect(() => {
    live.current = { letter, reference, mirrored };
    smoother.current.reset(); streak.current = 0; lastKey.current = "";
  }, [letter, reference, mirrored]);

  const show = useCallback((fb) => {
    const key = JSON.stringify(fb);
    if (key !== lastKey.current) { lastKey.current = key; setFeedback(fb); }
  }, []);

  const markPractised = useCallback((l) => {
    setPractised((prev) => {
      if (prev.has(l)) return prev;
      const next = new Set(prev).add(l);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const onFrame = useCallback(({ quality, landmarksPx }) => {
    const { letter: l, reference: ref, mirrored: m } = live.current;
    if (!quality.ok) { smoother.current.reset(); streak.current = 0; show({ kind: "blocked", message: quality.message }); return; }
    if (!ref) { show({ kind: "no-reference" }); return; }
    const cmp = smoother.current.push(comparePose(landmarksPx, ref.landmarks, { mirroredView: m }));
    if (!cmp.ready) { show({ kind: "warmup" }); return; }
    streak.current = cmp.level === "match" ? streak.current + 1 : 0;
    if (streak.current >= MATCH_FRAMES) markPractised(l);
    if (cmp.level === "match") show({ kind: "match", held: streak.current >= MATCH_FRAMES });
    else show({ kind: "adjust", tips: cmp.issues.slice(0, 2).map((i) => i.message) });
  }, [show, markPractised]);

  const { model, tracking, retry } = useHandTracking({ videoRef, canvasRef, enabled: active, onFrame });

  const idx = LETTERS.indexOf(letter);
  const go = (d) => setLetter(LETTERS[(idx + d + LETTERS.length) % LETTERS.length]);

  let message = null;
  if (!active) message = <p>Press <strong>Start Camera</strong>, then copy the hand shown on the left.</p>;
  else if (model.status !== "ready") message = <p>{model.status === "loading" ? "Loading hand tracking…" : "Hand tracking isn't available."}</p>;
  else if (feedback.kind === "blocked") message = <p>{feedback.message}</p>;
  else if (feedback.kind === "no-reference") message = <p>There is no pose check for {letter}: the reference hand couldn't be measured reliably. Compare your hand with the picture yourself.</p>;
  else if (feedback.kind === "match") message = <p className="good-text"><Check size={18} /> {feedback.held ? "Matches the reference. Marked as practised." : "Looks right. Hold it steady."}</p>;
  else if (feedback.kind === "adjust") message = <ul>{feedback.tips.map((t) => <li key={t}>{t}</li>)}</ul>;
  else message = <p>Hold your hand steady…</p>;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Learn the alphabet</h1>
          <p className="sub">Copy one letter at a time. Corrections come from measuring your hand against the reference.</p>
        </div>
        <div className="progress" aria-label={`${practised.size} of 26 letters practised`}>
          <span>{practised.size} of 26 practised</span>
          <div className="bar" aria-hidden="true">
            {LETTERS.map((l) => <i key={l} className={`${practised.has(l) ? "done" : ""} ${l === letter ? "current" : ""}`} />)}
          </div>
        </div>
      </header>

      <div className="letter-nav">
        <button className="btn icon" onClick={() => go(-1)} aria-label="Previous letter"><ChevronLeft size={20} /></button>
        <label className="select">
          <span className="sr-only">Choose a letter</span>
          <select value={letter} onChange={(e) => setLetter(e.target.value)}>
            {LETTERS.map((l) => <option key={l} value={l}>{l}{practised.has(l) ? " ✓" : ""}</option>)}
          </select>
        </label>
        <button className="btn icon" onClick={() => go(1)} aria-label="Next letter"><ChevronRight size={20} /></button>
      </div>

      <div className="learn-grid">
        <section className="panel reference" aria-label={`Reference hand for ${letter}`}>
          <div className="stage ref-stage">
            <img src={sign.image} alt={`ASL letter ${letter}`} />
            <span className="letter-badge">{letter}</span>
          </div>
          <p className="hint">{sign.hint}</p>
          {sign.motion && <p className="note">{MOTION_NOTE}</p>}
          {reference?.source === "dataset" && (
            <p className="note">Corrections for this letter are approximate: the picture couldn't be measured directly, so a stand-in pose is used.</p>
          )}
        </section>

        <CameraPanel
          videoRef={videoRef} canvasRef={canvasRef} camera={camera} model={model} tracking={tracking}
          mirrored={mirrored} onMirrorChange={setMirrored} onRetryModel={retry}
        />
      </div>

      <section className="panel feedback" aria-live="polite" aria-label="Feedback">{message}</section>
    </div>
  );
}
