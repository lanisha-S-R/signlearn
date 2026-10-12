# Sign Learn

ASL alphabet learning and communication in the browser.

* **Learning**: pick a letter, see its reference hand, copy it in front of your webcam, and get specific corrections ("Straighten your index finger") measured from your hand against the reference.
* **Communication**: show ASL letters to the webcam; recognised letters are added to a message you can edit and speak aloud.

Camera frames are processed in your browser by MediaPipe and a small classifier. Nothing is uploaded. (The only network requests are Google Fonts, and the hand-tracking model/WASM if the local copies are missing.)

## Run it (Windows + VS Code)

1. Install **Node.js 20 or newer** (https://nodejs.org, LTS).
2. Open the project folder in VS Code (File > Open Folder).
3. Open a terminal (Terminal > New Terminal) and run:

```powershell
npm install
npm run dev
```

4. Open the printed address (normally http://localhost:5173) in Chrome or Edge, choose **Learning** or **Communication**, and press **Start Camera**. Allow the camera when asked. The camera works on `localhost` and on `https://` only.

Other commands: `npm run build` (production build), `npm run lint`, `npm test` (unit tests).

`npm install` also copies the MediaPipe WASM files from `node_modules` into `public/mediapipe-wasm` so the app runs offline.

## How it works

```
camera -> HandLandmarker (21 landmarks) -> quality checks (no hand / 2 hands / cropped / too small / low confidence)
   Learning:      pose measures vs reference -> corrections          (src/utils/poseComparison.js)
   Communication: 98 features -> MLP -> calibrated probability
                  -> reject if unsure -> stabiliser (12 of last 15 frames) -> Add / auto-add -> message -> Web Speech
```

| File | Purpose |
|---|---|
| `src/services/handLandmarker.js` | loads MediaPipe once (local WASM + model, CDN fallback, retry after failure) |
| `src/hooks/useCamera.js` | start/stop webcam, releases every track on stop/unmount/unplug; permission and device errors |
| `src/hooks/useHandTracking.js` | shared per-frame detection, overlay, quality status; no React re-render per frame |
| `src/utils/landmarkFeatures.js` | normalisation (wrist-centred, palm-scaled) and the 98 features |
| `src/utils/poseComparison.js` | Learning measures, tolerances, correction messages, feedback smoothing |
| `src/services/aslRecognitionService.js` | browser inference of the trained classifier, rejection rules |
| `src/utils/letterStabilizer.js` | stability window, cooldown and release rule (no repeated letters) |
| `src/utils/messageReducer.js`, `speech.js` | message editing with undo; Web Speech wrapper with error handling |
| `src/data/signs.js`, `referenceLandmarks.json` | letters, hints, reference poses |
| `public/signs/A.png ... Z.png` | reference hands cropped from the StartASL sheet |
| `ml/` | extraction, training and evaluation scripts (not used by the web app at runtime) |

### Learning comparison

Both hands are translated to the wrist and scaled by palm length. Measured: curl of each finger (sum of 3 joint angles), angle between neighbouring fingers, thumb distance to the finger it touches in the reference, palm width/length (palm turned away), and the direction the hand points. Left and right hands are both accepted (the live hand is also compared mirrored). Advice appears only when a difference exceeds a tolerance (`TOLERANCE` in `poseComparison.js`) and persists for most of ~10 frames. There is deliberately **no accuracy percentage**: the tolerances are practical settings, not a validated score. A letter is marked practised after ~0.7 s of continuous match; progress is stored in your browser (`localStorage`).

If the hand is not clearly visible, the app says so instead of giving corrections.

### Reference data and its limits

`public/signs/*.png` are cropped programmatically from `asl-alphabet_wallpaper_1920x1200.png` (hand pixels only, one hand per file, verified visually against the sheet). That sheet is © 2008 StartASL.com: check you may redistribute the crops before publishing this project.

The comparison needs landmarks, which a photo does not contain. `ml/extract_reference.py` runs MediaPipe on each crop and `ml/build_reference.py` keeps a pose only if the trained classifier reads it as the right letter (`source: "sheet"`). Others use a real dataset sample (`source: "dataset"`); the Learning screen then says its corrections are approximate. **Z** has no usable pose; **J/Z** are motion letters (only the start shape is checked, and the screen says so). See `ml/reports/reference_check.json` for which letters fell where.

## Recognition model

* **Dataset:** https://github.com/AI-Datasets/ASL-Alphabet-Dataset (4000 train / 800 test per letter, 300x300 JPEG). **No licence file is present in that repository.** The widely mirrored Kaggle "ASL Alphabet" dataset it appears to derive from is listed under GPL-2; verify the terms before redistributing the model or anything derived from it. The dataset is not stored in this repo (5.6 GB).
* **Quirk of this dataset:** the images are tight hand crops with a MediaPipe skeleton already drawn on them, so MediaPipe cannot read them directly (121 of 15,600 detected). `ml/extract_clean.py` paints the overlay out (inpainting), places the crop on a neutral canvas and runs the same HandLandmarker model the app uses. Images that still fail are skipped, so the training data favours clear hands.
* **Model:** 98 landmark features -> MLP 128-64 -> 24 letters (A-Y without J; J and Z need motion), trained on mirrored + rotated/noisy copies, temperature-scaled on a validation split, rejection threshold chosen on validation. Exported to `public/models/asl_classifier.json`, evaluated in plain JS.
* **Results:** `ml/reports/evaluation.json` and `VERIFICATION_REPORT.md`. Read the caveats there: the test split comes from the same capture source as the training split, so it is optimistic.

### Reproduce / retrain

```powershell
git clone https://github.com/AI-Datasets/ASL-Alphabet-Dataset ..\ASL-Alphabet-Dataset   # about 5.6 GB
pip install mediapipe opencv-python numpy scikit-learn
sh ml/run_extract.sh          # or run the two extract_clean.py commands inside it (about 25 min on one core)
python ml/extract_reference.py
python ml/train.py
python ml/build_reference.py
npm test
```

The JS feature code must stay identical to `ml/features.py`; `tests/parity.test.mjs` checks this against fixtures that `train.py` writes.

## Known limitations

* **J and Z** are not recognised (motion). The Learning screen shows them with a note; Z has no pose check.
* The classifier was trained on one dataset's signers, backgrounds and cameras. Expect lower accuracy with other hands and lighting; there is no data here to measure that. Similar pairs (see the confusion list in the report: e.g. M/N/S/T/E, U/R/V, K/P) are the likeliest mistakes. Confirming a letter (the default) is more reliable than auto-add.
* Webcam behaviour, speech output and phone layout were not tested on real devices by the author of this change; see `VERIFICATION_REPORT.md`.
