import { Delete, Eraser, Space, Undo2, Volume2, VolumeX } from "lucide-react";

export default function MessageComposer({ text, canUndo, onChange, onSpace, onBackspace, onUndo, onClear, speech }) {
  const { supported, speaking, error, onSpeak, onStop } = speech;
  return (
    <section className="panel composer" aria-label="Message">
      <label htmlFor="message" className="panel-title">Message</label>
      <textarea
        id="message"
        value={text}
        rows={3}
        placeholder="Recognised letters appear here. You can also type or edit."
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className="composer-actions">
        <button className="btn" onClick={onSpace}><Space size={18} /> Space</button>
        <button className="btn" onClick={onBackspace} disabled={!text}><Delete size={18} /> Backspace</button>
        <button className="btn" onClick={onUndo} disabled={!canUndo}><Undo2 size={18} /> Undo</button>
        <button className="btn" onClick={onClear} disabled={!text}><Eraser size={18} /> Clear</button>
        {speaking ? (
          <button className="btn primary push" onClick={onStop}><VolumeX size={18} /> Stop</button>
        ) : (
          <button className="btn primary push" onClick={onSpeak} disabled={!supported || !text.trim()}><Volume2 size={18} /> Speak Message</button>
        )}
      </div>
      {!supported && <p className="note">Speech output isn't supported in this browser. Try Chrome, Edge or Safari.</p>}
      {error && <p className="problem" role="alert">{error}</p>}
    </section>
  );
}
