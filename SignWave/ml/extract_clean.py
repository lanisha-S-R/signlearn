"""Landmarks from the dataset images: erase the baked-in skeleton, then detect.

The dataset images are tight hand crops with a MediaPipe skeleton (red dots,
white lines, magenta border) already drawn on top, which defeats detection.
We (1) paint the overlay out with inpainting, (2) cut off the white padding,
(3) place the crop on a neutral canvas at reduced size so the palm detector
sees a whole hand with context, and (4) run the same HandLandmarker model the
app uses. Images where no hand is found afterwards are skipped, so the training
data is biased toward clearly visible hands (documented in the README).
"""
import argparse, os, random
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

MODEL = os.path.join(os.path.dirname(__file__), "..", "public", "models", "hand_landmarker.task")
_lm = None
def init():
    global _lm
    _lm = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.IMAGE,
        num_hands=1, min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3))

def clean(im):
    b, g, r = (im[..., i].astype(int) for i in range(3))
    red = (r > 150) & (g < 110) & (b < 110)
    mag = (r > 150) & (b > 150) & (g < 110)
    white = (r > 205) & (g > 205) & (b > 205) & ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 30)
    n, lab = cv2.connectedComponents(white.astype("uint8"))
    border = {l for l in set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]) if l}
    pad = np.isin(lab, list(border))
    mask = ((red | mag | (white & ~pad)).astype("uint8")) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    return cv2.inpaint(im, mask, 4, cv2.INPAINT_TELEA), pad

def prepare(im, frac):
    out, pad = clean(im)
    ys, xs = np.where(~pad)
    if len(ys) < 100: return None
    crop = out[ys.min() + 3: ys.max() - 2, xs.min() + 3: xs.max() - 2]      # drop the magenta frame
    if crop.size == 0: return None
    s = 300 * frac / max(crop.shape[:2])
    crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    canvas = np.empty((300, 300, 3), np.uint8); canvas[:] = crop.reshape(-1, 3).mean(0).astype(np.uint8)
    h, w = crop.shape[:2]; y0, x0 = (300 - h) // 2, (300 - w) // 2
    canvas[y0:y0 + h, x0:x0 + w] = crop
    return cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)

def detect(path):
    im = cv2.imread(path)
    if im is None: return None
    for frac in (0.5, 0.38, 0.65):
        rgb = prepare(im, frac)
        if rgb is None: continue
        r = _lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
        if r.hand_landmarks:
            pts = np.array([[l.x * 300, l.y * 300, l.z * 300] for l in r.hand_landmarks[0]], np.float32)
            return pts, r.handedness[0][0].category_name
    return None

def _job(item):
    r = detect(item[0]); return None if r is None else (r[0], item[1], r[1], item[0])

if __name__ == "__main__":
    from multiprocessing import Pool
    ap = argparse.ArgumentParser()
    ap.add_argument("root"); ap.add_argument("--per-class", type=int, default=400)
    ap.add_argument("--out", required=True); ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--letters", default="")
    a = ap.parse_args(); random.seed(a.seed)
    items = []
    for c in sorted(os.listdir(a.root)):
        d = os.path.join(a.root, c)
        if not os.path.isdir(d) or len(c) != 1 or (a.letters and c not in a.letters): continue
        fs = sorted(os.listdir(d)); random.shuffle(fs)
        items += [(os.path.join(d, f), c) for f in fs[:a.per_class]]
    print(len(items), "images", flush=True)
    X, y, H, P, miss = [], [], [], [], {}
    with Pool(1, initializer=init) as pool:
        for i, r in enumerate(pool.imap(_job, items, chunksize=8)):
            if r is None: miss[items[i][1]] = miss.get(items[i][1], 0) + 1
            else: X.append(r[0]); y.append(r[1]); H.append(r[2]); P.append(r[3])
            if i % 1000 == 0: print(i, len(X), flush=True)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    np.savez_compressed(a.out, X=np.stack(X), y=np.array(y), hand=np.array(H), path=np.array(P))
    kept = {c: y.count(c) for c in sorted(set(y))}
    print("kept", len(X), "of", len(items)); print("kept by class", kept)
