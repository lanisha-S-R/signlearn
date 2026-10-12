"""Train + evaluate the static-letter classifier and export it for the browser.

  python ml/train.py            (after ml/extract_landmarks.py produced ml/data/*.npz)

Splits
  train.npz  -> 85% fit / 15% validation (validation is used ONLY for the
                temperature fit and the rejection threshold)
  test.npz   -> final held-out test, never touched during fitting
  reference sheet (24 static letters, different hand & camera) -> small
                out-of-distribution sanity check
J and Z are excluded: they are motion letters and a single frame cannot
represent them.
"""
import json, os, sys
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
sys.path.insert(0, os.path.dirname(__file__))
from features import features, FEATURE_NAMES_COUNT

ROOT = os.path.join(os.path.dirname(__file__), "..")
EXCLUDE = set("JZ")
rng = np.random.default_rng(0)

def load(path):
    d = np.load(path)
    keep = np.array([c not in EXCLUDE for c in d["y"]])
    return d["X"][keep], d["y"][keep]

def rot2d(p, deg):
    """rotate x,y of pixel-space landmarks about the wrist"""
    t = np.radians(deg); c, s = np.cos(t), np.sin(t)
    q = p.copy(); w = p[0]
    d = p[:, :2] - w[:2]
    q[:, 0] = w[0] + c * d[:, 0] - s * d[:, 1]
    q[:, 1] = w[1] + s * d[:, 0] + c * d[:, 1]
    return q

def featurise(X, augment=False, rot=0.0, noise=0.0):
    out = []
    for p in X:
        # mirror both ways: the same letter is signed with either hand
        for m in (False, True):
            q = p
            if rot: q = rot2d(q, rng.uniform(-rot, rot))
            if noise:
                scale = np.linalg.norm(q[9] - q[0])
                q = q + rng.normal(0, noise * scale, q.shape)
            out.append(features(q, mirror=m))
            if not augment: break
    return np.stack(out)

def mirror_dup(y): return np.repeat(y, 2)

Xtr_raw, ytr_raw = load(os.path.join(ROOT, "ml/data/train.npz"))
Xte_raw, yte = load(os.path.join(ROOT, "ml/data/test.npz"))
labels = sorted(set(ytr_raw))
li = {c: i for i, c in enumerate(labels)}
idx = np.arange(len(ytr_raw))
fit_i, val_i = train_test_split(idx, test_size=0.15, stratify=ytr_raw, random_state=0)
print("classes", len(labels), "fit", len(fit_i), "val", len(val_i), "test", len(yte), flush=True)

# --- training set: mirrored copies + 2 randomly rotated/noisy copies
def build_train(ix):
    X0 = Xtr_raw[ix]; y0 = ytr_raw[ix]
    parts = [featurise(X0, augment=True)]; ys = [mirror_dup(y0)]
    for _ in range(2):
        parts.append(featurise(X0, augment=True, rot=12, noise=0.015)); ys.append(mirror_dup(y0))
    return np.concatenate(parts), np.concatenate(ys)

Xf, yf = build_train(fit_i)
Xv = featurise(Xtr_raw[val_i], augment=True); yv = mirror_dup(ytr_raw[val_i])
Xt = featurise(Xte_raw, augment=True); yt = mirror_dup(yte)
mean, std = Xf.mean(0), Xf.std(0) + 1e-6
Z = lambda X: (X - mean) / std
yfi = np.array([li[c] for c in yf]); yvi = np.array([li[c] for c in yv]); yti = np.array([li[c] for c in yt])

clf = MLPClassifier(hidden_layer_sizes=(128, 64), alpha=1e-3, batch_size=256, learning_rate_init=1e-3,
                    max_iter=40, early_stopping=True, n_iter_no_change=6, random_state=0, verbose=False)
clf.fit(Z(Xf), yfi)
print("trained, iterations:", clf.n_iter_, flush=True)

def logits(X):
    h = Z(X)
    for W, b in zip(clf.coefs_[:-1], clf.intercepts_[:-1]): h = np.maximum(h @ W + b, 0)
    return h @ clf.coefs_[-1] + clf.intercepts_[-1]
def softmax(z):
    z = z - z.max(1, keepdims=True); e = np.exp(z); return e / e.sum(1, keepdims=True)
def nll(p, y): return float(-np.log(p[np.arange(len(y)), y] + 1e-12).mean())
def ece(p, y, bins=10):
    conf = p.max(1); pred = p.argmax(1); acc = (pred == y); e = 0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        m = (conf > lo) & (conf <= lo + 1 / bins)
        if m.any(): e += m.mean() * abs(acc[m].mean() - conf[m].mean())
    return float(e)

Lv = logits(Xv)
Ts = np.linspace(0.5, 4, 71)
T = float(Ts[np.argmin([nll(softmax(Lv / t), yvi) for t in Ts])])
print("temperature", T)

Lt = logits(Xt); Pt = softmax(Lt / T); pred = Pt.argmax(1)
acc = float((pred == yti).mean())
print("TEST accuracy (no rejection):", round(acc, 4))

