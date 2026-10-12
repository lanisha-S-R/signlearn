# Verification report

Environment: Linux sandbox, Node 20+, Python 3.12. No webcam, no browser, no phone.

## Tests passed (run here)
| Check | Result |
|---|---|
| `npm install` (also copies MediaPipe WASM) | OK |
| `npm run build` | OK |
| `npm run lint` (oxlint) | 0 warnings, 0 errors |
| `npm test`: 33 unit tests | 33 pass, 0 skipped |
| - message composer (append, space, backspace, clear, manual edit, undo) | pass |
| - letter stabiliser (flicker never stable, hold = one add, repeat only after release, cooldown, no-hand never adds) | pass |
| - hand-quality rejection (none / two hands / cropped / too small / low confidence / ok) | pass |
| - pose comparison (self-match, mirrored hand, scale/position invariance, "Straighten"/"Bend" advice, tilt direction flips with preview mirroring, feedback smoothing) | pass |
| - JS features and inference identical to the Python training code (5 fixtures x 98 features; probabilities within 2e-3) | pass |
| - classifier file validation rejects malformed models | pass |
| - speech wrapper: unsupported browser, error mapping, empty text, cancel | pass (mocked `speechSynthesis`) |
| Reference images: 26 PNGs exist, correct A-Z mapping, J/Z flagged as motion | pass |
| Crops checked visually against the sheet (contact sheet) | pass |
| `vite preview`: `/`, 26 sign images, classifier JSON, hand model, WASM, favicon all HTTP 200 with correct content types | pass |
| Both routes exist (`#/learn`, `#/communicate`); only the active screen is mounted | code inspection only |
| No unused components or dead buttons | inspection only |

## Tests failed
None at handover. During development, MediaPipe could not read the dataset images directly (see README), and the first versions of two unit tests were wrong and were rewritten.

## NOT performed
* Any real webcam run: camera start/stop and track release, permission-denied and unplugged paths, overlay alignment, mirror toggle, real-time frame rate.
* Browser rendering of either screen, click-through of every control, keyboard/screen-reader behaviour.
* Mobile/tablet layout (breakpoints at 900 px and 520 px were written, not viewed).
* Real speech output (mocked only) and the no-voices watchdog.
* Recognition on live video; accuracy with other people, lighting, backgrounds, camera angles.
* Learning feedback quality on real hands. The values in `TOLERANCE` are untuned judgement calls.

## Model evaluation (`ml/reports/evaluation.json`)
Data: 500 images/letter (train) and 200/letter (test) from AI-Datasets/ASL-Alphabet-Dataset after overlay removal, letters A-Y without J (24 classes). 10,157 fit + 1,793 validation images; 4,800 test images (each also evaluated mirrored).

| Measure | Value |
|---|---|
| Test accuracy, no rejection | 98.2% |
| Rejection threshold (calibrated top probability) | 0.70 (hand-set floor; validation alone suggested 0.3) |
| Coverage / accuracy on accepted, test | 97.1% / 99.5% |
| Simulated landmark perturbations (rotation ±15°, noise) | 96.5% to 97.8% |
| Calibration (ECE, validation) | 0.0005 after temperature 1.15 |
| Weakest letters (F1) | T 0.86, R 0.91, U 0.92, V 0.95 |
| Top confusions | T->R 15.5%, U->V 11.3%, T->E 5%, R->U 3% |
| **Independent check: 24 letters of the StartASL sheet (different hand, camera, lighting)** | **15 of 24 correct (62%)**; wrong: A, G, M, N, O, P, R, X, Y |

The 98% figure uses test data from the same capture source as training, so it overestimates real-world accuracy. The 15/24 sheet result is a tiny sample (and from photos, not a webcam), but it shows generalisation to new hands is much worse. The perturbation tests are synthetic. The confidence shown in the app is calibrated only for the training distribution.

## Still needs a real webcam or more data
* Recognition quality for new users: collect your own labelled landmark samples, add them, retrain.
* J and Z (motion): not implemented.
* Reference poses: A, G, M, N, O, P, R, X, Y use a stand-in dataset pose (the sheet photo did not read as the right letter); J uses its sheet pose unchecked; Z has none. The Learning screen labels these.

## Licensing to resolve
* The dataset repository has no licence file (the Kaggle dataset it appears to derive from is GPL-2). Check before redistributing the trained model.
* The alphabet sheet is © 2008 StartASL.com; the cropped reference images derive from it.

## Files changed
* **Removed:** old `src/components/*`, `src/styles/*`, `src/utils/{fingerAnalyzer,comparePose,gestureEngine,drawingUtils,mathUtils}.js`, `src/data/signs.js`. Reason: the old app covered A-E only with text poses, had no Communication module, never released its camera stream, and updated React state every frame. Dependencies `react-webcam` and `framer-motion` dropped (unused); none added.
* **New app code:** `src/App.jsx`; `components/{Sidebar,CameraPanel,LearningScreen,CommunicationScreen,MessageComposer}.jsx`; `hooks/{useCamera,useHandTracking}.js`; `services/{handLandmarker,aslRecognitionService}.js`; `utils/{landmarkFeatures,handQuality,poseComparison,letterStabilizer,messageReducer,speech,drawing}.js`; `data/{signs.js,referenceLandmarks.js,referenceLandmarks.json}`; `styles/app.css`.
* **Assets:** `public/signs/A..Z.png`, `public/models/asl_classifier.json`, `public/models/README.md`.
* **Config:** `package.json`, `index.html`, `.gitignore`, `scripts/copy-wasm.mjs`, `README.md`.
* **ML (not used at runtime):** `ml/{features,extract_clean,extract_reference,train,build_reference}.py`, `ml/run_extract.sh`, `ml/reports/*`, `ml/reference_raw.json`.
* **Tests:** `tests/*.test.mjs`, `tests/fixtures/parity.json`.
