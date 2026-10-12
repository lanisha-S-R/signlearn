"""Detect MediaPipe landmarks on each reference crop in public/signs and
write src/data/referenceLandmarks.json + an overlay sheet for human review.
Landmarks are stored as pixel-space (x*w, y*h, z*w) so they use the same
convention as the live pipeline. Every entry must be reviewed by a person
(see ml/reports/reference_overlay.png) before `verified` is set to true in
ml/reference_review.json."""
import json, os, string
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

ROOT = os.path.join(os.path.dirname(__file__), "..")
MODEL = os.path.join(ROOT, "public", "models", "hand_landmarker.task")
opts = vision.HandLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=MODEL),
    running_mode=vision.RunningMode.IMAGE, num_hands=1,
    min_hand_detection_confidence=0.2, min_hand_presence_confidence=0.2)
lm = vision.HandLandmarker.create_from_options(opts)
CONN = [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(9,10),(10,11),(11,12),(13,14),(14,15),(15,16),(0,17),(17,18),(18,19),(19,20),(5,9),(9,13),(13,17)]
out, tiles = {}, []
for L in string.ascii_uppercase:
    p = os.path.join(ROOT, "public", "signs", f"{L}.png")
    img = cv2.imread(p); rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    res = None
    # Try other scales, then 90/180/270 degree rotations (the palm detector is
    # orientation sensitive). Landmarks are mapped back to the upright crop.
    for flip in (False, True):
     for k in (0, 1, 3, 2):
      for pad in (80, 200):
       for scale in (1.0, 0.75, 0.5, 1.25):
        im = cv2.resize(rgb, None, fx=scale, fy=scale)
        im = cv2.copyMakeBorder(im, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(255,255,255))
        N = im.shape[0]
        src = im[:, ::-1] if flip else im
        rot = np.ascontiguousarray(np.rot90(src, k))
        r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rot))
        if r.hand_landmarks:
            res = (r, N, k, im, flip); break
       if res: break
      if res: break
     if res: break
    vis = img.copy()
    if res:
        r, N, k, im, flip = res
        pts = []
        for l in r.hand_landmarks[0]:
            x, y = l.x * N, l.y * N
            for _ in range(k): x, y = N - y, x      # undo np.rot90, one quarter turn at a time
            if flip: x = N - x                       # undo the horizontal flip
            pts.append([x, y, l.z * N])
        pts = np.array(pts)
        out[L] = {"landmarks": np.round(pts, 2).tolist(), "detectedRotation": 90 * k, "detectedFlip": flip, "score": round(r.handedness[0][0].score, 3)}
        vis = cv2.resize(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), (512, 512))
        P = [(int(p[0] / N * 512), int(p[1] / N * 512)) for p in pts]
        for a, b in CONN: cv2.line(vis, P[a], P[b], (255, 80, 0), 2)
        for q in P: cv2.circle(vis, q, 4, (0, 0, 255), -1)
    else:
        out[L] = None
        cv2.putText(vis, "NO DETECTION", (20, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
    cv2.putText(vis, L, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0,0,0), 3)
    tiles.append(cv2.resize(vis, (320, 320)))
os.makedirs(os.path.join(ROOT, "ml", "reports"), exist_ok=True)
rows = [np.hstack(tiles[i:i+7] + [np.full((320,320,3),255,np.uint8)]*(7-len(tiles[i:i+7]))) for i in range(0, 26, 7)]
cv2.imwrite(os.path.join(ROOT, "ml", "reports", "reference_overlay.png"), np.vstack(rows))
json.dump(out, open(os.path.join(ROOT, "ml", "reference_raw.json"), "w"))
print("detected:", [k for k, v in out.items() if v], "\nmissing:", [k for k, v in out.items() if not v])
print({k: (v["detectedRotation"], v["detectedFlip"]) for k, v in out.items() if v and (v["detectedRotation"] or v["detectedFlip"])})