# rejection threshold: smallest p such that val precision of accepted >= 97%
Pv = softmax(Lv / T); conf_v = Pv.max(1); ok_v = Pv.argmax(1) == yvi
thr = 0.9
for t in np.linspace(0.3, 0.99, 70):
    m = conf_v >= t
    if m.sum() > 0 and ok_v[m].mean() >= 0.97: thr = float(t); break
# The validation split is as easy as the training data, so its threshold is lax (~0.3).
# On a different signer/camera (reference-sheet check) the model is much less accurate,
# so a conservative floor is enforced for the app.
thr = max(thr, 0.7)
conf_t = Pt.max(1); acc_t = pred == yti
m = conf_t >= thr
srt = np.sort(Pt, 1); margin_t = srt[:, -1] - srt[:, -2]
report = {
    "classes": labels, "excluded": sorted(EXCLUDE),
    "n_fit_images": int(len(fit_i)), "n_val_images": int(len(val_i)), "n_test_images": int(len(yte)),
    "test_accuracy_all": acc,
    "temperature": T, "ece_val_before": ece(softmax(Lv), yvi), "ece_val_after": ece(Pv, yvi),
    "reject_threshold": thr, "test_coverage_at_threshold": float(m.mean()),
    "test_accuracy_on_accepted": float(acc_t[m].mean()) if m.any() else None,
}

# robustness under simulated perturbations (landmark-level; NOT a substitute for real cameras)
rob = {}
for name, kw in {"rotate_pm15deg": dict(rot=15), "noise_2pct_palm": dict(noise=0.02), "rotate15_noise3pct": dict(rot=15, noise=0.03)}.items():
    Xp = featurise(Xte_raw, augment=True, **kw)
    rob[name] = float((softmax(logits(Xp) / T).argmax(1) == yti).mean())
report["simulated_perturbation_accuracy"] = rob

cm = confusion_matrix(yti, pred, labels=range(len(labels)))
pairs = []
for i in range(len(labels)):
    for j in range(len(labels)):
        if i != j and cm[i, j] > 0: pairs.append((labels[i], labels[j], int(cm[i, j]), float(cm[i, j] / cm[i].sum())))
pairs.sort(key=lambda t: -t[2])
report["top_confusions_true_pred_count_rate"] = pairs[:12]
cr = classification_report(yti, pred, target_names=labels, output_dict=True, zero_division=0)
report["per_class"] = {c: {k: round(cr[c][k], 4) for k in ("precision", "recall", "f1-score")} for c in labels}

# reference-sheet check (different person, different camera, 1 sample per letter)
ref = json.load(open(os.path.join(ROOT, "ml/reference_raw.json")))
res = {}
for L, v in ref.items():
    if v is None or L in EXCLUDE: continue
    pts = np.array(v["landmarks"], dtype=np.float32)
    p = softmax(logits(features(pts)[None]) / T)[0]
    top = int(p.argmax()); res[L] = {"pred": labels[top], "p": round(float(p[top]), 3), "p_true": round(float(p[li[L]]), 3)}
report["reference_sheet_check"] = res
report["reference_sheet_correct"] = sum(1 for L, r in res.items() if r["pred"] == L)
report["reference_sheet_total"] = len(res)

os.makedirs(os.path.join(ROOT, "ml/reports"), exist_ok=True)
json.dump(report, open(os.path.join(ROOT, "ml/reports/evaluation.json"), "w"), indent=2)

# --- export for the browser
r5 = lambda a: np.round(a, 5).tolist()
model = {
    "version": 1, "featureCount": FEATURE_NAMES_COUNT, "labels": labels,
    "mean": r5(mean), "std": r5(std),
    "layers": [{"W": r5(W), "b": r5(b)} for W, b in zip(clf.coefs_, clf.intercepts_)],
    "temperature": T, "rejectThreshold": thr, "minMargin": 0.15,
    "trainedOn": "AI-Datasets/ASL-Alphabet-Dataset (landmarks extracted with MediaPipe HandLandmarker)",
}
out = os.path.join(ROOT, "public/models/asl_classifier.json")
json.dump(model, open(out, "w"), separators=(",", ":"))
print("wrote", out, os.path.getsize(out) // 1024, "KB")
print(json.dumps({k: v for k, v in report.items() if k not in ("per_class", "reference_sheet_check")}, indent=1))
print("sheet check:", res)

# parity fixtures for the JS test-suite
fx = []
for i in rng.choice(len(Xte_raw), 5, replace=False):
    p = Xte_raw[i]
    fx.append({"landmarks": p.tolist(), "features": features(p).tolist(), "featuresMirror": features(p, True).tolist(),
               "probs": softmax(logits(features(p)[None]) / T)[0].tolist()})
os.makedirs(os.path.join(ROOT, "tests/fixtures"), exist_ok=True)
json.dump(fx, open(os.path.join(ROOT, "tests/fixtures/parity.json"), "w"))
