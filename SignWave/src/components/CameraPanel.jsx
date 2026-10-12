import { Camera, CameraOff, Loader2 } from "lucide-react";

// The one camera view used by both modules. The <video> and <canvas> are
// owned by the parent screen (so its hooks can use them); this component only
// lays them out and shows status + the Start/Stop button.
export default function CameraPanel({ videoRef, canvasRef, camera, model, tracking, mirrored, onMirrorChange, onRetryModel, className = "" }) {
  const active = camera.status === "active";

  let pill;
  if (!active) pill = { tone: "idle", text: camera.status === "starting" ? "Starting camera…" : "Camera off" };
  else if (model.status === "loading") pill = { tone: "idle", text: "Loading hand tracking…" };
  else if (model.status === "error") pill = { tone: "bad", text: "Hand tracking unavailable" };
  else if (tracking.code === "ok") pill = { tone: "good", text: "Hand detected" };
  else pill = { tone: "warn", text: tracking.message || "Show your hand" };

  const problem = camera.message || (model.status === "error" ? model.message : "");

  return (
    <section className={`panel camera ${className}`} aria-label="Live camera">
      <div className="stage">
        <video ref={videoRef} className={mirrored ? "mirrored" : ""} playsInline muted aria-label="Live camera preview" />
        <canvas ref={canvasRef} className={mirrored ? "mirrored" : ""} aria-hidden="true" />
        {!active && (
          <div className="stage-empty">
            {camera.status === "starting" ? <Loader2 className="spin" size={30} /> : <CameraOff size={30} />}
            <p>{camera.status === "starting" ? "Waiting for the camera…" : "Camera is off"}</p>
          </div>
        )}
        <span className={`pill ${pill.tone}`} role="status" aria-live="polite">{pill.text}</span>
      </div>

      {problem && (
        <p className="problem" role="alert">
          {problem}
          {model.status === "error" && <> <button className="link" onClick={onRetryModel}>Retry</button></>}
        </p>
      )}

      <div className="camera-bar">
        {active || camera.status === "starting" ? (
          <button className="btn" onClick={camera.stop}><CameraOff size={18} /> Stop Camera</button>
        ) : (
          <button className="btn primary" onClick={camera.start}><Camera size={18} /> Start Camera</button>
        )}
        <label className="check">
          <input type="checkbox" checked={mirrored} onChange={(e) => onMirrorChange(e.target.checked)} />
          Mirror preview
        </label>
      </div>
    </section>
  );
}
