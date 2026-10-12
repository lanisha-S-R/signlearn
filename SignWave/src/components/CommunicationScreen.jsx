import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Plus } from "lucide-react";
import CameraPanel from "./CameraPanel";
import MessageComposer from "./MessageComposer";
import { useCamera } from "../hooks/useCamera";
import { useHandTracking } from "../hooks/useHandTracking";
import { loadClassifier, predictLetter } from "../services/aslRecognitionService";
import { createStabilizer } from "../utils/letterStabilizer";
import { initialMessage, messageReducer } from "../utils/messageReducer";
import { isSpeechSupported, speak, stopSpeaking } from "../utils/speech";

export default function CommunicationScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mirrored, setMirrored] = useState(true);
  const [auto, setAuto] = useState(false);
  const [msg, dispatch] = useReducer(messageReducer, initialMessage);
  const [view, setView] = useState({ kind: "off" });
  const [clf, setClf] = useState({ status: "loading", message: "", model: null });
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const camera = useCamera(videoRef);
  const active = camera.status === "active";

  const stabilizer = useRef(createStabilizer());
  const modelRef = useRef(null);
  const autoRef = useRef(auto);
  const stableRef = useRef(null);
  const lastKey = useRef("");
  useEffect(() => { autoRef.current = auto; }, [auto]);

  const loadModel = useCallback(() => {
    setClf({ status: "loading", message: "", model: null });
    loadClassifier()
      .then((m) => { modelRef.current = m; setClf({ status: "ready", message: "", model: m }); })
      .catch((e) => setClf({ status: "error", message: e.message, model: null }));
  }, []);
  useEffect(() => { loadModel(); }, [loadModel]);

  const show = useCallback((v) => {
    const key = JSON.stringify(v);
    if (key !== lastKey.current) { lastKey.current = key; setView(v); }
  }, []);

  const addLetter = useCallback((letter, now = performance.now()) => {
    dispatch({ type: "append", value: letter });
    stabilizer.current.markAdded(letter, now);
  }, []);

  const onFrame = useCallback(({ quality, landmarksPx, time }) => {
    const model = modelRef.current;
    if (!quality.ok) {
      stabilizer.current.push(null, time); stableRef.current = null;
      show({ kind: "blocked", message: quality.message });
      return;
    }
    if (!model) { show({ kind: "no-model" }); return; }
    const p = predictLetter(model, landmarksPx);
    const { stable, canAdd } = stabilizer.current.push(p.accepted ? p.letter : null, time);
    stableRef.current = stable;
    if (stable && canAdd && autoRef.current) { addLetter(stable, time); }
    if (!p.accepted) show({ kind: "uncertain", reason: p.reason });
    else if (stable) show({ kind: "stable", letter: stable, pct: Math.round(p.probability * 20) * 5 });
    else show({ kind: "reading", letter: p.letter, pct: Math.round(p.probability * 20) * 5 });
  }, [show, addLetter]);

  const { model, tracking, retry } = useHandTracking({ videoRef, canvasRef, enabled: active && clf.status === "ready", onFrame });

  // Leaving/stopping resets the live reading. (The camera hook releases the stream.)
  useEffect(() => {
    if (!active) { stabilizer.current.reset(); stableRef.current = null; lastKey.current = ""; setView({ kind: "off" }); }
  }, [active]);
  useEffect(() => () => stopSpeaking(), []);

  const canAdd = active && view.kind === "stable";
  const speech = {
    supported: isSpeechSupported(), speaking, error: speechError,
    onSpeak: () => {
      setSpeechError("");
      speak(msg.text, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false), onError: (m) => { setSpeaking(false); setSpeechError(m); } });
    },
    onStop: () => { stopSpeaking(); setSpeaking(false); },
  };

  let big = "–";
  let line;
  if (!active) line = "Start the camera to begin.";
  else if (clf.status === "loading") line = "Loading the letter model…";
  else if (clf.status === "error") line = "Recognition model unavailable.";
  else if (view.kind === "blocked") line = view.message;
  else if (view.kind === "uncertain") line = view.reason === "ambiguous" ? "Not sure: this looks like more than one letter. Adjust your hand." : "Not sure yet. Hold the sign clearly toward the camera.";
  else if (view.kind === "reading") { big = view.letter; line = "Hold the sign steady…"; }
  else if (view.kind === "stable") { big = view.letter; line = "Sign recognised."; }
  else line = "Show a letter to the camera.";

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Sign to message</h1>
          <p className="sub">Show an ASL letter to the camera. Letters are added once the sign is held steady.</p>
        </div>
      </header>

      <div className="comm-grid">
        <CameraPanel
          videoRef={videoRef} canvasRef={canvasRef} camera={camera} model={model} tracking={tracking}
          mirrored={mirrored} onMirrorChange={setMirrored} onRetryModel={retry}
        />

        <section className="panel recognition" aria-label="Current recognition">
          <h2 className="panel-title">Current letter</h2>
          <div className={`big-letter ${view.kind === "stable" ? "stable" : ""} ${view.kind === "reading" ? "reading" : ""}`} aria-live="polite">{big}</div>
          <p className="rec-line">{line}</p>
          {(view.kind === "reading" || view.kind === "stable") && (
            <p className="meter">Model confidence {view.pct}%</p>
          )}
          <button className="btn primary wide" disabled={!canAdd} onClick={() => addLetter(view.letter)}>
            <Plus size={18} /> {canAdd ? `Add “${view.letter}”` : "Add Letter"}
          </button>
          <label className="check">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Add letters automatically
          </label>
          {clf.status === "error" && (
            <p className="problem" role="alert">{clf.message} <button className="link" onClick={loadModel}>Retry</button></p>
          )}
          <p className="note">J and Z need movement and can't be recognised yet. Letters A to Y (except J) are supported.</p>
        </section>
      </div>

      <MessageComposer
        text={msg.text}
        canUndo={msg.history.length > 0}
        onChange={(value) => dispatch({ type: "set", value })}
        onSpace={() => dispatch({ type: "space" })}
        onBackspace={() => dispatch({ type: "backspace" })}
        onUndo={() => dispatch({ type: "undo" })}
        onClear={() => dispatch({ type: "clear" })}
        speech={speech}
      />
    </div>
  );
}
