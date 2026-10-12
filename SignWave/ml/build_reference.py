"""Build src/data/referenceLandmarks.json (the Learning module's target poses).

For every letter:
  1. take the landmarks detected on the supplied sheet photo (ml/reference_raw.json)
  2. ask the trained classifier to read them. If it reads the intended letter
     with probability >= 0.5 the pose is accepted:  source = "sheet"
  3. otherwise (or when the photo could not be measured) use the best real
     training sample of that letter (highest classifier probability, mirrored
     to a common hand):                              source = "dataset"
  4. J/Z are motion letters outside the classifier: J keeps its sheet pose
     (source "sheet-unchecked", the start of the motion); Z has none.
Run after ml/train.py:   python ml/build_reference.py
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from features import features

ROOT = os.path.join(os.path.dirname(__file__), "..")
model = json.load(open(os.path.join(ROOT, "public/models/asl_classifier.json")))
labels = model["labels"]; mean = np.array(model["mean"]); std = np.array(model["std"])
Ls = [(np.array(l["W"]), np.array(l["b"])) for l in model["layers"]]

def probs(px):
    h = (features(np.asarray(px, np.float32)) - mean) / std
    for i, (W, b) in enumerate(Ls):
        h = h @ W + b
        if i < len(Ls) - 1: h = np.maximum(h, 0)
    z = h / model["temperature"]; z -= z.max(); e = np.exp(z); return e / e.sum()

raw = json.load(open(os.path.join(ROOT, "ml/reference_raw.json")))
train = np.load(os.path.join(ROOT, "ml/data/train.npz"))
out, report = {}, {}
for L in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
    r = raw.get(L); entry = None; why = ""
    if L in "JZ":
        if r: entry = {"source": "sheet-unchecked", "landmarks": r["landmarks"]}; why = "motion letter, start pose only"
        else: why = "no pose"
    else:
        if r:
            p = probs(r["landmarks"]); k = labels.index(L)
            report[L] = {"sheet_p_true": round(float(p[k]), 3), "sheet_pred": labels[int(p.argmax())]}
            if p.argmax() == k and p[k] >= 0.5: entry = {"source": "sheet", "landmarks": r["landmarks"]}; why = "classifier agrees"
        if entry is None:
            idx = np.where(train["y"] == L)[0]
            best = max(idx, key=lambda i: probs(train["X"][i])[labels.index(L)])
            entry = {"source": "dataset", "landmarks": train["X"][best].tolist()}
            why = "sheet pose rejected/undetected -> best dataset sample"
    if entry: entry["landmarks"] = np.round(np.array(entry["landmarks"]), 2).tolist()
    out[L] = entry; print(L, entry["source"] if entry else None, "-", why)
json.dump(out, open(os.path.join(ROOT, "src/data/referenceLandmarks.json"), "w"), separators=(",", ":"))
json.dump(report, open(os.path.join(ROOT, "ml/reports/reference_check.json"), "w"), indent=1)
