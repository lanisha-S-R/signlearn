"""Feature extraction shared by training and evaluation.

MUST stay numerically identical to src/utils/landmarkFeatures.js.
Input: 21 landmarks as an (21,3) array of MediaPipe image-normalised x,y,z
(x,y in 0..1 of the image, z relative to wrist). Hand is mirrored by
`mirror` so left/right hands share one feature space.
"""
import numpy as np

# (a, b, c): angle at b between b->a and b->c
ANGLE_TRIPLES = [
    (0, 1, 2), (1, 2, 3), (2, 3, 4),
    (0, 5, 6), (5, 6, 7), (6, 7, 8),
    (0, 9, 10), (9, 10, 11), (10, 11, 12),
    (0, 13, 14), (13, 14, 15), (14, 15, 16),
    (0, 17, 18), (17, 18, 19), (18, 19, 20),
]
TIPS = [4, 8, 12, 16, 20]
# fingertip pairs + thumb tip to each finger joint
DIST_PAIRS = [(4, 8), (4, 12), (4, 16), (4, 20), (8, 12), (12, 16), (16, 20),
              (4, 6), (4, 10), (4, 14), (4, 5), (4, 9), (8, 5), (12, 9), (16, 13), (20, 17),
              (8, 0), (12, 0), (16, 0), (20, 0), (4, 0), (8, 9), (8, 17)]


def _angle(a, b, c):
    v1, v2 = a - b, c - b
    n = np.linalg.norm(v1) * np.linalg.norm(v2)
    if n == 0:
        return 180.0
    return float(np.degrees(np.arccos(np.clip(np.dot(v1, v2) / n, -1, 1))))


def normalise(lm, mirror=False):
    """Translate to wrist, scale by wrist->middle-MCP, optional x mirror.
    Orientation is deliberately NOT removed: G/H/P/Q differ by direction."""
    p = np.asarray(lm, dtype=np.float64).copy()
    if mirror:
        p[:, 0] = 1.0 - p[:, 0]
    p -= p[0]
    # aspect ratio is unknown for x/y once normalised; the caller passes
    # coordinates already multiplied by image width/height.
    scale = np.linalg.norm(p[9]) or 1.0
    return p / scale


def features(lm_px, mirror=False):
    """lm_px: (21,3) with x,y in pixels (x*w, y*h) and z*w."""
    p = normalise(lm_px, mirror)
    f = list(p[1:].reshape(-1))  # 60 coords
    f += [_angle(p[a], p[b], p[c]) / 180.0 for a, b, c in ANGLE_TRIPLES]
    f += [float(np.linalg.norm(p[i] - p[j])) for i, j in DIST_PAIRS]
    return np.array(f, dtype=np.float32)

FEATURE_NAMES_COUNT = 60 + len(ANGLE_TRIPLES) + len(DIST_PAIRS)
